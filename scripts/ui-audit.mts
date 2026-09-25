/**
 * The device audit: every page that takes money, at every size a customer
 * actually holds, checked against the rules in CLAUDE.md rather than against
 * an impression.
 *
 * WHY NOT device-check.mts. That harness answers one question — is anything
 * wider than the screen — on three pages. It passes on a checkout whose
 * "Place order" button is 32px tall, whose prices are set in 13px type, and
 * whose sticky bar sits under the home indicator on every iPhone since the
 * X. Those are the faults that cost an order, and none of them are overflow.
 *
 * WHAT IT CHECKS, per page per device:
 *   overflow     nothing wider than the viewport, and WHICH element if so
 *   tap targets  every interactive element >= 44x44 (CLAUDE.md law)
 *   type size    body text >= 16px (CLAUDE.md law)
 *   safe area    bottom-fixed elements clear the home indicator
 *   images       nothing broken
 *   errors       no page errors, no console errors
 *   screenshot   saved per page per device
 *
 * The device list is real hardware, in CSS pixels, current to 2026. The
 * narrowest entry is a folded Galaxy Z Fold at 344px, which is narrower than
 * any iPhone and the honest floor for a phone-first site; 320px is kept
 * because an iPhone SE 1 still exists in the wild.
 *
 * Run:  node --import ./scripts/register-aliases.mjs scripts/ui-audit.mts [base-url]
 *
 * A developer utility: never imported by the application.
 */
import { chromium, webkit, type Browser, type Page } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3100";
const OUT = process.argv[3] ?? "docs/reports/ui-audit";
const ONLY = process.argv.find((a) => a.startsWith("--only="))?.slice(7);

type Device = {
  name: string;
  w: number;
  h: number;
  dpr: number;
  touch: boolean;
  /** Home-indicator inset, in CSS px. 0 means a physical button or none. */
  bottomInset: number;
  webkit?: boolean;
};

const DEVICES: Device[] = [
  { name: "galaxy-z-fold-folded", w: 344, h: 882, dpr: 3, touch: true, bottomInset: 0 },
  { name: "iphone-se-1", w: 320, h: 568, dpr: 2, touch: true, bottomInset: 0, webkit: true },
  { name: "galaxy-s24", w: 360, h: 780, dpr: 3, touch: true, bottomInset: 0 },
  { name: "iphone-se-2022", w: 375, h: 667, dpr: 2, touch: true, bottomInset: 0, webkit: true },
  { name: "iphone-13-mini", w: 375, h: 812, dpr: 3, touch: true, bottomInset: 34, webkit: true },
  { name: "iphone-14", w: 390, h: 844, dpr: 3, touch: true, bottomInset: 34, webkit: true },
  { name: "iphone-16", w: 393, h: 852, dpr: 3, touch: true, bottomInset: 34, webkit: true },
  { name: "iphone-17-pro", w: 402, h: 874, dpr: 3, touch: true, bottomInset: 34, webkit: true },
  { name: "pixel-8", w: 412, h: 915, dpr: 2.625, touch: true, bottomInset: 0 },
  { name: "iphone-air", w: 420, h: 912, dpr: 3, touch: true, bottomInset: 34, webkit: true },
  { name: "iphone-16-plus", w: 430, h: 932, dpr: 3, touch: true, bottomInset: 34, webkit: true },
  { name: "iphone-17-pro-max", w: 440, h: 956, dpr: 3, touch: true, bottomInset: 34, webkit: true },
  { name: "ipad-mini", w: 744, h: 1133, dpr: 2, touch: true, bottomInset: 20 },
  { name: "ipad-11", w: 834, h: 1194, dpr: 2, touch: true, bottomInset: 20 },
  { name: "ipad-pro-landscape", w: 1366, h: 1024, dpr: 2, touch: true, bottomInset: 20 },
  { name: "laptop", w: 1280, h: 800, dpr: 1, touch: false, bottomInset: 0 },
  { name: "desktop", w: 1440, h: 900, dpr: 1, touch: false, bottomInset: 0 },
  { name: "wide", w: 1920, h: 1080, dpr: 1, touch: false, bottomInset: 0 },
];

