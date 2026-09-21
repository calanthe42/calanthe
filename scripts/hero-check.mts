/**
 * The travelling hero mark, measured where it fails: on the first paint.
 *
 * Every earlier check looked at the DOCKED state (visual-qa.mjs) or at one
 * viewport. The faults reported from real phones were all at scroll 0 — the
 * mark cropped behind the header, or sitting on the headline — and they
 * were intermittent, because the band was derived from measurements that
 * settle at different times (fonts, Arabic rewrap, the viewport itself).
 *
 * So this measures the resting composition: is the lockup entirely below
 * the header, entirely above the copy, and horizontally centred — on both
 * engines, at every phone height that matters (Safari with its toolbars
 * showing is the short one), in both languages, and SEVERAL TIMES EACH,
 * because a race passes when you run it once.
 *
 * Run:
 *   node scripts/hero-check.mts [base-url] [runs]
 */
import { chromium, webkit, type Browser, type BrowserType } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";
const RUNS = Number(process.argv[3] ?? 3);

/* Heights are the SMALL viewport — what a phone shows with its browser
   chrome expanded, which is the state the page first paints in. */
const VIEWPORTS = [
  { name: "iPhone SE (chrome)", width: 375, height: 553, mobile: true },
  { name: "iPhone SE", width: 375, height: 667, mobile: true },
  { name: "iPhone 13 (chrome)", width: 390, height: 664, mobile: true },
  { name: "iPhone 13", width: 390, height: 844, mobile: true },
  { name: "iPhone 14 Pro Max", width: 430, height: 932, mobile: true },
  { name: "Pixel 7", width: 412, height: 915, mobile: true },
  { name: "iPad portrait", width: 768, height: 1024, mobile: false },
  { name: "laptop", width: 1280, height: 720, mobile: false },
  { name: "desktop", width: 1440, height: 900, mobile: false },
  { name: "short desktop", width: 1440, height: 600, mobile: false },
];
const LOCALES = ["en", "ar"] as const;
/* Breathing room the layout promises between the mark and its neighbours. */
const GAP = 16;

type Reading = {
  preHydration: boolean;
  docked: boolean;
  markTop: number;
  markBottom: number;
  markCentreX: number;
  markWidth: number;
  headerBottom: number;
  copyTop: number;
  viewportW: number;
  viewportH: number;
};

