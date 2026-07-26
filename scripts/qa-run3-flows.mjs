// CLIAA-21 remaining flows: dashboard (owner sees booking exactly once), auth guards,
// admin access control, tenant isolation, walk-in submit.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || "playwright");

const APP = process.env.APP_URL || "http://localhost:8082";
const EV = process.env.EVIDENCE_DIR || "./qa-evidence";
const BOOKING_NAME = process.env.BOOKING_NAME || "QA Run3 260712";
const PASSWORD = "QAtest!2345";
const results = [];
const rec = (n, p, d) => {
  results.push([n, p, d]);
  console.log(`${p ? "PASS" : "FAIL"}  ${n} :: ${d}`);
};

const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});

async function freshPage(viewport = { width: 1280, height: 800 }) {
  const ctx = await browser.newContext({ viewport });
  const p = await ctx.newPage();
  p.setDefaultTimeout(45000);
  p.setDefaultNavigationTimeout(45000);
  return { ctx, p };
}

async function login(p, email) {
  await p.goto(`${APP}/login`, { waitUntil: "networkidle" });
  await p.waitForTimeout(2000);
  await p.locator("input[type=email]").fill(email);
  await p.locator("input[type=password]").fill(PASSWORD);
  await p.locator("button[type=submit]").first().click();
  await p.waitForTimeout(6000);
  return p.url();
}

// ── Flow 3a: signed-out access to an _authenticated route ──
{
  const { ctx, p } = await freshPage();
  await p.goto(`${APP}/dashboard/appointments`, { waitUntil: "networkidle" });
  await p.waitForTimeout(2500);
  const u = p.url();
  await p.screenshot({ path: `${EV}/auth-signedout-redirect.png` });
  rec("signed-out /dashboard/appointments redirects", !u.includes("/dashboard"), `landed=${u}`);
  await ctx.close();
}

// ── Flow 3b: signed-out access to an _admin route ──
{
  const { ctx, p } = await freshPage();
  await p.goto(`${APP}/admin/dashboard`, { waitUntil: "networkidle" });
  await p.waitForTimeout(2500);
  const u = p.url();
  await p.screenshot({ path: `${EV}/admin-signedout-redirect.png` });
  rec("signed-out /admin/dashboard rejected", !u.includes("/admin/dashboard"), `landed=${u}`);
  await ctx.close();
}

// ── Flows 1b+4: demo-clinic owner sees the booking exactly once; settings loads ──
{
  const { ctx, p } = await freshPage();
  const landed = await login(p, "cto-qa-a@clinicx.test");
  rec("login demo-org owner (cto-qa-a)", landed.includes("dashboard"), `landed=${landed}`);
  await p.goto(`${APP}/dashboard/appointments`, { waitUntil: "networkidle" });
  await p.waitForTimeout(2500);
  const rows = await p.locator(`text=${BOOKING_NAME}`).count();
  await p.screenshot({ path: `${EV}/dashboard-appointments-demo.png`, fullPage: true });
  rec("booking appears exactly once in clinic list", rows === 1, `rows matching '${BOOKING_NAME}'=${rows}`);
  await p.goto(`${APP}/dashboard/settings`, { waitUntil: "networkidle" });
  await p.waitForTimeout(2000);
  await p.screenshot({ path: `${EV}/dashboard-settings-demo.png`, fullPage: true });
  rec("clinic settings loads", p.url().includes("settings"), `url=${p.url()}`);
  await ctx.close();
}

