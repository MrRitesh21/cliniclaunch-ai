// Debug: capture network + console during booking confirm and login.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || "playwright");

const APP = process.env.APP_URL || "http://localhost:8082";
const EV = process.env.EVIDENCE_DIR || "./qa-evidence";
const PHONE = "+9198765" + String(Date.now()).slice(-5);

const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});

async function instrument(p, tag) {
  p.on("console", (m) => {
    if (["error", "warning"].includes(m.type()))
      console.log(`[${tag} console.${m.type()}]`, m.text().slice(0, 500));
  });
  p.on("pageerror", (e) => console.log(`[${tag} pageerror]`, String(e).slice(0, 500)));
  p.on("requestfailed", (r) =>
    console.log(`[${tag} reqfail]`, r.method(), r.url(), r.failure()?.errorText),
  );
  p.on("response", async (r) => {
    const u = r.url();
    if (
      (u.includes("54321") || u.includes("_serverFn") || u.includes("supabase")) &&
      (r.status() >= 400 || r.request().method() !== "GET")
    ) {
      let body = "";
      try {
        body = (await r.text()).slice(0, 400);
      } catch {}
      console.log(
        `[${tag} net] ${r.request().method()} ${r.status()} ${u.slice(0, 120)} :: ${body}`,
      );
    }
  });
}

// ── booking confirm ──
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const p = await ctx.newPage();
  p.setDefaultTimeout(60000);
  await instrument(p, "book");
  await p.goto(`${APP}/c/sunrise-skin-demo/book`, { waitUntil: "networkidle" });
  const doctorBtn = p.locator("button:has-text('Dr.')").first();
  if (await doctorBtn.count()) {
    await doctorBtn.click();
    await p.locator("button:has-text('Continue')").click();
  }
  await p.waitForSelector("text=Choose a date");
  await p.locator("div.snap-x button").nth(1).click();
  await p.waitForTimeout(800);
  const slot = p.locator("div.grid button:not([disabled])").first();
  await slot.waitFor({ timeout: 15000 });
  await slot.click();
  await p.locator("button:has-text('Continue')").click();
  await p.getByPlaceholder("e.g. Priya Sharma").fill("QA Debug Confirm");
  await p.getByPlaceholder("+91 98765 43210").fill(PHONE);
  console.log("[book] clicking Confirm, phone =", PHONE);
  await p.locator("button:has-text('Confirm booking')").click();
  await p.waitForTimeout(15000);
  await p.screenshot({ path: `${EV}/debug-book-after-confirm.png`, fullPage: true });
  console.log("[book] url after confirm:", p.url());
  await ctx.close();
}

// ── login ──
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();
  p.setDefaultTimeout(60000);
  await instrument(p, "login");
  await p.goto(`${APP}/login`, { waitUntil: "networkidle" });
  await p.waitForTimeout(2000);
  await p.locator("input[type=email]").fill("qa-owner-a@clinicx.test");
  await p.locator("input[type=password]").fill("QAtest!2345");
  await p.locator("button[type=submit]").first().click();
  await p.waitForTimeout(8000);
  await p.screenshot({ path: `${EV}/debug-login-after-submit.png`, fullPage: true });
  console.log("[login] url after submit:", p.url());
  const body = (await p.textContent("body")) || "";
  const err = body.match(/(invalid|error|failed|wrong)[^.]{0,80}/i);
  if (err) console.log("[login] page error text:", err[0]);
  await ctx.close();
}

await browser.close();