const pass: string[] = [];
const fail: string[] = [];
const check = (ok: boolean, name: string, detail = "") => {
  (ok ? pass : fail).push(`${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) console.log(`  FAIL  ${name}  [${detail}]`);
};

async function measure(browser: Browser, vp: (typeof VIEWPORTS)[number], locale: string): Promise<Reading> {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
    deviceScaleFactor: vp.mobile ? 3 : 1,
    locale: locale === "ar" ? "ar-AE" : "en-AE",
  });
  await context.addCookies([{ name: "calanthe-locale", value: locale, url: BASE }]);
  const page = await context.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "load", timeout: 120_000 });
  /* Fonts and the first frame of the driver; then a beat, because the fault
     was a race and the point is to catch what a person sees, not what an
     instant snapshot sees. */
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);

  const reading = await page.evaluate(() => {
    const mark = document.querySelector<HTMLElement>("[data-travel-mark]")!;
    const header = document.querySelector<HTMLElement>("header")!;
    const copy = document.querySelector<HTMLElement>("[data-hero-copy]")!;
    /* MEASURE WHAT IS ON SCREEN. Before hydration the header's mark is
       hidden (`data-pending`) and the hero's own CSS-laid-out copy is what
       the visitor sees — that state is the point of the design, and on
       Safari it can last seconds. After hydration the header's mark stands
       on the same box. Both are measured, and the stability check below
       demands they agree. */
    const preHydration = mark.dataset.pending !== undefined;
    const art = preHydration
      ? document.querySelector<HTMLElement>("[data-hero-mark-art]")!
      : mark.querySelector<HTMLElement>(".stacked-logo")!;
    const a = art.getBoundingClientRect();
    const h = header.getBoundingClientRect();
    const c = copy.getBoundingClientRect();
    return {
      preHydration,
      docked: preHydration ? a.width < 1 : mark.dataset.travelling !== "true",
      markTop: a.top,
      markBottom: a.bottom,
      markCentreX: a.left + a.width / 2,
      markWidth: a.width,
      headerBottom: h.bottom,
      copyTop: c.top,
      viewportW: window.innerWidth,
      viewportH: window.innerHeight,
    };
  });
  await context.close();
  return reading;
}

const engines: [string, BrowserType][] = [["chromium", chromium], ["webkit", webkit]];

for (const [engineName, engine] of engines) {
  const browser = await engine.launch();
  console.log(`\n${engineName}`);
  for (const vp of VIEWPORTS) {
    for (const locale of LOCALES) {
      const readings: Reading[] = [];
      for (let run = 0; run < RUNS; run += 1) readings.push(await measure(browser, vp, locale));

      const label = `${engineName} ${vp.name} ${vp.width}x${vp.height} ${locale}`;
      const r = readings[0]!;
      const hydrated = readings.filter((x) => !x.preHydration).length;
      const summary = (r.docked
        ? "docked"
        : `mark ${Math.round(r.markTop)}–${Math.round(r.markBottom)}, header→${Math.round(r.headerBottom)}, copy→${Math.round(r.copyTop)}`) +
        (hydrated < RUNS ? `  (${RUNS - hydrated}/${RUNS} read before hydration — same box expected)` : "");
      console.log(`  ${label.padEnd(44)} ${summary}`);

      for (const [i, x] of readings.entries()) {
        const tag = RUNS > 1 ? ` run ${i + 1}` : "";
        if (x.docked) {
          /* Docked is a legitimate outcome on a very short screen: the mark
             must then be INSIDE the header, not stranded somewhere else. */
          check(x.markBottom <= x.headerBottom + 1, `${label}${tag}: docked mark sits inside the header`, `bottom ${Math.round(x.markBottom)} vs header ${Math.round(x.headerBottom)}`);
          continue;
        }
        check(x.markTop >= x.headerBottom + GAP - 1, `${label}${tag}: mark clears the header`, `top ${Math.round(x.markTop)} vs header ${Math.round(x.headerBottom)}`);
        check(x.markBottom <= x.copyTop - GAP + 1, `${label}${tag}: mark clears the copy`, `bottom ${Math.round(x.markBottom)} vs copy ${Math.round(x.copyTop)}`);
        check(x.markBottom <= x.viewportH, `${label}${tag}: mark is on screen`, `bottom ${Math.round(x.markBottom)} vs ${x.viewportH}`);
        check(Math.abs(x.markCentreX - x.viewportW / 2) <= 2, `${label}${tag}: mark is centred`, `dx ${Math.round(x.markCentreX - x.viewportW / 2)}`);
        check(x.markWidth >= 72, `${label}${tag}: mark is not a speck`, `${Math.round(x.markWidth)}px wide`);
      }

      /* THE RACE TEST: identical inputs must give identical output. */
      /* `p` marks a run that was read before hydration: the hero's own art,
         not the header's mark. A spread between a `p` run and a plain run is
         a REAL handoff jump — the two are supposed to occupy the same box. */
      /* A docked run has no meaningful top — pre-hydration the hero's own
         art is hidden on a short screen and reports 0 — so docked compares
         as a STATE. Mixing docked and travelled across runs is the failure;
         so is a travelled top that wanders. */
      const tops = readings.map((x) => `${x.docked ? "docked" : Math.round(x.markTop)}${x.preHydration ? "p" : ""}`);
      const dockedCount = readings.filter((x) => x.docked).length;
      const nums = readings.filter((x) => !x.docked).map((x) => Math.round(x.markTop));
      const spread = nums.length ? Math.max(...nums) - Math.min(...nums) : 0;
      check((dockedCount === 0 || dockedCount === RUNS) && spread <= 2, `${label}: stable across ${RUNS} runs`, `tops ${tops.join("/")}`);
    }
  }
  await browser.close();
}

console.log(`\n${fail.length === 0 ? "ALL PASS" : "FAILURES"}  ${pass.length} passed, ${fail.length} failed`);
process.exit(fail.length === 0 ? 0 : 1);
