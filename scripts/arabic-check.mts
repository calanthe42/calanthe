/**
 * The Arabic site, as a phone renders it.
 *
 * WHY THIS EXISTS. scripts/untranslated.mts reads source files, and it has
 * blind spots it cannot close: text read from a data object
 * (`{VIDEO_APPROVAL.title}`), text passed through a prop it does not know,
 * text a server action returns at runtime. The Arabic reader does not see
 * source files — she sees the rendered page. So this opens every storefront
 * page in Arabic, at the phone widths the project designs for, and reports:
 *
 *   - any English words in the rendered text, minus the names that are meant
 *     to stay Latin (the brand, AED, WhatsApp) and the product names, which
 *     the owner types in /admin in whichever language she chooses;
 *   - horizontal overflow (Arabic words are longer; a chip that fit "Mon"
 *     may not fit "الاثنين");
 *   - page errors;
 *   - whether the page is right-to-left at all.
 *
 * It only reads. It adds one arrangement to a browser-side cart so the
 * checkout form can be seen, and never submits anything.
 *
 * Run:  node scripts/arabic-check.mts [base-url]
 */
import { mkdirSync } from "node:fs";
import { chromium, webkit, type Page } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = process.env.SHOTS_DIR;
const WIDTHS = [
  { name: "iPhone 14", w: 390, h: 844 },
  { name: "iPhone SE", w: 320, h: 568 },
];

/* Latin that is meant to be there. */
const ALLOWED = /\b(AED|WhatsApp|Instagram|Calanthe|CALANTHE|kalos|anthos|C|you@example\.com|Four Seasons|Google|Tabby|JPEG|PNG|WebP|AVIF)\b/g;

async function settle(page: Page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 40));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(500);
}

async function inspect(page: Page, productNames: string[]) {
  return page.evaluate(
    ({ allowed, names }) => {
      let text = document.body.innerText;
      for (const n of names) text = text.split(n).join(" ");
      text = text.replace(new RegExp(allowed, "g"), " ");
      text = text.replace(/\S+@\S+\.\S+/g, " "); // email addresses
      text = text.replace(/https?:\/\/\S+/g, " ");
      const english = [...new Set(text.match(/[A-Za-z][A-Za-z'’-]{2,}(?:\s+[A-Za-z][A-Za-z'’-]+)*/g) ?? [])];
      return {
        english,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        dir: document.documentElement.dir,
      };
    },
    { allowed: ALLOWED.source, names: productNames },
  );
}

const results: string[] = [];
let problems = 0;

for (const [engineName, engine] of [["chromium", chromium], ["webkit", webkit]] as const) {
  const browser = await engine.launch();
  for (const d of WIDTHS) {
    const ctx = await browser.newContext({
      viewport: { width: d.w, height: d.h },
      isMobile: engineName === "chromium",
      hasTouch: true,
      locale: "ar-AE",
    });
    await ctx.addCookies([{ name: "calanthe-locale", value: "ar", url: BASE }]);
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 140)));

    /* Real product and occasion links, and the names the owner typed. */
    await page.goto(`${BASE}/shop`, { waitUntil: "load", timeout: 120_000 });
    const productPath = await page.getAttribute('a[href^="/product/"]', "href");
    const productNames = await page.$$eval("article h3", (hs) => hs.map((h) => h.textContent?.trim() ?? "").filter(Boolean));
    await page.goto(`${BASE}/occasions`, { waitUntil: "load" });
    const occasionPath = await page.getAttribute('a[href^="/occasions/"]', "href");

    const paths = [
      "/", "/shop", "/occasions", occasionPath, productPath, "/checkout",
      "/about", "/events", "/membership", "/faqs", "/delivery", "/build-your-own",
      "/wishlist", "/account", "/account/login", "/account/register",
      "/account/forgot-password", "/terms", "/privacy", "/refund-policy", "/no-such-page",
    ].filter((p): p is string => Boolean(p));

    for (const path of paths) {
      errors.length = 0;
      if (path === "/checkout" && productPath) {
        /* Put one arrangement in the cart, client-side only, so the whole
           checkout form renders instead of the empty-cart screen. */
        await page.goto(`${BASE}${productPath}`, { waitUntil: "load" });
        const add = page.locator("button", { hasText: "أضيفي إلى السلة" }).last();
        if (await add.count()) await add.click().catch(() => undefined);
        await page.waitForTimeout(600);
      }
      await page.goto(`${BASE}${path}`, { waitUntil: "load", timeout: 120_000 });
      await settle(page);
      const r = await inspect(page, productNames);
      if (SHOTS && d.w === 390 && engineName === "chromium") {
        mkdirSync(SHOTS, { recursive: true });
        const file = `${SHOTS}/${path.replace(/[^a-z0-9]+/gi, "_") || "home"}.png`;
        await page.screenshot({ path: file, fullPage: true });
      }
      const bad = r.english.length > 0 || r.overflow > 1 || errors.length > 0 || r.dir !== "rtl";
      if (bad) problems += 1;
      if (bad || engineName === "chromium") {
        results.push(
          `${bad ? "FAIL" : "ok  "} ${engineName.padEnd(8)} ${String(d.w).padStart(3)}px ${path}` +
            (r.dir !== "rtl" ? `  dir=${r.dir}` : "") +
            (r.overflow > 1 ? `  overflow=${r.overflow}px` : "") +
            (errors.length ? `  errors=${JSON.stringify(errors)}` : "") +
            (r.english.length ? `\n        english: ${JSON.stringify(r.english)}` : ""),
        );
      }
    }
    await ctx.close();
  }
  await browser.close();
}

console.log(results.join("\n"));
console.log(`\n${problems === 0 ? "ALL CLEAN" : `${problems} page loads with problems`}`);
process.exit(problems ? 1 : 0);
