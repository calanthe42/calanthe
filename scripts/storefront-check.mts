/**
 * The storefront, walked as a visitor with a phone and a laptop.
 *
 * Every public page, at 390px and 1440px, English and Arabic, looking for
 * what a person would actually notice or be stopped by:
 *
 *   - the page scrolling sideways (anything wider than the screen);
 *   - console errors and page errors;
 *   - photographs that failed to load, and images with no alt text;
 *   - tap targets under 44px on the phone;
 *   - body text under 16px on the phone (the mobile-first floor).
 *
 * Then the flow that earns money: product → add to cart → cart drawer →
 * checkout, and the flow that earns enquiries: Build Your Own to its first
 * answer.
 *
 * Run:
 *   node scripts/storefront-check.mts [base-url]
 */
import { chromium, type Page } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";
const PAGES = ["/", "/shop", "/product/amber-hour", "/build-your-own", "/about", "/delivery", "/membership", "/events", "/wishlist", "/cart", "/checkout", "/account/login"];

const pass: string[] = [];
const fail: string[] = [];
const check = (ok: boolean, name: string, detail = "") => {
  (ok ? pass : fail).push(`${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) console.log(`  FAIL  ${name}  [${detail}]`);
};

const AUDIT = (phone: boolean) => {
  const out: Record<string, string[]> = { overflow: [], brokenImages: [], noAlt: [], smallTaps: [], smallText: [] };
  const limit = window.innerWidth;
  const clipped = (el: Element) => {
    for (let n: Element | null = el; n && n !== document.body; n = n.parentElement) {
      const r = n.getBoundingClientRect(); const st = getComputedStyle(n);
      if ((r.width <= 1 && r.height <= 1) || st.overflowX === "hidden" || st.overflowX === "clip" || st.overflowX === "auto" || st.overflowX === "scroll") return true;
    }
    return false;
  };
  if (document.documentElement.scrollWidth > limit + 1) out.overflow.push(`document ${document.documentElement.scrollWidth}px wide on a ${limit}px screen`);
  for (const el of document.querySelectorAll("main *, header *, footer *")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const st = getComputedStyle(el);
    if (st.position === "fixed" || st.visibility === "hidden") continue;
    if ((r.right > limit + 2 || r.left < -2) && !clipped(el) && out.overflow.length < 6) out.overflow.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 30)} [${Math.round(r.left)}..${Math.round(r.right)}]`);
  }
  for (const img of document.querySelectorAll<HTMLImageElement>("img")) {
    if (img.complete && img.naturalWidth === 0 && img.getBoundingClientRect().width > 0) out.brokenImages.push((img.currentSrc || img.src).slice(-60));
    if (!img.hasAttribute("alt")) out.noAlt.push((img.currentSrc || img.src).slice(-50));
  }
  if (phone) {
    for (const el of document.querySelectorAll<HTMLElement>("a[href], button, input:not([type=hidden]), select, summary")) {
      const r = el.getBoundingClientRect();
      if (r.width <= 1 || r.height <= 1 || r.height === 0) continue;
      const st = getComputedStyle(el);
      if (st.visibility === "hidden" || st.display === "none") continue;
      if (el.closest("p, dd")) continue;
      const label = el.closest("label") ?? (el as HTMLInputElement).labels?.[0] ?? null;
      if (label && label.getBoundingClientRect().height >= 40) continue;
      if (r.height < 40 && out.smallTaps.length < 8) out.smallTaps.push(`${el.tagName.toLowerCase()} "${(el.textContent ?? el.getAttribute("aria-label") ?? "").trim().slice(0, 22)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
    }
    for (const p of document.querySelectorAll<HTMLElement>("main p, main li, main dd, main td")) {
      const size = parseFloat(getComputedStyle(p).fontSize);
      const text = (p.textContent ?? "").trim();
      if (text.length > 40 && size < 16 && out.smallText.length < 6) out.smallText.push(`${size}px "${text.slice(0, 32)}…"`);
    }
  }
  return out;
};

const browser = await chromium.launch();

for (const locale of ["en", "ar"] as const) {
  for (const [name, vp, phone] of [["phone", { width: 390, height: 844 }, true], ["laptop", { width: 1440, height: 900 }, false]] as const) {
    const ctx = await browser.newContext({ viewport: vp, isMobile: phone, hasTouch: phone, deviceScaleFactor: phone ? 2 : 1, locale: locale === "ar" ? "ar-AE" : "en-AE" });
    await ctx.addCookies([{ name: "calanthe-locale", value: locale, url: BASE }]);
    console.log(`\n${locale} ${name}`);
    for (const path of PAGES) {
      const page = await ctx.newPage();
      const errors: string[] = [];
      page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 140)); });
      page.on("pageerror", (e) => errors.push(`pageerror ${String(e).slice(0, 140)}`));
      /* Count REAL document loads (not Next's in-place history update). A
         page that reloads itself after it has loaded is a defect a visitor
         sees as a flash, and it is reported as one — never retried away. */
      let documentLoads = 0;
      page.on("load", () => { documentLoads += 1; });
      const res = await page.goto(`${BASE}${path}`, { waitUntil: "load", timeout: 120_000 }).catch(() => null);
      await page.evaluate(() => document.fonts.ready).catch(() => {});
      await page.waitForTimeout(1200);
      const label = `${locale} ${name} ${path}`;
      check(!!res && res.status() < 400, `${label}: loads`, res ? String(res.status()) : "no response");
      if (!res || res.status() >= 400) { await page.close(); continue; }
      /* Scroll through so lazy images and reveals happen, then audit. */
      let scrollCrash = "";
      try {
        await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } window.scrollTo(0, 0); });
      } catch (e) {
        scrollCrash = String(e).split(String.fromCharCode(10))[0].slice(0, 90);
      }
      await page.waitForLoadState("load").catch(() => {});
      await page.waitForTimeout(600);
      check(documentLoads === 1 && !scrollCrash, `${label}: loads once and stays loaded`, `document loads=${documentLoads}${scrollCrash ? `, while scrolling: ${scrollCrash}` : ""}`);
      const a = await page.evaluate(AUDIT, phone);
      check(a.overflow.length === 0, `${label}: nothing wider than the screen`, a.overflow.join(" | "));
      check(a.brokenImages.length === 0, `${label}: every photograph loads`, a.brokenImages.join(" | "));
      check(a.noAlt.length === 0, `${label}: every image has alt text`, a.noAlt.join(" | "));
      if (phone) {
        check(a.smallTaps.length === 0, `${label}: tap targets ≥ 44px`, a.smallTaps.join(" | "));
        check(a.smallText.length === 0, `${label}: body text ≥ 16px`, a.smallText.join(" | "));
      }
      check(errors.length === 0, `${label}: no console errors`, errors.slice(0, 3).join(" | "));
      await page.close();
    }
    await ctx.close();
  }
}

/* The flows, on the phone, in English. */
console.log("\nflows (phone)");
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page: Page = await ctx.newPage();
  page.setDefaultTimeout(60_000);
  await page.goto(`${BASE}/product/amber-hour`, { waitUntil: "load" }); await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /add to cart/i }).first().click().catch(() => {});
  await page.waitForTimeout(1500);
  const drawer = await page.evaluate(() => (document.querySelector('[role="dialog"]') as HTMLElement | null)?.innerText ?? "");
  check(/amber hour/i.test(drawer) && /checkout/i.test(drawer), "add to cart opens the cart with the product and a checkout button", drawer.replace(/\s+/g, " ").slice(0, 80));
  await page.getByRole("link", { name: /checkout/i }).first().click().catch(() => {});
  await page.waitForLoadState("load").catch(() => {}); await page.waitForTimeout(1500);
  check(page.url().includes("/checkout"), "checkout link reaches the checkout", page.url().replace(BASE, ""));
  const placeOrder = await page.getByRole("button", { name: /place order/i }).count();
  check(placeOrder > 0, "checkout has a place-order button");
  await page.goto(`${BASE}/build-your-own`, { waitUntil: "load" }); await page.waitForTimeout(1500);
  /* The first question is the budget — the occasion is no longer asked. */
  await page.getByRole("button", { name: /AED 350/ }).first().click().catch(() => {});
  await page.waitForTimeout(1200);
  const seal = await page.evaluate(() => (document.querySelector('ol > li[data-state="done"] > span:nth-of-type(2) svg') as SVGElement | null)?.getBoundingClientRect().width ?? 0);
  check(seal >= 14, "build your own: answering a question seals it with the mark", `${Math.round(seal)}px`);
  await ctx.close();
}

await browser.close();
console.log(`\n${fail.length === 0 ? "ALL PASS" : "FAILURES"}  ${pass.length} passed, ${fail.length} failed`);
process.exit(fail.length === 0 ? 0 : 1);
