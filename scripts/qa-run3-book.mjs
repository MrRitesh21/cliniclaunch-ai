// CLIAA-21: single booking attempt with full network capture + DB-side verification hints.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || "playwright");

const APP = process.env.APP_URL || "http://localhost:8082";
const EV = process.env.EVIDENCE_DIR || "./qa-evidence";
const PHONE = "+9198765" + String(Date.now()).slice(-5);
const NAME = "QA Run3 " + String(Date.now()).slice(-6);

const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
const p = await ctx.newPage();
p.setDefaultTimeout(45000);
p.on("console", (m) => {
  if (m.type() === "error") console.log("[console.error]", m.text().slice(0, 300));
});
p.on("response", async (r) => {
  const u = r.url();
  if (u.includes("54321") || u.includes("_serverFn") || u.includes("createServerFn") || u.includes("/_server")) {
    let body = "";
    try { body = (await r.text()).slice(0, 500); } catch {}
    console.log(`[net] ${r.request().method()} ${r.status()} ${u.slice(0, 140)}\n      ${body.replace(/\n/g, " ")}`);
  }
});

await p.goto(`${APP}/c/sunrise-skin-demo/book`, { waitUntil: "networkidle" });
await p.waitForTimeout(2000); // let hydration settle before interacting

const doctorBtn = p.locator("button:has-text('Dr.')").first();
if (await doctorBtn.count()) {
  await doctorBtn.click();
  await p.locator("button:has-text('Continue')").click();
}
await p.waitForSelector("text=Choose a date");
await p.locator("div.snap-x button").nth(2).click(); // day after tomorrow, fewer collisions
await p.waitForTimeout(1200);
const slots = p.locator("div.grid button:not([disabled])");
await slots.first().waitFor();
const n = await slots.count();
const slot = slots.nth(n - 2 >= 0 ? n - 2 : 0);
const label = (await slot.textContent())?.trim();
console.log(`picking slot "${label}" of ${n}; name=${NAME} phone=${PHONE}`);
await slot.click();
await p.waitForTimeout(500);
await p.locator("button:has-text('Continue')").click();
await p.getByPlaceholder("e.g. Priya Sharma").fill(NAME);
await p.getByPlaceholder("+91 98765 43210").fill(PHONE);
await p.waitForTimeout(300);
await p.screenshot({ path: `${EV}/run3-before-confirm.png` });
await p.locator("button:has-text('Confirm booking')").click();
const confirmed = await p
  .waitForSelector("text=/all set|confirmed/i", { timeout: 25000 })
  .catch(() => null);
await p.waitForTimeout(1000);
await p.screenshot({ path: `${EV}/run3-after-confirm.png`, fullPage: true });
console.log("confirmed screen:", !!confirmed, "| url:", p.url());
console.log("NAME=" + NAME, "PHONE=" + PHONE);
await ctx.close();
await browser.close();