const PAGES: { path: string; name: string; needsCart?: boolean }[] = [
  { path: "/", name: "home" },
  { path: "/shop", name: "shop" },
  { path: "/product/amber-hour", name: "product" },
  { path: "/checkout", name: "checkout", needsCart: true },
  { path: "/delivery", name: "delivery" },
  { path: "/build-your-own", name: "build-your-own" },
];

/**
 * Put something in the cart the way a customer does.
 *
 * Injecting localStorage would be quicker and would audit a checkout no
 * customer can reach: it would skip the add-to-cart button, the drawer, and
 * the shape the reducer actually writes. If the real path breaks, this
 * audit should break with it.
 */
async function fillCart(page: Page) {
  await page.goto(`${BASE}/product/amber-hour`, { waitUntil: "load", timeout: 90_000 });
  const add = page.getByRole("button", { name: /add to cart/i }).first();
  await add.waitFor({ state: "visible", timeout: 30_000 });
  await add.click();
  /* addItem opens the drawer; wait for the cart to actually hold something
     rather than for a fixed delay. */
  await page.waitForFunction(
    () => {
      try {
        const raw = localStorage.getItem("calanthe-cart-v1");
        return Boolean(raw && JSON.parse(raw).length > 0);
      } catch {
        return false;
      }
    },
    { timeout: 15_000 },
  );
  await page.keyboard.press("Escape");
  /* Let in-flight chunks finish before navigating away. Without this the
     audit navigates mid-prefetch, the request is aborted, and the resulting
     ChunkLoadError is reported as a fault on the checkout page that the
     harness itself caused. */
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
}

type Finding = {
  device: string;
  width: number;
  engine: string;
  page: string;
  kind: string;
  detail: string;
};

const findings: Finding[] = [];
const add = (d: Device, engine: string, page: string, kind: string, detail: string) =>
  findings.push({ device: d.name, width: d.w, engine, page, kind, detail });

