// CLIAA-21 runtime QA: public site + booking (375px) + walk-in + dashboard.
// Local dev server + local Supabase only.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || "playwright");

const APP = process.env.APP_URL || "http://localhost:8082";
const EV = process.env.EVIDENCE_DIR || "./qa-evidence";
const PHONE = "+9198765" + String(Date.now()).slice(-5);
const results = [];
const rec = (n, p, d) => {
  results.push([n, p, d]);
  console.log(`${p ? "PASS" : "FAIL"}  ${n} :: ${d}`);
};

const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});

async function page375() {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const p = await ctx.newPage();
  p.setDefaultTimeout(60000);
  p.setDefaultNavigationTimeout(60000);
  const errs = [];
  p.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("data-tsd-source")) errs.push(m.text());
  });
  p.on("pageerror", (e) => errs.push(String(e)));
  return { p, errs, ctx };
}

// ── Flow 7: public site pages at 375px ──
for (const path of ["", "/about", "/services", "/contact"]) {
  const { p, errs, ctx } = await page375();
  const resp = await p.goto(`${APP}/c/sunrise-skin-demo${path}`, {
    waitUntil: "load",
    timeout: 60000,
  });
  await p.waitForTimeout(1500);
  const name = `public${path.replace("/", "-") || "-index"}`;
  await p.screenshot({ path: `${EV}/${name}-375.png`, fullPage: false });
  const body = (await p.textContent("body")) || "";
  const ok = resp.status() === 200 && body.includes("Sunrise") && errs.length === 0;
  rec(
    `public /c/sunrise-skin-demo${path} @375`,
    ok,
    `status=${resp.status()} consoleErrors=${errs.length ? JSON.stringify(errs.slice(0, 2)) : 0}`,
  );
  await ctx.close();
}

// ── Flow 1: booking wizard at 375px ──
{
  const { p, errs, ctx } = await page375();
  await p.goto(`${APP}/c/sunrise-skin-demo/book`, { waitUntil: "networkidle" });
  await p.screenshot({ path: `${EV}/book-step1-375.png` });
  // doctor step (if present)
  const doctorBtn = p.locator("button:has-text('Dr.')").first();
  if (await doctorBtn.count()) {
    await doctorBtn.click();
    await p.locator("button:has-text('Continue')").click();
  }
  // schedule step: pick first date, first slot
  await p.waitForSelector("text=Choose a date");
  await p.locator("div.snap-x button").nth(1).click();
  await p.waitForTimeout(800);
  const slot = p.locator("div.grid button:not([disabled])").first();
  await slot.waitFor({ timeout: 15000 });
  const slotLabel = (await slot.textContent())?.trim();
  await slot.click();
  await p.screenshot({ path: `${EV}/book-step2-375.png` });
  await p.locator("button:has-text('Continue')").click();
  // details step
  await p.getByPlaceholder("e.g. Priya Sharma").fill("QA E2E Rerun");
  await p.getByPlaceholder("+91 98765 43210").fill(PHONE);
  await p.screenshot({ path: `${EV}/book-confirm-375.png` });
  await p.locator("button:has-text('Confirm booking')").click();
  const confirmed = await p
    .waitForSelector("text=/all set|confirmed|Confirmed/i", { timeout: 20000 })
    .catch(() => null);
  await p.waitForTimeout(1000);
  await p.screenshot({ path: `${EV}/book-done-375.png`, fullPage: true });
  rec(
    "booking wizard @375",
    !!confirmed,
    `slot=${slotLabel} phone=${PHONE} confirmed=${!!confirmed} consoleErrors=${errs.length ? JSON.stringify(errs.slice(0, 2)) : 0}`,
  );
  await ctx.close();
}

// ── Flow 2: walk-in at 375px ──
{
  const { p, errs, ctx } = await page375();
  const resp = await p.goto(`${APP}/c/sunrise-skin-demo/walkin`, { waitUntil: "networkidle" });
  await p.screenshot({ path: `${EV}/walkin-375.png`, fullPage: true });
  rec(
    "walkin page @375",
    resp.status() === 200 && errs.length === 0,
    `status=${resp.status()} consoleErrors=${errs.length}`,
  );
  await ctx.close();
}

// ── Flows 3+4: login as demo-clinic owner, verify booking appears once, settings loads ──
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();
  p.setDefaultTimeout(60000);
  p.setDefaultNavigationTimeout(60000);
  const errs = [];
  p.on("console", (m) => {
    if (m.type() === "error") errs.push(m.text());
  });
  await p.goto(`${APP}/login`, { waitUntil: "networkidle" });
  await p.waitForTimeout(2500);
  await p.locator("input[type=email]").fill("qa-owner-a@clinicx.test");
  await p.locator("input[type=password]").fill("QAtest!2345");
  await p.waitForTimeout(2000);
  await p.locator("button[type=submit]").first().click();
  await p.waitForURL(/dashboard/, { timeout: 20000 }).catch(() => {});
  rec("login qa-owner-a", p.url().includes("dashboard"), `landed=${p.url()}`);
  await p.goto(`${APP}/dashboard/appointments`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1500);
  const rows = await p.locator(`text=QA E2E Rerun`).count();
  await p.screenshot({ path: `${EV}/dashboard-appointments.png`, fullPage: true });
  rec(
    "booking visible exactly once in dashboard",
    rows === 1,
    `rows matching 'QA E2E Rerun'=${rows}`,
  );
  await p.goto(`${APP}/dashboard/settings`, { waitUntil: "networkidle" });
  await p.screenshot({ path: `${EV}/dashboard-settings.png`, fullPage: true });
  rec(
    "dashboard settings loads",
    !p.url().includes("login"),
    `url=${p.url()} consoleErrors=${errs.length}`,
  );
  await ctx.close();
}

await browser.close();
const fails = results.filter((r) => !r[1]).length;
console.log(`\n${results.length - fails}/${results.length} passed`);
process.exit(fails ? 1 : 0);
