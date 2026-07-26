// CLIAA-21 flow 2 retry: walk-in with slots available (local clinic hours extended for QA).
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || "playwright");

const APP = process.env.APP_URL || "http://localhost:8082";
const EV = process.env.EVIDENCE_DIR || "./qa-evidence";
const WPHONE = "+9198764" + String(Date.now()).slice(-5);

const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
const p = await ctx.newPage();
p.setDefaultTimeout(45000);
p.on("console", (m) => {
  if (m.type() === "error") console.log("[console.error]", m.text().slice(0, 200));
});

await p.goto(`${APP}/c/sunrise-skin-demo/walkin`, { waitUntil: "networkidle" });
await p.waitForTimeout(2500);
await p.screenshot({ path: `${EV}/walkin-slots-375.png`, fullPage: true });

// pick first available slot
const slotBtn = p.locator("button:has-text(':')").first();
if (await slotBtn.count()) {
  console.log("slot picked:", (await slotBtn.textContent())?.trim());
  await slotBtn.click();
  await p.waitForTimeout(800);
}
const inputs = await p.locator("input:visible").count();
console.log("visible inputs after slot pick:", inputs);
if (inputs >= 2) {
  await p.locator("input:visible").nth(0).fill("QA Walkin Run3");
  await p.locator("input:visible").nth(1).fill(WPHONE);
  await p.screenshot({ path: `${EV}/walkin-filled-375.png`, fullPage: true });
  const btn = p
    .locator("button[type=submit], button:has-text('Confirm'), button:has-text('Check'), button:has-text('Book')")
    .first();
  console.log("submit button:", (await btn.textContent())?.trim());
  await btn.click();
  await p.waitForTimeout(5000);
  await p.screenshot({ path: `${EV}/walkin-confirmed-375.png`, fullPage: true });
  const body = (await p.textContent("body")) || "";
  console.log("confirmed:", /confirmed|all set|see you|token|queue/i.test(body));
}
console.log("WPHONE=" + WPHONE);
await ctx.close();
await browser.close();