/** Runs inside the page. Returns everything measurable in one round trip. */
const PROBE = `(() => {
  const vw = window.innerWidth;
  const out = { overflow: 0, wide: [], small: [], tiny: [], broken: [], bottomFixed: [] };

  out.overflow = Math.round(document.documentElement.scrollWidth - vw);

  const describe = (el) => {
    const id = el.id ? '#' + el.id : '';
    const cls = typeof el.className === 'string' && el.className
      ? '.' + el.className.trim().split(/\\s+/).slice(0, 3).join('.')
      : '';
    return (el.tagName.toLowerCase() + id + cls).slice(0, 90);
  };

  // Elements that actually stick out past the right edge.
  if (out.overflow > 1) {
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (Math.round(r.right) > vw + 1 || Math.round(r.left) < -1) {
        const s = getComputedStyle(el);
        if (s.position === 'fixed') continue;
        out.wide.push(describe(el) + ' [' + Math.round(r.left) + '..' + Math.round(r.right) + ']');
        if (out.wide.length >= 6) break;
      }
    }
  }

  // Tap targets. Only things a finger is meant to hit, and only if visible.
  const interactive = document.querySelectorAll(
    'a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=checkbox], [role=radio]'
  );
  for (const el of interactive) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) continue;
    // A link inside a paragraph of prose is not a tap target in this sense.
    if (el.tagName === 'A' && el.closest('p') && r.height < 30) continue;

    // A control may extend its own hit area with an absolutely positioned
    // pseudo-element — the header's brand mark does exactly that, and
    // measuring only the box reports 64x43 for something a finger hits at
    // 64x44. Take the larger of the box and its pseudo-elements.
    let h = r.height, w = r.width;
    for (const pseudo of ['::after', '::before']) {
      const ps = getComputedStyle(el, pseudo);
      if (!ps || ps.content === 'none' || ps.position !== 'absolute') continue;
      const ph = parseFloat(ps.height), pw = parseFloat(ps.width);
      if (ph && ph > h) h = ph;
      if (pw && pw > w) w = pw;
    }

    // A small control wrapped in its own label is tapped by the label.
    const lbl = el.closest('label');
    if (lbl && lbl !== el) {
      const lr = lbl.getBoundingClientRect();
      if (lr.height >= 44 && lr.width >= 44) continue;
    }

    if (w < 44 || h < 44) {
      out.small.push(describe(el) + ' ' + Math.round(w) + 'x' + Math.round(h));
      if (out.small.length >= 12) break;
    }
  }

  // Body copy below the 16px floor.
  const textish = document.querySelectorAll('p, li, td, input, label, span, div, button, a');
  const seen = new Set();
  for (const el of textish) {
    const direct = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 12);
    if (!direct) continue;
    const s = getComputedStyle(el);
    const px = parseFloat(s.fontSize);
    if (px && px < 15.5) {
      const k = describe(el) + '@' + px;
      if (seen.has(k)) continue;
      seen.add(k);
      out.tiny.push(k + 'px "' + el.textContent.trim().slice(0, 40) + '"');
      if (out.tiny.length >= 10) break;
    }
  }

  for (const img of document.images) {
    if (img.complete && img.naturalWidth === 0) out.broken.push(img.alt || img.src.slice(-40));
  }

  // Anything pinned to the bottom of the screen, and how close to the edge.
  for (const el of document.querySelectorAll('body *')) {
    const s = getComputedStyle(el);
    if (s.position !== 'fixed' && s.position !== 'sticky') continue;
    const r = el.getBoundingClientRect();
    if (r.height === 0 || r.width < vw * 0.5) continue;
    if (Math.abs(r.bottom - window.innerHeight) > 2) continue;
    // Playwright does not emulate env(safe-area-inset-*), so a correct
    // pb-[max(env(safe-area-inset-bottom),0.75rem)] always COMPUTES to its
    // fallback here. Judging by the computed value alone reports every
    // correctly written sticky bar as broken. Tailwind puts the expression
    // in the class name, so ask whether the author accounted for it.
    const declared = (el.className || '') + ' ' + (el.getAttribute('style') || '');
    out.bottomFixed.push({
      el: describe(el),
      paddingBottom: Math.round(parseFloat(s.paddingBottom) || 0),
      usesEnv: declared.includes('safe-area-inset-bottom'),
    });
  }

  return out;
})()`;

