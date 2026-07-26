// Runtime auth-boundary tests for _admin and _authenticated (CLIAA-32).
// Requires the local Supabase stack + `npm run dev`. Never point this at production.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || "playwright");

const APP = process.env.APP_URL || "http://localhost:8080";
const results = [];
const record = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}\n      ${detail}`);
};

const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});

async function signIn(page, email) {
  await page.goto(`${APP}/login`);
  const res = await page.evaluate(
    async ({ email }) => {
      const { supabase } = await import("/src/integrations/supabase/client.ts");
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: "QAtest!2345",
      });
      return { ok: !!data?.session, error: error?.message };
    },
    { email },
  );
  if (!res.ok) throw new Error(`signIn(${email}) failed: ${res.error}`);
}

// --- Test 1: signed-out dashboard leaks no clinic data before redirect ---
{
  const page = await browser.newPage();
  const bodies = [];
  page.on("response", async (r) => {
    if (r.request().resourceType() === "document" || r.url().includes("_serverFn")) {
      try {
        bodies.push(await r.text());
      } catch {}
    }
  });
  await page.goto(`${APP}/dashboard/appointments`, { waitUntil: "networkidle" });
  const url = page.url();
  const leak = bodies.join("\n").match(/"(patient_name|patient_phone|appointment_date)"/g);
  record(
    "T1 signed-out /dashboard/appointments",
    url.includes("/login") && !leak,
    `redirected to ${url}; patient-field leaks in payloads: ${leak ? leak.join(",") : "none"}`,
  );
  await page.close();
}

// --- Test 2: clinic-owner (non-admin) cannot reach /admin/doctors ---
{
  const page = await browser.newPage();
  const denials = [];
  page.on("response", async (r) => {
    if (r.url().includes("_serverFn")) {
      try {
        const t = await r.text();
        if (/Forbidden|Unauthorized/.test(t)) denials.push(`${r.status()}`);
      } catch {}
    }
  });
  await signIn(page, "qa-owner-a@clinicx.test");
  await page.goto(`${APP}/admin/doctors`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const url = page.url();
  const body = await page.content();
  record(
    "T2 non-admin -> /admin/doctors",
    !url.includes("/admin/doctors") && !/Admin Console/.test(body),
    `landed on ${url}; server-side denials observed: ${denials.length || 0}`,
  );
  await page.close();
}

// --- Test 3: tampered / missing tokens against an _admin server function ---
{
  const page = await browser.newPage();
  await signIn(page, "qa-admin@clinicx.test");
  const out = await page.evaluate(async () => {
    const { supabase } = await import("/src/integrations/supabase/client.ts");
    const { getAdminMe } = await import("/src/lib/admin-auth.functions.ts");
    const { data } = await supabase.auth.getSession();
    const good = data.session.access_token;
    const tampered = good.slice(0, -6) + "AAAAAA";
    const call = async (tok) => {
      const orig = window.fetch;
      window.fetch = (u, o = {}) => {
        const h = new Headers(o.headers || {});
        if (tok === null) h.delete("authorization");
        else h.set("authorization", `Bearer ${tok}`);
        return orig(u, { ...o, headers: h });
      };
      try {
        const r = await getAdminMe();
        return { ok: true, role: r.role };
      } catch (e) {
        return { ok: false, err: String(e.message || e).slice(0, 90) };
      } finally {
        window.fetch = orig;
      }
    };
    return {
      admin: await call(good),
      tampered: await call(tampered),
      none: await call(null),
      garbage: await call("abc.def.ghi"),
    };
  });
  const denied = (r) => !r.ok;
  record(
    "T3 tampered/absent tokens at _admin server fn",
    out.admin.ok && denied(out.tampered) && denied(out.none) && denied(out.garbage),
    `valid-admin=${JSON.stringify(out.admin)} tampered=${JSON.stringify(out.tampered)} none=${JSON.stringify(out.none)} garbage=${JSON.stringify(out.garbage)}`,
  );
  await page.close();
}

// --- Test 4: invite-token validation ---
{
  const page = await browser.newPage();
  const cases = { forged: "not-a-real-token-000", empty: "x" };
  const seen = {};
  for (const [k, tok] of Object.entries(cases)) {
    await page.goto(`${APP}/invite/${tok}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    const body = await page.innerText("body").catch(() => "");
    seen[k] = /invalid|expired|not found|no longer/i.test(body)
      ? "rejected"
      : `ACCEPTED(${body.slice(0, 60)})`;
  }
  record(
    "T4 invite token validation (forged)",
    Object.values(seen).every((v) => v === "rejected"),
    JSON.stringify(seen),
  );
  await page.close();
}

// --- Test 5: invite RLS — forged/expired/reused invites cannot mint memberships ---
// The server-side boundary for invites is the "Invitee can join via valid invite"
// RLS policy on organization_members, so we hit it directly with supabase-js,
// bypassing the UI. Needs service-role access to stage invite fixtures.
{
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !serviceKey || !anonKey) {
    record(
      "T5 invite RLS direct (forged/expired/reused)",
      false,
      "SKIPPED: set SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY to run",
    );
  } else if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(url)) {
    record("T5 invite RLS direct (forged/expired/reused)", false, `refusing non-local ${url}`);
  } else {
    const { createClient } = await import("@supabase/supabase-js");
    const svc = createClient(url, serviceKey, { auth: { persistSession: false } });
    const email = "qa-nonadmin@clinicx.test";
    const { data: org } = await svc
      .from("organizations")
      .select("id")
      .eq("slug", "qa-clinic-a")
      .single();

    const user = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data: signin, error: sErr } = await user.auth.signInWithPassword({
      email,
      password: "QAtest!2345",
    });
    if (sErr) throw sErr;
    const uid = signin.user.id;

    const clearInvites = () => svc.from("organization_invites").delete().eq("email", email);
    const setInvite = async (fields) => {
      await clearInvites();
      const { error } = await svc
        .from("organization_invites")
        .insert({ organization_id: org.id, email, role: "staff", ...fields });
      if (error) throw error;
    };
    const tryJoin = async () => {
      const { error } = await user
        .from("organization_members")
        .insert({ organization_id: org.id, user_id: uid, role: "staff" });
      if (!error) {
        await svc
          .from("organization_members")
          .delete()
          .eq("organization_id", org.id)
          .eq("user_id", uid);
        return "JOINED";
      }
      return `denied(${error.code})`;
    };

    const out = {};
    await clearInvites();
    out.forged = await tryJoin(); // no invite exists at all
    await setInvite({ expires_at: new Date(Date.now() - 86400000).toISOString() });
    out.expired = await tryJoin();
    await setInvite({ accepted_at: new Date().toISOString() });
    out.reused = await tryJoin();
    await setInvite({}); // positive control: valid invite must work
    out.valid = await tryJoin();
    await clearInvites();

    record(
      "T5 invite RLS direct (forged/expired/reused)",
      out.forged !== "JOINED" &&
        out.expired !== "JOINED" &&
        out.reused !== "JOINED" &&
        out.valid === "JOINED",
      JSON.stringify(out),
    );
  }
}

await browser.close();
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
