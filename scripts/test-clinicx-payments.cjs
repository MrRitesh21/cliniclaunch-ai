// Offline caller orchestration regression. Provider and Supabase transports explicitly mocked.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const { test } = require("node:test");
require.extensions[".ts"] = (m, f) =>
  m._compile(
    ts.transpileModule(fs.readFileSync(f, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    f,
  );
const file = path.resolve(__dirname, "../src/lib/billing.server.ts");
function fixture() {
  const a = {
    id: "00000000-0000-4000-8000-000000000001",
    organization_id: "00000000-0000-4000-8000-000000000002",
    actor_id: "actor",
    plan_id: "growth",
    billing_cycle: "monthly",
    provider_plan_id: "plan_Growth",
    amount_paise: 299900,
    provider_subscription_id: "sub_Local",
    state: "pending",
  };
  const calls = [];
  let evidence;
  const actor = {
    rpc: async (name, args) => {
      calls.push([name, args]);
      return { data: a, error: null };
    },
  };
  const admin = {
    rpc: async (name, args) => {
      calls.push([name, args]);
      if (name === "clinicx_enqueue_billing_event")
        return { data: { completed: false }, error: null };
      if (name === "clinicx_settle_payment") {
        evidence = args.p_evidence;
        return { data: { success: true, organization_id: a.organization_id }, error: null };
      }
      if (name === "clinicx_recovery_context") {
        return { data: { command: null }, error: null };
      }
      return { data: a, error: null };
    },
  };
  const provider = {
    createOrGetPlan: async (k, p, o) => {
      calls.push(["plan", o]);
      assert.equal(o.allowCreate, false);
      assert.equal(o.existingPlanId, a.provider_plan_id);
      return a.provider_plan_id;
    },
    createSubscription: async () => ({ id: "sub_Local", short_url: "https://example.test" }),
    verifySubscriptionCheckoutSignature: (p, s, sig) => sig === "valid" && s === "sub_Local",
    getPayment: async () => ({
      id: "pay_Valid",
      amount: 299900,
      currency: "INR",
      status: "captured",
      captured: true,
      invoice_id: "inv_Valid",
    }),
    getSubscription: async () => ({ id: "sub_Local", status: "active", plan_id: "plan_Growth" }),
    getPlan: async () => ({
      id: "plan_Growth",
      period: "monthly",
      interval: 1,
      item: { amount: 299900, currency: "INR" },
    }),
    getInvoice: async () => ({
      id: "inv_Valid",
      payment_id: "pay_Valid",
      subscription_id: "sub_Local",
      amount: 299900,
      currency: "INR",
      status: "paid",
      billing_start: 1780000000,
      billing_end: 1782592000,
    }),
    cancelSubscription: async () => ({ id: "sub_Local", status: "active" }),
  };
  return { a, calls, actor, admin, provider, getEvidence: () => evidence };
}
test("authenticated caller requires signed callback and legacy trial fails closed without provider charge", async () => {
  const Module = require("node:module");
  const original = Module._load;
  const f = fixture();
  const auth = {};
  const context = { userId: "actor", supabase: f.actor };
  Module._load = function (id, parent, main) {
    if (id === "@tanstack/react-start")
      return {
        createServerFn: () => {
          let valid,
            authenticated = false;
          const chain = {
            middleware(m) {
              authenticated = m.includes(auth);
              return chain;
            },
            validator(v) {
              valid = v;
              return chain;
            },
            inputValidator(v) {
              valid = v;
              return chain;
            },
            handler(h) {
              return async (args) => {
                assert.equal(authenticated, true);
                assert.ok(valid);
                return h({ ...args, data: valid(args.data) });
              };
            },
          };
          return chain;
        },
      };
    if (id === "@/integrations/supabase/auth-middleware") return { requireSupabaseAuth: auth };
    if (id === "@/integrations/supabase/client.server") return { supabaseAdmin: f.admin };
    if (id === "@/lib/razorpay.server") return f.provider;
    if (id === "@/lib/billing.server") return require(file);
    return original.apply(this, arguments);
  };
  try {
    const actions = require(path.resolve(__dirname, "../src/lib/razorpay.functions.ts"));
    await assert.rejects(
      actions.activateRazorpaySubscription({
        data: { subscription_id: "sub_Local", payment_id: "pay_Valid" },
        context,
      }),
      /signature/i,
    );
    assert.equal(f.calls.length, 0, "unsigned callback fails before authority/provider reads");
    await assert.rejects(
      actions.startOnboardingTrialSubscription({
        data: { plan_id: "growth", billing_cycle: "monthly", organization_id: f.a.organization_id },
        context,
      }),
      /free trial|provision/i,
    );
    await assert.rejects(
      actions.listSubscriptionPaymentHistory({
        data: { organization_id: f.a.organization_id },
        context,
      }),
      /payments|currency|amount_unit/i,
      "malformed authority history must not cross serialization boundary",
    );
    const result = await actions
      .activateRazorpaySubscription({
        data: {
          subscription_id: "sub_Local",
          payment_id: "pay_Valid",
          signature: "a".repeat(64),
          organization_id: f.a.organization_id,
        },
        context,
      })
      .catch((e) => e);
    assert.match(result.message, /Invalid checkout signature/);
  } finally {
    Module._load = original;
  }
});

test("native webhook Request verifies raw signature, rejects notes-only identity and never activates mandate", async () => {
  const webhookFile = path.resolve(__dirname, "../src/lib/billing-webhook.server.ts");
  assert.ok(fs.existsSync(webhookFile), "secure webhook HTTP handler missing");
  const { handleBillingWebhook } = require(webhookFile);
  const f = fixture();
  const crypto = require("node:crypto");
  const secret = "offline_webhook_fixture";
  const verifier = (raw, sig) =>
    sig === crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const raw = JSON.stringify({
    event: "subscription.authenticated",
    payload: {
      subscription: { entity: { id: "sub_Local", notes: { organization_id: "victim" } } },
    },
  });
  const req = (body, signature) =>
    new Request("https://clinicx.test/api/public/hooks/razorpay", {
      method: "POST",
      headers: { "x-razorpay-signature": signature, "x-razorpay-event-id": "evt_native" },
      body,
    });
  const options = { admin: f.admin, provider: f.provider, verifySignature: verifier };
  assert.equal((await handleBillingWebhook(req(raw, "bad"), options)).status, 401);
  assert.equal(f.calls.length, 0);
  assert.equal(
    (
      await handleBillingWebhook(
        req(raw, crypto.createHmac("sha256", secret).update(raw).digest("hex")),
        options,
      )
    ).status,
    200,
  );
  assert.equal(f.calls.filter((c) => c[0] === "clinicx_settle_payment").length, 0);
  assert.ok(f.calls.some((c) => c[0] === "clinicx_billing_lifecycle"));
  assert.equal(
    f.calls.find((c) => c[0] === "clinicx_enqueue_billing_event")[1].p_payload.payload.subscription
      .entity.notes,
    undefined,
    "provider notes are not retained in reconciliation jobs",
  );
  const notes = JSON.stringify({
    event: "subscription.authenticated",
    payload: { subscription: { entity: { notes: { organization_id: f.a.organization_id } } } },
  });
  assert.equal(
    (
      await handleBillingWebhook(
        req(notes, crypto.createHmac("sha256", secret).update(notes).digest("hex")),
        options,
      )
    ).status,
    202, // webhook acknowledged; immediate processing failed but reconciliation will retry
  );
});

test("webhook persists retryable inbox before processing and worker runs same settlement authority", async () => {
  const { handleBillingWebhook, runBillingReconciliation } = require(
    path.resolve(__dirname, "../src/lib/billing-webhook.server.ts"),
  );
  const f = fixture();
  const raw = JSON.stringify({
    event: "subscription.charged",
    payload: {
      subscription: { entity: { id: "sub_Local" } },
      payment: { entity: { id: "pay_Valid" } },
    },
  });
  const req = new Request("https://clinicx.test/hooks", {
    method: "POST",
    headers: { "x-razorpay-event-id": "evt_queue" },
    body: raw,
  });
  const result = await handleBillingWebhook(req, {
    admin: f.admin,
    provider: f.provider,
    verifySignature: () => true,
  });
  assert.equal(result.status, 200); // webhook acknowledged; immediate processing succeeded
  assert.equal(
    f.calls[0][0],
    "clinicx_enqueue_billing_event",
    "durable inbox must survive canonical provider/SQL failures",
  );
  assert.equal(
    typeof runBillingReconciliation,
    "function",
    "durable reconciliation worker missing",
  );
  const base = f.admin.rpc;
  f.admin.rpc = async (name, args) =>
    name === "clinicx_claim_billing_events"
      ? {
          data: [
            {
              event_id: "evt_retry",
              lease_token: "00000000-0000-4000-8000-000000000003",
              payload: JSON.parse(raw),
            },
          ],
          error: null,
        }
      : base(name, args);
  await runBillingReconciliation(f.admin, f.provider, 1);
  assert.ok(f.calls.some((c) => c[0] === "clinicx_settle_payment" && c[1].p_event === "evt_retry"));
  f.provider.getPayment = async () => {
    throw new Error("fixture provider down");
  };
  await runBillingReconciliation(f.admin, f.provider, 1);
  assert.ok(f.calls.some((c) => c[0] === "clinicx_retry_billing_event"));
});

test("verified authorized callback queues reconciliation but never settles; failed charge uses canonical invoice period", async () => {
  const { createBillingService } = require(file);
  const f = fixture();
  const original = f.provider.getPayment;
  f.provider.getPayment = async () => ({
    ...(await original()),
    status: "authorized",
    captured: false,
  });
  const result = await createBillingService(f.actor, f.admin, f.provider).activate({
    subscription_id: "sub_Local",
    payment_id: "pay_Valid",
    signature: "valid",
  });
  assert.equal(result.active, false);
  assert.equal(f.getEvidence(), undefined);
  assert.ok(
    f.calls.some((c) => c[0] === "clinicx_enqueue_billing_event"),
    "authorized signed callback must not be lost if provider capture is delayed",
  );
  await createBillingService(f.actor, f.admin, f.provider).webhook("evt_authorized", {
    event: "payment.authorized",
    payload: {
      subscription: { entity: { id: "sub_Local" } },
      payment: { entity: { id: "pay_Valid" } },
    },
  });
  assert.equal(
    f.calls.filter((c) => c[0] === "clinicx_billing_lifecycle").length,
    0,
    "payment awaiting capture must remain retryable, not completed mandate observation",
  );
  f.provider.getPayment = async () => ({
    ...(await original()),
    status: "failed",
    captured: false,
  });
  await createBillingService(f.actor, f.admin, f.provider).webhook("evt_failed", {
    event: "payment.failed",
    payload: {
      subscription: { entity: { id: "sub_Local" } },
      payment: { entity: { id: "pay_Valid" } },
    },
  });
  const lifecycle = f.calls.find((c) => c[0] === "clinicx_billing_lifecycle");
  assert.equal(lifecycle[1].p_status, "pending");
  assert.equal(lifecycle[1].p_period_start, 1780000000);
});

test("cancellation cannot confirm an unchanged provider subscription", async () => {
  const { createBillingService } = require(file);
  const f = fixture();
  const command = { ...f.a, kind: "cancel", state: "reserved",
    previous_provider_plan_id: f.a.provider_plan_id,
    paid_through: "2030-03-17T17:46:40.000Z", reason: null };
  const actorRPC = f.actor.rpc;
  const adminRPC = f.admin.rpc;
  f.actor.rpc = async (name, args) => name === "clinicx_reserve_recurring"
    ? { data: command, error: null } : actorRPC(name, args);
  f.admin.rpc = async (name, args) => name === "clinicx_finish_recurring"
    ? { data: { ...command, state: "confirmed" }, error: null } : adminRPC(name, args);
  await assert.rejects(
    createBillingService(f.actor, f.admin, f.provider).cancel(f.a.organization_id),
    /Lifecycle command readback mismatch.*reconciliation/i,
  );
  assert.equal(f.calls.filter((c) => c[0] === "clinicx_billing_lifecycle").length, 0);
  f.provider.getSubscription = async () => ({
    id: "sub_Local",
    plan_id: "plan_Growth",
    status: "active",
    has_scheduled_changes: true,
  });
  await assert.rejects(
    createBillingService(f.actor, f.admin, f.provider).cancel(f.a.organization_id),
    /Lifecycle command readback mismatch.*reconciliation/i,
  );
  assert.equal(f.calls.filter(c => c[0] === "clinicx_billing_lifecycle").length, 0);
  f.provider.getSubscription = async () => ({ id: "sub_Local", plan_id: "plan_Growth", status: "cancelled" });
  const cancelled = await createBillingService(f.actor, f.admin, f.provider).cancel(f.a.organization_id);
  assert.equal(cancelled.cancel_at_period_end, true);
  assert.equal(cancelled.mandate_stopped, true);
  assert.equal(cancelled.paid_through, command.paid_through);
});

test("status read cannot report a replaced mandate as the active subscription", async () => {
  const { createBillingService } = require(file);
  const f = fixture();
  const original = f.actor.rpc;
  f.actor.rpc = async (name, args) =>
    name === "clinicx_billing_current"
      ? {
          data: {
            active: true,
            status: "active",
            current_period_end: "2026-11-07T00:00:00Z",
            provider_subscription_id: "sub_Other",
          },
          error: null,
        }
      : original(name, args);
  assert.equal(
    (
      await createBillingService(f.actor, f.admin, f.provider).status({
        subscription_id: "sub_Local",
      })
    ).active,
    false,
  );
});

test("owner reconciliation with explicit payment evidence uses capture authority, never status mirroring", async () => {
  const { createBillingService } = require(file);
  const f = fixture();
  const original = f.actor.rpc;
  f.actor.rpc = async (name, args) =>
    name === "clinicx_billing_current"
      ? {
          data: {
            provider_subscription_id: "sub_Local",
            status: "active",
            current_period_end: "2026-11-07T00:00:00Z",
          },
          error: null,
        }
      : original(name, args);
  await createBillingService(f.actor, f.admin, f.provider).reconcile(
    f.a.organization_id,
    "pay_Valid",
    "sub_Local",
  );
  assert.ok(
    f.calls.some((c) => c[0] === "clinicx_settle_payment"),
    "manual reconciliation must use the captured charge authority",
  );
});

test("bound signed callback canonical capture delegates one atomic settlement, never notes", async () => {
  assert.ok(fs.existsSync(file), "secure billing orchestration missing");
  const { createBillingService } = require(file);
  const f = fixture();
  const result = await createBillingService(f.actor, f.admin, f.provider).activate({
    subscription_id: "sub_Local",
    payment_id: "pay_Valid",
    signature: "valid",
    organization_id: f.a.organization_id,
  });
  assert.equal(result.success, true);
  assert.equal(f.getEvidence().amount_paise, 299900);
  assert.equal(f.getEvidence().invoice_id, "inv_Valid");
  assert.equal(f.calls.filter((c) => c[0] === "clinicx_settle_payment").length, 1);
  assert.equal(f.calls[0][0], "clinicx_checkout_context", "ownership before provider access");
});