// ── Flow 6: tenant isolation — owner A must not see clinic B data or demo booking ──
{
  const { ctx, p } = await freshPage();
  const landed = await login(p, "qa-owner-a@clinicx.test");
  rec("login qa-owner-a", landed.includes("dashboard"), `landed=${landed}`);
  await p.goto(`${APP}/dashboard/appointments`, { waitUntil: "networkidle" });
  await p.waitForTimeout(2500);
  const leakBooking = await p.locator(`text=${BOOKING_NAME}`).count();
  const leakSecret = await p.locator("text=Secret Patient A").count();
  await p.screenshot({ path: `${EV}/tenant-ownerA-appointments.png`, fullPage: true });
  rec(
    "owner A cannot see demo clinic's bookings",
    leakBooking === 0 && leakSecret === 0,
    `demoBooking=${leakBooking} secretPatient=${leakSecret}`,
  );
  // API-level probe with owner A's browser session: request demo org's appointments via REST
  const probe = await p.evaluate(async () => {
    const raw = Object.keys(localStorage).find((k) => k.includes("auth-token"));
    if (!raw) return { error: "no session in localStorage" };
    const sess = JSON.parse(localStorage.getItem(raw));
    const token = sess?.access_token || sess?.currentSession?.access_token;
    const resp = await fetch(
      "http://127.0.0.1:54321/rest/v1/appointments?select=id,patient_name&organization_id=eq.11111111-1111-4111-8111-111111111111",
      {
        headers: {
          apikey: "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH",
          Authorization: `Bearer ${token}`,
        },
      },
    );
    return { status: resp.status, body: await resp.text() };
  });
  const rowsBack = (() => {
    try { return JSON.parse(probe.body || "[]").length; } catch { return -1; }
  })();
  rec(
    "RLS: owner A REST query for demo org returns 0 rows",
    probe.status === 200 ? rowsBack === 0 : probe.status >= 400,
    `status=${probe.status} rows=${rowsBack} ${probe.error || ""}`,
  );
  // Cross-tenant WRITE probe: owner A tries to cancel a demo-org appointment
  const writeProbe = await p.evaluate(async () => {
    const raw = Object.keys(localStorage).find((k) => k.includes("auth-token"));
    const sess = JSON.parse(localStorage.getItem(raw));
    const token = sess?.access_token || sess?.currentSession?.access_token;
    const resp = await fetch(
      "http://127.0.0.1:54321/rest/v1/appointments?id=eq.695ec8e8-50c7-413f-b63a-1a59a163c969",
      {
        method: "PATCH",
        headers: {
          apikey: "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({ status: "cancelled" }),
      },
    );
    return { status: resp.status, body: (await resp.text()).slice(0, 200) };
  });
  rec(
    "RLS: owner A cannot modify demo org's appointment",
    writeProbe.status >= 400 || writeProbe.body === "[]",
    `status=${writeProbe.status} body=${writeProbe.body}`,
  );
  // Flow 5b: owner A (non-admin, has org role but no super_admin) tries admin route
  await p.goto(`${APP}/admin/dashboard`, { waitUntil: "networkidle" });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${EV}/admin-ownerA-attempt.png` });
  rec("non-admin (owner A) blocked from /admin/dashboard", !p.url().includes("/admin/dashboard"), `landed=${p.url()}`);
  await ctx.close();
}

// ── Flow 5a: super_admin can reach admin panel ──
{
  const { ctx, p } = await freshPage();
  await login(p, "qa-admin@clinicx.test");
  await p.goto(`${APP}/admin/dashboard`, { waitUntil: "networkidle" });
  await p.waitForTimeout(3000);
  await p.screenshot({ path: `${EV}/admin-superadmin-dashboard.png`, fullPage: true });
  rec("super_admin reaches /admin/dashboard", p.url().includes("/admin"), `landed=${p.url()}`);
  await ctx.close();
}

// ── Flow 5c: role-less user (qa-nonadmin) tries admin route ──
{
  const { ctx, p } = await freshPage();
  await login(p, "qa-nonadmin@clinicx.test");
  await p.goto(`${APP}/admin/dashboard`, { waitUntil: "networkidle" });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${EV}/admin-nonadmin-attempt.png` });
  rec("role-less user blocked from /admin/dashboard", !p.url().includes("/admin/dashboard"), `landed=${p.url()}`);
  await ctx.close();
}

// ── Flow 2: walk-in submit at 375px ──
{
  const { ctx, p } = await freshPage({ width: 375, height: 812 });
  await p.goto(`${APP}/c/sunrise-skin-demo/walkin`, { waitUntil: "networkidle" });
  await p.waitForTimeout(2000);
  const nameInput = p.locator("input").first();
  const inputs = await p.locator("input:visible").count();
  await p.screenshot({ path: `${EV}/walkin-form-375.png`, fullPage: true });
  let submitted = false;
  if (inputs >= 2) {
    const WPHONE = "+9198764" + String(Date.now()).slice(-5);
    await p.locator("input:visible").nth(0).fill("QA Walkin Run3");
    await p.locator("input:visible").nth(1).fill(WPHONE);
    const btn = p.locator("button[type=submit], button:has-text('Join'), button:has-text('Check')").first();
    await btn.click().catch(() => {});
    await p.waitForTimeout(4000);
    await p.screenshot({ path: `${EV}/walkin-after-submit-375.png`, fullPage: true });
    const body = (await p.textContent("body")) || "";
    submitted = /queue|token|position|thank|success|confirmed|added/i.test(body);
    console.log("walkin phone:", WPHONE);
  }
  rec("walk-in submit @375", submitted, `visibleInputs=${inputs} submitted=${submitted}`);
  await ctx.close();
}

await browser.close();
const fails = results.filter((r) => !r[1]).length;
console.log(`\n${results.length - fails}/${results.length} passed`);
