import { chromium, webkit, devices } from "playwright";

const OUT = process.argv[2];
const BASE = process.argv[3];

const targets = [
  { name: "desk-1440", engine: chromium, ctx: { viewport: { width: 1440, height: 900 } } },
  { name: "laptop-1280", engine: chromium, ctx: { viewport: { width: 1280, height: 800 } } },
  { name: "tab-768", engine: chromium, ctx: { viewport: { width: 768, height: 1024 } } },
  { name: "sm-414", engine: chromium, ctx: { viewport: { width: 414, height: 896 } } },
  { name: "ios-390", engine: webkit, ctx: { ...devices["iPhone 13"] } },
  { name: "ios-se", engine: webkit, ctx: { viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
];

const issues = [];

for (const t of targets) {
  const browser = await t.engine.launch();
  const ctx = await browser.newContext(t.ctx);
  const page = await ctx.newPage();

  const consoleErrors = [];
  const badRequests = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 120)); });
  page.on("response", (r) => { if (r.status() >= 400) badRequests.push(`${r.status()} ${r.url().slice(0, 70)}`); });

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `${OUT}/qa-${t.name}-hero.png` });

  /* horizontal overflow — the one thing that always looks broken */
  const overflow = await page.evaluate(() => {
    const d = document.documentElement;
    const wide = [];
    document.querySelectorAll("body *").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && (r.right > d.clientWidth + 2 || r.left < -2)) {
        const cs = getComputedStyle(el);
        if (cs.position !== "fixed" && cs.visibility !== "hidden" && cs.overflowX !== "auto" && cs.overflowX !== "scroll") {
          wide.push(`${el.tagName}.${(el.className || "").toString().slice(0, 40)} [${Math.round(r.left)}..${Math.round(r.right)}]`);
        }
      }
    });
    return { docW: d.clientWidth, scrollW: d.scrollWidth, offenders: wide.slice(0, 6) };
  });
  if (overflow.scrollW > overflow.docW + 2) {
    issues.push(`${t.name}: HORIZONTAL OVERFLOW ${overflow.scrollW}>${overflow.docW} :: ${overflow.offenders.join(" | ")}`);
  }

  /* tap-target sizes on small screens */
  if ((t.ctx.viewport?.width ?? 999) < 640) {
    const small = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll("a,button").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.height < 40 && el.offsetParent !== null) {
          out.push(`${el.tagName} "${(el.textContent || "").trim().slice(0, 22)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
        }
      });
      return out.slice(0, 8);
    });
    if (small.length) issues.push(`${t.name}: SMALL TAP TARGETS :: ${small.join(" | ")}`);
  }

  /* scrolled state: docked logo alignment vs the nav row */
  await page.evaluate(() => window.scrollTo(0, window.innerHeight * 0.8));
  await page.waitForTimeout(1600);
  const dock = await page.evaluate(() => {
    const d = document.querySelector(".hero-logo-dock");
    const n = document.querySelector("[data-nav-row]");
    if (!d || !n) return null;
    const a = d.getBoundingClientRect(), b = n.getBoundingClientRect();
    return {
      logoCx: Math.round(a.left + a.width / 2), navCx: Math.round(b.left + b.width / 2),
      logoCy: Math.round(a.top + a.height / 2), navCy: Math.round(b.top + b.height / 2),
      fits: a.height <= b.height + 1,
    };
  });
  if (dock) {
    if (Math.abs(dock.logoCx - dock.navCx) > 2) issues.push(`${t.name}: LOGO NOT H-CENTRED (logo ${dock.logoCx} vs nav ${dock.navCx})`);
    if (Math.abs(dock.logoCy - dock.navCy) > 3) issues.push(`${t.name}: LOGO NOT V-CENTRED (logo ${dock.logoCy} vs nav ${dock.navCy})`);
    if (!dock.fits) issues.push(`${t.name}: LOGO TALLER THAN NAV ROW`);
  }
  await page.screenshot({ path: `${OUT}/qa-${t.name}-docked.png` });

  /* footer */
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${OUT}/qa-${t.name}-footer.png` });

  if (consoleErrors.length) issues.push(`${t.name}: CONSOLE ERRORS :: ${consoleErrors.slice(0, 3).join(" | ")}`);
  if (badRequests.length) issues.push(`${t.name}: FAILED REQUESTS :: ${badRequests.slice(0, 3).join(" | ")}`);

  console.log(`${t.name.padEnd(12)} done  (overflow ${overflow.scrollW}/${overflow.docW})`);
  await browser.close();
}

console.log("\n================ ISSUES ================");
if (!issues.length) console.log("none found");
issues.forEach((i) => console.log("• " + i));