async function auditPage(
  page: Page,
  d: Device,
  engine: string,
  p: { path: string; name: string; needsCart?: boolean },
) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 140)));
  page.on("console", (m) => {
    if (m.type() === "error") {
      const t = m.text();
      /* Next's dev overlay and the placeholder Sentry DSN are noise, not
         defects in the page being audited. */
      if (/Sentry|Download the React DevTools|favicon/i.test(t)) return;
      errors.push(t.slice(0, 140));
    }
  });

  if (p.needsCart) await fillCart(page);

  await page.goto(`${BASE}${p.path}`, { waitUntil: "load", timeout: 90_000 });
  /* Let reveals settle: this site animates on scroll, and a hidden element
     measures as 0x0 and would be reported as a false pass. */
  await page.evaluate(async () => {
    /* Bounded: a long page would otherwise spend a minute scrolling in 500px
       steps, and every reveal on this site fires at 80% of the viewport, so
       larger strides trigger them just as well. */
    const h = document.body.scrollHeight;
    const step = Math.max(600, Math.ceil(h / 12));
    for (let y = 0; y < h; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 40));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(350);

  const r = (await page.evaluate(PROBE)) as {
    overflow: number;
    wide: string[];
    small: string[];
    tiny: string[];
    broken: string[];
    bottomFixed: { el: string; paddingBottom: number; usesEnv: boolean }[];
  };

  if (r.overflow > 1) add(d, engine, p.name, "overflow", `${r.overflow}px — ${r.wide.join(" | ") || "culprit not isolated"}`);
  for (const s of r.small) add(d, engine, p.name, "tap-target", s);
  for (const t of r.tiny) add(d, engine, p.name, "type-too-small", t);
  for (const b of r.broken) add(d, engine, p.name, "broken-image", b);
  for (const e of errors) add(d, engine, p.name, "error", e);

  if (d.bottomInset > 0) {
    for (const bf of r.bottomFixed) {
      if (!bf.usesEnv) {
        add(
          d,
          engine,
          p.name,
          "safe-area",
          `${bf.el} does not account for safe-area-inset-bottom — on this device it would sit under the home indicator (${d.bottomInset}px)`,
        );
      }
    }
  }

  const dir = `${OUT}/${p.name}`;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${d.name}-${engine}.png` });
}

async function run(engine: string, browser: Browser, devices: Device[]) {
  for (const d of devices) {
    const ctx = await browser.newContext({
      viewport: { width: d.w, height: d.h },
      deviceScaleFactor: d.dpr,
      isMobile: d.touch && d.w < 768,
      hasTouch: d.touch,
      locale: "en-AE",
    });
    await ctx.addCookies([{ name: "calanthe-locale", value: "en", url: BASE }]);
    for (const p of PAGES) {
      if (ONLY && p.name !== ONLY) continue;
      const page = await ctx.newPage();
      try {
        await auditPage(page, d, engine, p);
      } catch (e) {
        add(d, engine, p.name, "crash", e instanceof Error ? e.message.split("\n")[0] : String(e));
      }
      await page.close();
    }
    await ctx.close();
    process.stdout.write(`  ${engine} ${d.name} (${d.w}px) done\n`);
  }
}

console.log(`\nUI AUDIT  ${BASE}\n${DEVICES.length} devices x ${PAGES.length} pages, Chromium + WebKit on iPhone sizes\n`);

const cr = await chromium.launch();
await run("chromium", cr, DEVICES);
await cr.close();

const wk = await webkit.launch();
await run("webkit", wk, DEVICES.filter((d) => d.webkit));
await wk.close();

/* Report. Grouped by what is wrong, because a fault repeated on eleven
   devices is one fix, not eleven. */
const byKind = new Map<string, Finding[]>();
for (const f of findings) {
  const k = `${f.kind}::${f.page}::${f.detail}`;
  if (!byKind.has(k)) byKind.set(k, []);
  byKind.get(k)!.push(f);
}

const rows = [...byKind.entries()]
  .map(([k, fs]) => {
    const [kind, page, detail] = k.split("::");
    const widths = [...new Set(fs.map((f) => f.width))].sort((a, b) => a - b);
    return { kind, page, detail, count: fs.length, widths, engines: [...new Set(fs.map((f) => f.engine))] };
  })
  .sort((a, b) => b.count - a.count);

const KIND_ORDER = ["crash", "error", "overflow", "safe-area", "tap-target", "type-too-small", "broken-image"];
rows.sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || b.count - a.count);

let md = `# UI audit — ${new Date().toISOString().slice(0, 10)}\n\n`;
md += `\`${BASE}\` · ${DEVICES.length} device sizes · ${PAGES.length} pages · Chromium + WebKit\n\n`;
md += `**${findings.length} findings**, ${rows.length} distinct.\n\n`;
md += `Screenshots: \`${OUT}/<page>/<device>-<engine>.png\`\n\n`;
for (const kind of KIND_ORDER) {
  const of = rows.filter((r) => r.kind === kind);
  if (of.length === 0) continue;
  md += `## ${kind} (${of.length})\n\n| Page | Detail | Devices | Widths |\n| --- | --- | --- | --- |\n`;
  for (const r of of) {
    md += `| ${r.page} | ${r.detail.replace(/\|/g, "/")} | ${r.count} | ${r.widths.join(", ")} |\n`;
  }
  md += `\n`;
}
if (findings.length === 0) md += `No findings.\n`;

mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/../ui-audit.md`, md);

console.log(`\n${findings.length} findings, ${rows.length} distinct`);
for (const kind of KIND_ORDER) {
  const n = rows.filter((r) => r.kind === kind).length;
  if (n) console.log(`  ${kind.padEnd(16)} ${n} distinct`);
}
console.log(`\nreport: docs/reports/ui-audit.md`);
process.exit(0);
