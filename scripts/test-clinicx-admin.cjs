// Actual TypeScript orchestration, mocked auth/DB transport; provider transport denied.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const Module = require("node:module");
const { test } = require("node:test");
require.extensions[".ts"] = (m, f) =>
  m._compile(
    ts.transpileModule(fs.readFileSync(f, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    f,
  );
const file = path.resolve(__dirname, "../src/lib/admin.server.ts");
async function harness(run, opts = {}) {
  const original = Module._load;
  const calls = [];
  const actor = {
    rpc: async (name, args) => {
      calls.push([name, args]);
      return { data: opts.rpcData ?? {}, error: opts.rpcError ?? null };
    },
  };
  const service = {
    from(table) {
      if (opts.profile && table === "clinics")
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          maybeSingle: async () => ({
            data: { organization_id: "org-fixture", suspended_at: null },
            error: null,
          }),
        };
      if (opts.profile && table === "subscriptions")
        return {
          delete() {
            calls.push(["delete-subscription"]);
            return this;
          },
          eq: async () => ({ error: null }),
        };
      if (opts.profile && table === "admin_audit_logs")
        return { insert: async () => ({ error: null }) };
      assert.equal(table, "user_roles", "billing reads must not use service role tables");
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        in() {
          return this;
        },
        maybeSingle: async () => ({
          data: opts.roles?.[0] ?? { role: "support" },
          error: opts.roleError ?? null,
        }),
        then(resolve) {
          resolve({ data: opts.roles ?? [{ role: "support" }], error: opts.roleError ?? null });
        },
      };
    },
  };
  Module._load = function (id, parent, main) {
    if (id === "@tanstack/react-start/server")
      return {
        getRequest: () =>
          new Request("http://fixture.test", {
            headers: opts.noToken ? {} : { authorization: "Bearer fixture-token" },
          }),
      };
    if (id === "@supabase/supabase-js")
      return {
        createClient: () => ({
          ...actor,
          auth: {
            getClaims: async () => ({
              data: { claims: opts.claims ?? { sub: "actor", email: "admin@example.test" } },
              error: opts.authError ?? null,
            }),
            getUser: async () => ({
              data: { user: opts.authError ? null : { id: "actor", email: "admin@example.test" } },
              error: opts.authError ?? null,
            }),
          },
        }),
      };
    if (id === "@/integrations/supabase/client.server") return { supabaseAdmin: service };
    if (id.includes("razorpay")) throw Error("Provider transport forbidden on admin GET");
    return original.apply(this, arguments);
  };
  delete require.cache[file];
  try {
    return await run(require(file), calls);
  } finally {
    Module._load = original;
    delete require.cache[file];
  }
}
test("verified admin fails closed for invalid auth even with forged claims", () =>
  harness(async (m) => assert.equal(await m.getVerifiedAdmin(), null), {
    authError: { message: "invalid" },
    claims: { sub: "forged", email: "evil@example.test" },
  }));
test("support and superadmin roles together are valid rather than maybeSingle failure", () =>
  harness(async (m) => assert.equal((await m.getVerifiedAdmin()).role, "super_admin"), {
    roles: [{ role: "support" }, { role: "super_admin" }],
  }));
test("role lookup error fails closed", () =>
  harness(async (m) => assert.equal(await m.getVerifiedAdmin(), null), {
    roleError: { message: "unavailable" },
  }));
test("anonymous billing read denied before DB or provider", () =>
  harness(async (m) => assert.rejects(m.getAdminStatsImpl(), /Unauthorized/), { noToken: true }));
test("statistics read dispatches only caller-token read RPC and validates DTO", () =>
  harness(async (m, calls) => {
    await assert.rejects(m.getAdminStatsImpl(), /Invalid admin billing response/);
    assert.deepEqual(
      calls.map((c) => c[0]),
      ["clinicx_admin_billing_stats"],
    );
  }));
test("customer list uses bounded page RPC no broad service-role scan", () =>
  harness(async (m, calls) => {
    await assert.rejects(
      m.listAdminSubscriptionsImpl({ page: 2, pageSize: 20, filter: "paid" }),
      /Invalid admin billing response/,
    );
    assert.deepEqual(calls[0], [
      "clinicx_admin_customers",
      { p_page: 2, p_limit: 20, p_filter: "paid" },
    ]);
  }));
test("RPC errors do not masquerade as zero revenue", () =>
  harness(async (m) => assert.rejects(m.getAdminStatsImpl(), /Billing analytics unavailable/), {
    rpcError: { message: "missing migration" },
  }));
test("profile-only administration never deletes the existing subscription", () =>
  harness(
    async (m, calls) => {
      await m.updateDoctorProfileImpl({ id: "clinic-fixture" });
      assert.deepEqual(calls, [], "omitting planId must preserve financial history");
    },
    { profile: true },
  ));
test("ordinary tenant cannot use direct customer/statistics handler or client admin flags", () =>
  harness(
    async (m, calls) => {
      await assert.rejects(m.getAdminStatsImpl(), /Unauthorized/);
      await assert.rejects(
        m.getAdminCustomerBillingImpl({
          clinicId: "00000000-0000-4000-8000-000000000099",
          isSuperAdmin: true,
        }),
        /Unauthorized/,
      );
      assert.deepEqual(calls, []);
    },
    { roles: [], claims: { sub: "tenant-a", is_superadmin: true } },
  ));

test("transaction GET no longer invokes provider reconciliation", () => {
  const source = fs.readFileSync(file, "utf8");
  const body = source
    .split("export async function listTransactionsImpl()")[1]
    .split("// -------------------------------------------------------------")[0];
  assert.doesNotMatch(body, /syncRazorpayTransactions\(/);
});
