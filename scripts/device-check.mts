/**
 * Every new page at eight device sizes, on Chromium and WebKit, in English
 * and Arabic: nothing wider than the screen, every brand photograph loaded,
 * no page errors.
 *
 * Run:  node scripts/device-check.mts [base-url]
 */
import { chromium, webkit } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";
const OUT = "C:/Users/nhatt/AppData/Local/Temp/claude/c--dev-calanthe/a9715b0e-0b80-4648-97e4-927ed7789949/scratchpad/devices";
const DEVICES = [
  { name: "iPhone SE", w: 320, h: 568, mobile: true },
  { name: "iPhone 13 mini", w: 375, h: 812, mobile: true },
  { name: "iPhone 14", w: 390, h: 844, mobile: true },
  { name: "iPhone Pro Max", w: 430, h: 932, mobile: true },
  { name: "iPad", w: 768, h: 1024, mobile: true },
  { name: "iPad landscape", w: 1024, h: 768, mobile: false },
  { name: "laptop", w: 1280, h: 800, mobile: false },
  { name: "desktop", w: 1440, h: 900, mobile: false },
];
const PAGES = ["/", "/about", "/build-your-own"];

let fails = 0;
for (const [engineName, engine] of [["chromium", chromium], ["webkit", webkit]] as const) {
  const browser = await engine.launch();
  for (const d of DEVICES) {
    for (const locale of ["en", "ar"]) {
      const ctx = await browser.newContext({ viewport: { width: d.w, height: d.h }, isMobile: d.mobile && d.w < 768, hasTouch: d.mobile, deviceScaleFactor: 1, locale: locale === "ar" ? "ar-AE" : "en-AE" });
      await ctx.addCookies([{ name: "calanthe-locale", value: locale, url: BASE }]);
      for (const path of PAGES) {
        const page = await ctx.newPage();
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(String(e).slice(0, 120)));
        await page.goto(`${BASE}${path}`, { waitUntil: "load", timeout: 120_000 });
        await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 50)); } window.scrollTo(0, 0); });
        await page.waitForTimeout(700);
        const r = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth - window.innerWidth,
          broken: [...document.querySelectorAll<HTMLImageElement>('img[src*="brand"], img[srcset*="brand"]')].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.alt.slice(0, 30)),
          brandImages: [...document.querySelectorAll<HTMLImageElement>('img[src*="brand"], img[srcset*="brand"]')].filter((i) => i.naturalWidth > 0).length,
        }));
        const ok = r.overflow <= 1 && r.broken.length === 0 && errors.length === 0;
        if (!ok) fails += 1;
        if (!ok) console.log(`  FAIL ${engineName} ${d.name} ${d.w}px ${locale} ${path}  overflow=${r.overflow}px broken=${JSON.stringify(r.broken)} errors=${errors.length}`);
        await page.close();
      }
      await ctx.close();
    }
  }
  await browser.close();
}
console.log(`\n${fails === 0 ? "ALL PASS" : `FAILURES ${fails}`} — ${2 * DEVICES.length * 2 * PAGES.length} page loads (2 engines × ${DEVICES.length} devices × 2 languages × ${PAGES.length} pages)`);
process.exit(fails ? 1 : 0);
