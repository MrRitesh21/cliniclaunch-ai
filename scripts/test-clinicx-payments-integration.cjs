// Invoked only by the synthetic PG harness. Real TS caller/service/adapter + native HTTP handler.
// Razorpay HTTP is mocked; ONLY the passed loopback SQL fixture bridge can use real fetch.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const crypto = require("node:crypto");
const Module = require("node:module");
const [base, org, actorId] = process.argv.slice(2);
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base || ""))
  throw new Error("Synthetic loopback bridge required");
process.env.RAZORPAY_KEY_ID = "rzp_test_offline_fixture";
process.env.RAZORPAY_KEY_SECRET = "offline_fixture_only";
process.env.RAZORPAY_WEBHOOK_SECRET = "offline_webhook_fixture_only";
require.extensions[".ts"] = (m, f) =>
  m._compile(
    ts.transpileModule(fs.readFileSync(f, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    f,
  );
const realFetch = global.fetch;
const now = Math.floor(Date.now() / 1000);
const subs = new Map();
const payments = new Map();
const invoices = new Map();
let created = 0;
let providerCalls = 0;
let cancellationPosts = 0;
let canonicalCancelledReads = 0;
global.fetch = async (url, init) => {
  if (String(url) === base) return realFetch(url, init);
  const u = new URL(String(url));
  assert.equal(u.origin, "https://api.razorpay.com", "all non-fixture transport denied");
  providerCalls++;
  let data;
  if (u.pathname === "/v1/plans/plan_Growth")
    data = {
      id: "plan_Growth",
      period: "monthly",
      interval: 1,
      item: { amount: 299900, currency: "INR" },
    };
  else if (u.pathname === "/v1/subscriptions" && init.method === "POST") {
    const body = JSON.parse(init.body);
    assert.equal(body.plan_id, "plan_Growth");
    assert.ok(
      !body.addons && !body.start_at && !body.offer_id,
      "no synthetic trial/discount charge",
    );
    const id = "sub_Integration" + ++created;
    data = {
      id,
      short_url: "https://example.test/fixture",
      status: "created",
      plan_id: body.plan_id,
      current_start: now - 2591900,
      current_end: now + 100,
    };
    subs.set(id, data);
  } else if (/^\/v1\/subscriptions\/sub_[A-Za-z0-9]+\/cancel$/.test(u.pathname)) {
    data = subs.get(u.pathname.split("/")[3]);
    assert.equal(init.method, "POST");
    assert.deepEqual(JSON.parse(init.body), { cancel_at_cycle_end: 0 });
    data.status = "cancelled";
    cancellationPosts++;
    // Mutation acknowledgement deliberately disagrees. Only the following GET is canonical.
    data = { ...data, status: "active" };
  } else if (u.pathname.startsWith("/v1/subscriptions/")) {
    assert.equal(init.method ?? "GET", "GET");
    data = subs.get(u.pathname.split("/")[3]);
    if (cancellationPosts && data?.status === "cancelled") canonicalCancelledReads++;
  }
  else if (u.pathname.startsWith("/v1/payments/")) data = payments.get(u.pathname.split("/")[3]);
  else if (u.pathname.startsWith("/v1/invoices/")) data = invoices.get(u.pathname.split("/")[3]);
  else throw new Error("unexpected mocked provider request " + u.pathname);
  return new Response(JSON.stringify(data ?? {}), { status: data ? 200 : 404 });
};
const rpc = (role) => ({
  rpc: async (name, args) => {
    const response = await realFetch(base, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role, name, args }),
    });
    return response.json();
  },
});
const actor = rpc("authenticated");
const admin = rpc("service_role");
const context = { userId: actorId, supabase: actor };
const auth = {};
const root = path.resolve(__dirname, "..");
const original = Module._load;
Module._load = function (id, parent, main) {
  if (id === "@tanstack/react-start")
    return {
      createServerFn: () => {
        let valid,
          authed = false;
        const chain = {
          middleware(ms) {
            authed = ms.includes(auth);
            return chain;
          },
          inputValidator(v) {
            valid = v;
            return chain;
          },
          handler(h) {
            return (args) => {
              assert.ok(authed && valid);
              return h({ ...args, data: valid(args.data) });
            };
          },
        };
        return chain;
      },
    };
  if (id === "@tanstack/react-router") return { createFileRoute: () => (x) => x };
  if (id === "@/integrations/supabase/auth-middleware") return { requireSupabaseAuth: auth };
  if (id === "@/integrations/supabase/client.server") return { supabaseAdmin: admin };
  if (id.startsWith("@/lib/")) return require(path.join(root, "src/lib", id.slice(6) + ".ts"));
  return original.apply(this, arguments);
};
const actions = require(path.join(root, "src/lib/razorpay.functions.ts"));
const route = require(path.join(root, "src/routes/api/public/hooks/razorpay.ts")).Route;
const call = (name, data) => actions[name]({ data, context });
const signature = (paymentId, subscriptionId) =>
  crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${paymentId}|${subscriptionId}`)
    .digest("hex");
const charge = (sid, pid, iid, start, end, status = "captured") => {
  payments.set(pid, {
    id: pid,
    status,
    captured: status === "captured",
    amount: 299900,
    currency: "INR",
    invoice_id: iid,
  });
  invoices.set(iid, {
    id: iid,
    payment_id: pid,
    subscription_id: sid,
    amount: 299900,
    currency: "INR",
    status: status === "captured" ? "paid" : "issued",
    billing_start: start,
    billing_end: end,
  });
};
const webhook = async (id, event, pid, sid) => {
  const raw = JSON.stringify({
    event,
    payload: {
      subscription: {
        entity: { id: sid, notes: { organization_id: "untrusted-notes-never-used" } },
      },
      ...(pid ? { payment: { entity: { id: pid } } } : {}),
    },
  });
  const request = new Request("https://clinicx.test/api/public/hooks/razorpay", {
    method: "POST",
    headers: {
      "x-razorpay-event-id": id,
      "x-razorpay-signature": crypto
        .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
        .update(raw)
        .digest("hex"),
    },
    body: raw,
  });
  return route.server.handlers.POST({ request });
};
(async () => {
  const checkout = await call("startRazorpaySubscription", {
    organization_id: org,
    plan_id: "growth",
    billing_cycle: "monthly",
  });
  const sid = checkout.subscription_id;
  const initial = await actor.rpc("clinicx_billing_current", { p_org: org });
  assert.equal(initial.data.status, "trialing");
  assert.equal(initial.data.active, false);
  assert.equal(
    (
      await call("startRazorpaySubscription", {
        organization_id: org,
        plan_id: "growth",
        billing_cycle: "monthly",
      })
    ).subscription_id,
    sid,
  );
  assert.equal(created, 1, "retry must reuse local pending attempt");
  charge(sid, "pay_Integration1", "inv_Integration1", now - 2591900, now + 100, "authorized");
  const callback = {
    organization_id: org,
    attempt_id: checkout.attempt_id,
    subscription_id: sid,
    payment_id: "pay_Integration1",
    signature: signature("pay_Integration1", sid),
  };
  assert.equal((await call("activateRazorpaySubscription", callback)).active, false);
  const countBefore = providerCalls;
  await assert.rejects(
    call("activateRazorpaySubscription", {
      ...callback,
      organization_id: "00000000-0000-4000-8000-000000000099",
    }),
    /binding/,
  );
  assert.equal(providerCalls, countBefore, "cross-tenant reject before provider reads");
  await assert.rejects(
    call("activateRazorpaySubscription", { ...callback, signature: "0".repeat(64) }),
    /signature/,
  );
  charge(sid, "pay_Integration1", "inv_Integration1", now - 2591900, now + 100);
  subs.get(sid).status = "active";
  const raced = await Promise.all([
    call("activateRazorpaySubscription", callback),
    webhook("evt_integration1", "subscription.charged", "pay_Integration1", sid),
    call("syncRazorpaySubscription", {
      organization_id: org,
      subscription_id: sid,
      payment_id: "pay_Integration1",
    }),
  ]);
  assert.equal(raced[0].success, true);
  assert.equal(raced[1].status, 200);
  assert.equal(raced[2].ok, true);
  let history = (await actor.rpc("clinicx_billing_history", { p_org: org, p_limit: 100 })).data;
  assert.equal(history.payments.length, 1);
  assert.equal(history.invoices.length, 1);
  assert.equal(history.payments[0].amount_paise, 299900);
  const failedPid = "pay_IntegrationFail";
  charge(sid, failedPid, "inv_IntegrationFail", now + 100, now + 2592100, "failed");
  subs.get(sid).status = "pending";
  subs.get(sid).current_start = now + 100;
  assert.equal(
    (await webhook("evt_integration_fail", "payment.failed", failedPid, sid)).status,
    200,
  );
  assert.equal(
    (await actor.rpc("clinicx_billing_current", { p_org: org })).data.status,
    "past_due",
  );
  charge(sid, "pay_Integration2", "inv_Integration2", now + 100, now + 2592100);
  subs.get(sid).status = "active";
  subs.get(sid).current_end = now + 2592100;
  assert.equal(
    (await webhook("evt_integration_renewal", "subscription.charged", "pay_Integration2", sid))
      .status,
    200,
  );
  const renewed = (await actor.rpc("clinicx_billing_current", { p_org: org })).data;
  assert.equal(renewed.status, "active");
  await call("cancelRazorpaySubscription", { organization_id: org });
  assert.equal(cancellationPosts, 1, "cancellation mutation must not retry");
  assert.ok(canonicalCancelledReads > 0, "independent canonical subscription GET must confirm cancellation, not POST acknowledgement");
  assert.equal(
    (await actor.rpc("clinicx_billing_current", { p_org: org })).data.current_period_end,
    renewed.current_period_end,
  );
  // Canonical cancelled GET cannot be resumed or replaced while paid-through access remains.
  const createdBefore = created;
  await assert.rejects(call("resumeRazorpaySubscription", { organization_id: org }), /cancelled|paused|cannot/i);
  await assert.rejects(call("startRazorpaySubscription", {
    organization_id: org, plan_id: "growth", billing_cycle: "monthly",
  }), /paid|mandate|overlap|cancel|terminal/i);
  assert.equal(created, createdBefore, "resume/replacement must not create an overlapping mandate");
  assert.equal(
    (await actor.rpc("clinicx_billing_current", { p_org: org })).data.provider_subscription_id,
    sid,
    "resume cannot overwrite paid-through authority before capture",
  );
  history = (await actor.rpc("clinicx_billing_history", { p_org: org, p_limit: 100 })).data;
  assert.equal(history.payments.length, 2);
  assert.equal(history.invoices.length, 2);
  console.log(
    JSON.stringify({
      integration: "real TS caller + adapter (mock HTTP) + native webhook + PG17 atomic SQL",
      captured_payments: history.payments.length,
      invoices: history.invoices.length,
      concurrent_paths: 3,
      renewal: "verified",
      failure: "past_due",
      cancel: "paid-through preserved",
      resume: "cancelled mandate rejected; no overlapping checkout",
      live_provider_calls: 0,
    }),
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
