// CLIAA-21 flow 1 completion: (a) toast visibility on taken-slot error, (b) successful booking on a free slot.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || "playwright");

const APP = process.env.APP_URL || "http://localhost:8082";
const EV = process.env.EVIDENCE_DIR || "./qa-evidence";
const PHONE = "+9198765" + String(Date.now()).slice(-5);

const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});

async function startWizard() {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const p = await ctx.newPage();
  p.setDefaultTimeout(60000);
  await p.goto(`${APP}/c/sunrise-skin-demo/book`, { waitUntil: "networkidle" });
  const doctorBtn = p.locator("button:has-text('Dr.')").first();
  if (await doctorBtn.count()) {
    await doctorBtn.click();
    await p.locator("button:has-text('Continue')").click();
  }
  await p.waitForSelector("text=Choose a date");
  await p.locator("div.snap-x button").nth(1).click();
  await p.waitForTimeout(800);
  return { ctx, p };
}

async function fillAndConfirm(p, name) {
  await p.locator("button:has-text('Continue')").click();
  await p.getByPlaceholder("e.g. Priya Sharma").fill(name);
  await p.getByPlaceholder("+91 98765 43210").fill(PHONE);
  await p.locator("button:has-text('Confirm booking')").click();
}

// (a) taken slot: first enabled slot is 09:30 (known booked). Screenshot at +2.5s to catch the toast.
{
  const { ctx, p } = await startWizard();
  const slot = p.locator("div.grid button:not([disabled])").first();
  await slot.waitFor();
  console.log("taken-slot test picked:", (await slot.textContent())?.trim());
  await slot.click();
  await fillAndConfirm(p, "QA Toast Check");
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${EV}/book-taken-toast-2s.png` });
  const body = (await p.textContent("body")) || "";
  console.log("toast visible at +2.5s:", /just taken|pick another/i.test(body));
  await ctx.close();
}

// (b) free slot: pick the LAST enabled slot of the day (least likely booked).
{
  const { ctx, p } = await startWizard();
  const slots = p.locator("div.grid button:not([disabled])");
  await slots.first().waitFor();
  const n = await slots.count();
  const slot = slots.nth(n - 1);
  const label = (await slot.textContent())?.trim();
  console.log("free-slot test picked:", label, `(of ${n} slots) phone=${PHONE}`);
  await slot.click();
  await fillAndConfirm(p, "QA Success Final");
  const confirmed = await p
    .waitForSelector("text=/all set/i", { timeout: 20000 })
    .catch(() => null);
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${EV}/book-success-375.png`, fullPage: true });
  console.log("confirmed screen shown:", !!confirmed);
  await ctx.close();
}

await browser.close();
console.log("PHONE=" + PHONE);
