// Render actual owned React routes using native-PG readbacks. Auth/transport/framework mocked.
// Not a hosted JWT, PostgREST or browser E2E test.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const Module = require("node:module");
const { test } = require("node:test");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
for (const extension of [".ts", ".tsx"])
  require.extensions[extension] = (m, f) =>
    m._compile(
      ts.transpileModule(fs.readFileSync(f, "utf8"), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
        },
      }).outputText,
      f,
    );
assert.ok(
  process.env.CLINICX_ADMIN_CAPTURE,
  "First run native DB test with CLINICX_ADMIN_CAPTURE set to a profile scratch JSON path",
);
const native = JSON.parse(fs.readFileSync(process.env.CLINICX_ADMIN_CAPTURE, "utf8"));
const contract = require("../src/lib/subscription-analytics.ts");
let stats, page, detail;
test("native PG statistics match the finite typed API contract", () => {
  stats = contract.parseAdminBilling(contract.adminBillingStatsSchema, native.stats);
  assert.equal(stats.timezone, "UTC");
  assert.equal(
    stats.planDistribution.reduce((sum, d) => sum + d.customers, 0),
    stats.paidCustomers,
  );
});
test("native PG list page matches typed contract and exact total", () => {
  page = contract.parseAdminBilling(contract.adminCustomerPageSchema, native.page);
  assert.equal(page.subscriptions.length, 1);
  assert.equal(page.hasMore, page.totalCount > page.pageSize);
});
test("native PG customer detail matches typed contract without raw event metadata", () => {
  detail = contract.parseAdminBilling(contract.adminCustomerSchema, native.detail);
  assert.equal(detail.payments.hasMore, detail.payments.total > detail.payments.pageSize);
  assert.equal(detail.events.hasMore, detail.events.total > detail.events.pageSize);
  assert.ok(!JSON.stringify(detail).includes("patient_name"));
});
test("nonfinite usage and partial stats fail closed rather than returning zero totals", () => {
  assert.throws(
    () => contract.parseAdminBilling(contract.adminBillingStatsSchema, {}),
    /Invalid admin billing response/,
  );
  assert.throws(
    () =>
      contract.parseAdminBilling(contract.adminCustomerSchema, {
        ...native.detail,
        usage: { patients: NaN },
      }),
    /Invalid admin billing response/,
  );
});
test("UTC formatter does not depend on browser local timezone", () => {
  assert.equal(contract.utcDate("2026-01-01T05:30:00+05:30"), "2026-01-01 00:00:00 UTC");
  assert.equal(contract.utcDate("invalid"), "—");
});
function render(file, withDetail = false) {
  const original = Module._load;
  let opened = false;
  const block = ({ children, ...props }) =>
    React.createElement("div", { "data-ui": props.id }, children);
  const button = ({ children, asChild, ...props }) =>
    asChild ? children : React.createElement("button", { disabled: props.disabled }, children);
  Module._load = function (id, parent, main) {
    if (id === "@tanstack/react-router")
      return {
        createFileRoute: () => (options) => options,
        Link: ({ children, to }) => React.createElement("a", { href: to }, children),
      };
    if (id === "@tanstack/react-start")
      return {
        useServerFn: () => () => {
          throw Error("Provider/database transport disabled");
        },
      };
    if (id === "react" && parent?.filename === file)
      return {
        ...React,
        useState: (initial) =>
          React.useState(
            withDetail && !opened && initial === null
              ? ((opened = true), native.detail.clinic.id)
              : initial,
          ),
      };
    if (id === "@tanstack/react-query")
      return {
        useQuery: (options) => ({
          data:
            options.queryKey[0] === "admin-stats"
              ? native.stats
              : options.queryKey[0] === "admin-subscriptions"
                ? native.page
                : native.detail,
          isLoading: false,
          error: null,
          refetch() {},
        }),
        useMutation: () => ({ mutate() {}, isPending: false }),
        useQueryClient: () => ({ invalidateQueries() {} }),
      };
    if (id === "@/lib/subscription-analytics") return contract;
    if (id === "@/lib/admin.functions")
      return new Proxy(
        {},
        {
          get: () => () => {
            throw Error("API unavailable in render fixture");
          },
        },
      );
    if (id.startsWith("@/components/ui/"))
      return new Proxy({}, { get: (_, key) => (key === "Button" ? button : block) });
    if (id === "sonner") return { toast: { success() {}, error() {} } };
    return original.apply(this, arguments);
  };
  try {
    delete require.cache[file];
    return renderToStaticMarkup(React.createElement(require(file).Route.component));
  } finally {
    Module._load = original;
    delete require.cache[file];
  }
}
test("existing dashboard renders factual paid KPIs, distributions and UTC as-of", () => {
  const html = render(path.resolve(__dirname, "../src/routes/_admin/admin.dashboard.tsx"));
  for (const text of [
    "Paid Customers",
    "Trial conversion",
    "Failed payments (30d)",
    "Plan and subscription distribution",
    "UTC",
    "Not checked by read-only dashboard",
  ])
    assert.ok(html.includes(text), text);
  assert.ok(!html.includes("Total volume"));
  assert.ok(!html.includes("Projected annual gross"));
});
test("existing subscription workflows and billing detail render real paged histories without patient lists", () => {
  const html = render(
    path.resolve(__dirname, "../src/routes/_admin/admin.subscriptions.tsx"),
    true,
  );
  for (const text of [
    "Billing details",
    "Edit",
    "Customer filter",
    "Previous payments",
    "Next events",
    "Organization usage",
    "Canonical captured SaaS payments",
    "Trial start",
    "UTC",
    "Open existing clinic administration",
  ])
    assert.ok(html.includes(text), text);
  assert.ok(!html.includes("Patients List"));
  assert.ok(!html.includes("patient_name"));
});
