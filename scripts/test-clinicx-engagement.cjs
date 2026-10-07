const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
function load(name) {
  const file = path.join(root, "src/lib", name + ".ts");
  assert.ok(fs.existsSync(file), `Missing implementation: ${name}`);
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  vm.runInNewContext(
    code,
    {
      exports: mod.exports,
      module: mod,
      require: (n) => (n.startsWith("./trial-engagement") ? load(n.slice(2)) : require(n)),
      Request,
      Response,
      AbortController,
      AbortSignal,
      URL,
      TextEncoder,
      console,
      process,
      setTimeout,
      clearTimeout,
      fetch: () => {
        throw new Error("Provider transport disabled");
      },
    },
    { filename: file },
  );
  return mod.exports;
}
async function main() {
  const worker = load("trial-engagement.server");
  let calls = 0;
  const denied = await worker.handleClinicxJobs(
    new Request("https://fixture.invalid/api/internal/clinicx-jobs"),
    {
      cronKey: "fixture-key",
      run: async () => {
        calls++;
        return {};
      },
    },
  );
  assert.equal(denied.status, 401);
  assert.equal(calls, 0);
  const allowed = await worker.handleClinicxJobs(
    new Request("https://fixture.invalid/api/internal/clinicx-jobs", {
      method: "POST",
      headers: { "x-cron-key": "fixture-key" },
    }),
    {
      cronKey: "fixture-key",
      run: async () => {
        calls++;
        return { delivered: 0 };
      },
    },
  );
  assert.equal(allowed.status, 200);
  assert.equal(calls, 1);
  const fail = await worker.handleClinicxJobs(
    new Request("https://fixture.invalid/api/internal/clinicx-jobs", {
      headers: { "x-cron-key": "fixture-key" },
    }),
    {
      cronKey: "fixture-key",
      run: async () => {
        throw new Error("secret");
      },
    },
  );
  assert.equal(fail.status, 503);
  assert.ok(!(await fail.text()).includes("secret"));
  let request;
  const email = {
    id: "11111111-1111-4111-8111-111111111111",
    lease_token: "22222222-2222-4222-8222-222222222222",
    idempotency_key: "clinicx-email-fixture",
    to: "owner@example.invalid",
    copy: { title: "Fixture <title>", body: "No PHI" },
  };
  const send = worker.createTrialEmailSender("fixture-api-key", async (url, options) => {
    request = { url, options };
    return Response.json({ id: "fixture-provider-id" });
  });
  await send(email);
  assert.equal(request.options.headers["Idempotency-Key"], email.idempotency_key);
  assert.equal(JSON.parse(request.options.body).text, "No PHI");
  await assert.rejects(
    worker.createTrialEmailSender(
      "fixture-api-key",
      async () => new Response("", { status: 429 }),
    )(email),
  );
  const policy = load("trial-engagement");
  const start = "2026-01-01T12:00:00.000Z";
  const end = "2026-01-31T12:00:00.000Z";
  const grace = "2026-02-07T12:00:00.000Z";
  for (const day of [0, 7, 15, 21, 25, 28, 30, 37]) {
    const s = {
      server_now: new Date(Date.parse(start) + day * 86400000).toISOString(),
      effective_state: day < 30 ? "trialing" : day < 37 ? "grace_period" : "suspended",
      subscription: { trial_started_at: start, trial_ends_at: end, grace_ends_at: grace },
    };
    assert.equal(policy.trialCheckpoint(s), day);
  }
  if (process.env.CLINICX_ENGAGEMENT_FIXTURE_URL) {
    const url = process.env.CLINICX_ENGAGEMENT_FIXTURE_URL;
    assert.equal(new URL(url).hostname, "127.0.0.1");
    const rpc = {
      rpc: async (name, args) => {
        const response = await fetch(url, { method: "POST", body: JSON.stringify({ name, args }) });
        const value = await response.json();
        return { data: value, error: null };
      },
    };
    let sent = 0;
    const summary = await worker.runTrialEngagementJobs(rpc, {
      sendEmail: async () => {
        sent++;
      },
      batchSize: 10,
    });
    assert.equal(summary.delivered, 1);
    assert.equal(sent, 1);
    const repeated = await worker.runTrialEngagementJobs(rpc, {
      sendEmail: async () => {
        sent++;
      },
      batchSize: 10,
    });
    assert.equal(repeated.delivered, 0);
    assert.equal(sent, 1);
  }
  const routeSource = fs.readFileSync(
    path.join(root, "src/routes/api/internal/clinicx-jobs.ts"),
    "utf8",
  );
  assert.match(
    routeSource,
    /if\s*\(\s*!process\.env\.SUPABASE_SERVICE_ROLE_KEY/,
    "Cron must reject missing service authority before resolving the fallback admin client",
  );
  const uiSource = fs.readFileSync(
    path.join(root, "src/components/billing/ClinicTrialJourney.tsx"),
    "utf8",
  );
  assert.ok(
    uiSource.includes("getClinicTrialEngagement"),
    "Journey is not wired to trial-window server query",
  );
  assert.ok(uiSource.includes("days_active"), "Journey omits factual active days");
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const mod = { exports: {} };
  const uiCode = ts.transpileModule(uiSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const component = (tag) => (props) => React.createElement(tag, props, props.children);
  const requireUI = (name) => {
    if (name === "@tanstack/react-query")
      return { useQuery: () => ({ data: undefined, isError: false }) };
    if (name === "@tanstack/react-router") return { Link: component("a") };
    if (name === "@/components/ui/card") return { Card: component("section") };
    if (name === "@/components/ui/badge") return { Badge: component("span") };
    if (name === "@/components/ui/button") return { Button: component("button") };
    if (name === "@/lib/trial-engagement.functions")
      return {
        getClinicTrialEngagement: () => {
          throw new Error("Framework query transport disabled");
        },
      };
    if (name === "@/lib/trial-engagement") return policy;
    if (name === "./clinicx-ux") {
      const helper = { exports: {} };
      const code = ts.transpileModule(
        fs.readFileSync(path.join(root, "src/components/billing/clinicx-ux.ts"), "utf8"),
        { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
      ).outputText;
      vm.runInNewContext(code, { exports: helper.exports, module: helper, require: requireUI });
      return helper.exports;
    }
    return require(name);
  };
  vm.runInNewContext(uiCode, { exports: mod.exports, module: mod, require: requireUI, Intl, Date });
  const snapshot = {
    organization_id: "11111111-1111-4111-8111-111111111111",
    server_now: start,
    effective_state: "trialing",
    subscription: {
      id: "22222222-2222-4222-8222-222222222222",
      trial_started_at: start,
      trial_ends_at: end,
      grace_ends_at: grace,
    },
    usage: { patients: 900, appointments: 0, prescriptions: 0, staff: 0, doctors: 1 },
    recommendation: { plan_id: "growth" },
  };
  const engagement = {
    organization_id: snapshot.organization_id,
    server_now: start,
    usage: {
      window_started_at: start,
      window_ended_at: end,
      patients: 27,
      appointments: 4,
      completed_appointments: 2,
      visits: 1,
      completed_visits: null,
      prescriptions: 3,
      invoices: 2,
      invoiced_inr: 1200,
      collected_inr: 300,
      days_active: 2,
    },
    checkpoints: [],
  };
  const html = renderToStaticMarkup(
    React.createElement(mod.exports.ClinicTrialJourney, { snapshot, engagement, checklist: true }),
  );
  assert.ok(html.includes("Trial-window activity"));
  assert.ok(html.includes("Days active"));
  assert.ok(html.includes("Not tracked"));
  assert.ok(html.includes("27"));
  assert.ok(!html.includes("900"));
  const swapped = renderToStaticMarkup(
    React.createElement(mod.exports.ClinicTrialJourney, {
      snapshot,
      engagement: { ...engagement, organization_id: "33333333-3333-4333-8333-333333333333" },
    }),
  );
  assert.ok(!swapped.includes("27"));
  assert.ok(swapped.includes("Loading verified trial activity"));
  console.log(
    "PASS: auth, handler, sanitized failure, provider key/body, provider rejection, exact checkpoints, journey rendering and tenant-switch fail-closed" +
      (process.env.CLINICX_ENGAGEMENT_FIXTURE_URL ? " + real DB delivery/repeat integration" : ""),
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
