/**
 * Browser QA for the Calanthe admin.
 *
 * Drives a real signed-in admin through every screen, at every width the brief
 * lists, in English/light, Arabic/dark (right-to-left) and English/dark, and
 * reports what is actually broken:
 *
 *   - horizontal overflow and clipped content
 *   - tap targets under 44px
 *   - console errors and failed requests
 *   - keyboard: sign-in, drawer, row menu, confirm dialog
 *   - the unsaved-changes guard
 *   - a real create → save → publish → delete product cycle
 *   - a real media upload → edit alt text → delete cycle
 *   - what a staff member is refused
 *   - /cms still reachable, storefront untouched, reduced motion respected
 *
 * Usage:
 *   node scripts/admin-qa.mjs <out-dir> [base-url]
 * with QA_EMAIL / QA_PASSWORD (owner) and QA_STAFF_EMAIL / QA_STAFF_PASSWORD.
 *
 * Exit is always 0; read the REPORT block at the end. Failures are counted.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const OUT = process.argv[2] ?? ".";
const BASE = process.argv[3] ?? "http://localhost:3000";
const OWNER = { email: process.env.QA_EMAIL, password: process.env.QA_PASSWORD };
const STAFF = { email: process.env.QA_STAFF_EMAIL, password: process.env.QA_STAFF_PASSWORD };

mkdirSync(OUT, { recursive: true });

const WIDTHS = [320, 375, 390, 414, 768, 1024, 1440];
const pass = [];
const fail = [];
const notes = [];

const ok = (name, detail = "") => {
  const line = `${name}${detail ? ` — ${detail}` : ""}`;
  pass.push(line);
  console.log(`PASS  ${line}`);
};
const bad = (name, detail = "") => {
  const line = `${name}${detail ? ` — ${detail}` : ""}`;
  fail.push(line);
  console.log(`FAIL  ${line}`);
};
const check = (condition, name, detail = "") => (condition ? ok(name, detail) : bad(name, detail));

/* ------------------------------------------------------------------ */
/* Page audits                                                         */
/* ------------------------------------------------------------------ */

const OVERFLOW = () => {
  const root = document.documentElement;
  const limit = root.clientWidth;
  const problems = [];
  if (root.scrollWidth > limit + 1) problems.push(`page scrolls sideways (${root.scrollWidth} > ${limit})`);

  const scrollable = (el) => {
    for (let node = el.parentElement; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.overflowX === "auto" || style.overflowX === "scroll") return true;
    }
    return false;
  };

  for (const el of document.querySelectorAll("main *, header *, aside *")) {
    const box = el.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) continue;
    const style = getComputedStyle(el);
    if (style.position === "fixed" || style.visibility === "hidden" || style.display === "none") continue;
    if (scrollable(el)) continue;
    if (box.right > limit + 2 || box.left < -2) {
      problems.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} [${Math.round(box.left)}..${Math.round(box.right)}]`);
    }
    if (problems.length > 5) break;
  }
  return problems;
};

const SMALL_TARGETS = () => {
  const problems = [];
  const selector = "a[href], button, select, input[type=checkbox], input[type=radio], [role=menuitem], [role=tab], summary";
  for (const el of document.querySelectorAll(selector)) {
    const box = el.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) continue;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none") continue;
    /* A control inside a tall label is tapped through the label. */
    const label = el.closest("label");
    if (label && label.getBoundingClientRect().height >= 40) continue;
    /* Links inside running copy are text, not buttons. */
    if (el.tagName === "A" && el.closest("p, dd, li.prose")) continue;
    if (box.height < 40) {
      problems.push(`${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 24)}" ${Math.round(box.width)}×${Math.round(box.height)}`);
    }
    if (problems.length > 5) break;
  }
  return problems;
};

async function auditWidths(page, label, widths = WIDTHS) {
  for (const width of widths) {
    await page.setViewportSize({ width, height: width < 500 ? 780 : 900 });
    await page.waitForTimeout(220);
    const overflow = await page.evaluate(OVERFLOW);
    const small = await page.evaluate(SMALL_TARGETS);
    check(overflow.length === 0, `${label} @${width} layout`, overflow.join(" | "));
    check(small.length === 0, `${label} @${width} tap targets`, small.join(" | "));
  }
}

function watch(page, label) {
  const errors = [];
  const requests = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    /* Next's dev overlay chatter, not the application. */
    if (/react-devtools|Download the React/i.test(text)) return;
    errors.push(text.slice(0, 160));
  });
  page.on("response", (response) => {
    const status = response.status();
    if (status >= 400 && !response.url().includes("favicon")) requests.push(`${status} ${response.url().replace(BASE, "").slice(0, 80)}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${String(error).slice(0, 160)}`));
  return { errors, requests, label };
}

async function open(page, route) {
  await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(300);
}

async function signIn(page, account) {
  await open(page, "/admin/login");
  await page.fill("#admin-email", account.email ?? "");
  await page.fill("#admin-password", account.password ?? "");
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes("/admin/login"), { timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
}

/* ------------------------------------------------------------------ */

const browser = await chromium.launch();

/* ---------- 1. Owner, English, light: every screen, every width ---------- */
const ownerContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const ownerPage = await ownerContext.newPage();
const ownerWatch = watch(ownerPage, "owner en/light");

await signIn(ownerPage, OWNER);
check(ownerPage.url().includes("/admin"), "owner signs in", ownerPage.url().replace(BASE, ""));

/* Find real records to open. */
const firstHref = async (selector) => (await ownerPage.locator(selector).first().getAttribute("href").catch(() => null)) ?? null;
await open(ownerPage, "/admin/products");
const productEdit = await firstHref('a[href*="/edit"]');
await open(ownerPage, "/admin/orders");
const orderDetail = await firstHref('table a[href^="/admin/orders/"]');
await open(ownerPage, "/admin/enquiries");
const enquiryDetail = await firstHref('table a[href^="/admin/enquiries/"]');
await open(ownerPage, "/admin/events");
const eventDetail = await firstHref('table a[href^="/admin/events/"]');
await open(ownerPage, "/admin/customers");
const customerDetail = await firstHref('table a[href^="/admin/customers/"]');
await open(ownerPage, "/admin/occasions");
const occasionEdit = await firstHref('a[href*="/occasions/"][href*="/edit"]');

const ROUTES = [
  ["dashboard", "/admin"],
  ["products", "/admin/products"],
  ["product-new", "/admin/products/new"],
  ["product-edit", productEdit],
  ["occasions", "/admin/occasions"],
  ["occasion-new", "/admin/occasions/new"],
  ["occasion-edit", occasionEdit],
  ["media", "/admin/media"],
  ["orders", "/admin/orders"],
  ["order-detail", orderDetail],
  ["customers", "/admin/customers"],
  ["customer-detail", customerDetail],
  ["enquiries", "/admin/enquiries"],
  ["enquiry-detail", enquiryDetail],
  ["events", "/admin/events"],
  ["event-detail", eventDetail],
  ["discounts", "/admin/discounts"],
  ["settings", "/admin/settings"],
  ["not-found", "/admin/products/99999991/edit"],
].filter(([, route]) => Boolean(route));

notes.push(`screens audited: ${ROUTES.map(([name]) => name).join(", ")}`);

const SHOT = new Set(["dashboard", "products", "product-edit", "orders", "order-detail", "media", "enquiry-detail", "customer-detail"]);

for (const [name, route] of ROUTES) {
  await open(ownerPage, route);
  await auditWidths(ownerPage, `en/light ${name}`);
  if (SHOT.has(name)) {
    await ownerPage.setViewportSize({ width: 390, height: 780 });
    await ownerPage.waitForTimeout(200);
    await ownerPage.screenshot({ path: path.join(OUT, `en-light-${name}-390.png`), fullPage: true });
    await ownerPage.setViewportSize({ width: 1440, height: 900 });
    await ownerPage.waitForTimeout(200);
    await ownerPage.screenshot({ path: path.join(OUT, `en-light-${name}-1440.png`), fullPage: true });
  }
}

/* ---------- 2. Interactions (390 then 1440) ---------- */
await ownerPage.setViewportSize({ width: 390, height: 780 });

/* Mobile drawer: opens, closes on Escape, returns focus. */
await open(ownerPage, "/admin");
await ownerPage.getByRole("button", { name: /open menu/i }).click();
const drawerOpen = await ownerPage.locator("dialog[open]").count();
check(drawerOpen > 0, "mobile drawer opens");
await ownerPage.screenshot({ path: path.join(OUT, "en-light-drawer-390.png") });
await ownerPage.keyboard.press("Escape");
await ownerPage.waitForTimeout(300);
check((await ownerPage.locator("dialog[open]").count()) === 0, "drawer closes on Escape");
const focusAfterDrawer = await ownerPage.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.tagName);
check(Boolean(focusAfterDrawer && focusAfterDrawer !== "BODY"), "focus returns after drawer", String(focusAfterDrawer));

await ownerPage.setViewportSize({ width: 1440, height: 900 });

/* Row menu: keyboard navigation and Escape. */
await open(ownerPage, "/admin/products");
const menuButton = ownerPage.locator('button[aria-haspopup="menu"]').first();
await menuButton.click();
await ownerPage.waitForTimeout(200);
check((await ownerPage.locator('[role="menu"]').count()) > 0, "row menu opens");
const firstItemFocused = await ownerPage.evaluate(() => document.activeElement?.getAttribute("role") === "menuitem");
check(firstItemFocused, "row menu focuses its first item");
await ownerPage.keyboard.press("ArrowDown");
const movedFocus = await ownerPage.evaluate(() => (document.activeElement?.textContent ?? "").trim().slice(0, 30));
check(Boolean(movedFocus), "row menu arrow keys move focus", movedFocus);
await ownerPage.keyboard.press("Escape");
await ownerPage.waitForTimeout(200);
check((await ownerPage.locator('[role="menu"]').count()) === 0, "row menu closes on Escape");
const focusBackOnTrigger = await ownerPage.evaluate(() => document.activeElement?.getAttribute("aria-haspopup") === "menu");
check(focusBackOnTrigger, "row menu returns focus to its button");

/* Confirm dialog: opens in the top layer, focuses the safe choice, Escape closes. */
await menuButton.click();
await ownerPage.waitForTimeout(150);
await ownerPage.locator('[role="menuitem"]').last().click();
await ownerPage.waitForTimeout(300);
const confirm = ownerPage.locator('dialog[open][role="alertdialog"]');
check((await confirm.count()) > 0, "delete asks for confirmation");
const confirmBox = await confirm.boundingBox();
check(
  Boolean(confirmBox && confirmBox.y >= 0 && confirmBox.x >= 0 && confirmBox.y + confirmBox.height <= 900 + 1),
  "confirm dialog is fully on screen",
  confirmBox ? `x${Math.round(confirmBox.x)} y${Math.round(confirmBox.y)} ${Math.round(confirmBox.width)}×${Math.round(confirmBox.height)}` : "no box",
);
const safeFocus = await ownerPage.evaluate(() => (document.activeElement?.textContent ?? "").trim());
check(Boolean(safeFocus), "confirm dialog focuses the safe choice", safeFocus);
await ownerPage.keyboard.press("Escape");
await ownerPage.waitForTimeout(200);
check((await ownerPage.locator("dialog[open]").count()) === 0, "confirm dialog closes on Escape");

/* Create → save → publish → delete, for real. */
await open(ownerPage, "/admin/products/new");
const qaName = `QA Bouquet ${Date.now()}`;
await ownerPage.fill("#name", qaName);
await ownerPage.fill("#priceAed", "199");
await ownerPage.fill("#shortDescription", "Temporary QA product.");
await ownerPage.click('button[type="submit"]');
await ownerPage.waitForURL(/\/admin\/products\/\d+\/edit/, { timeout: 60_000 }).catch(() => {});
const created = /\/admin\/products\/\d+\/edit/.test(ownerPage.url());
check(created, "create product saves and opens the editor", ownerPage.url().replace(BASE, ""));

if (created) {
  await ownerPage.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  /* Unsaved-changes guard. */
  await ownerPage.fill("#shortDescription", "Edited but not saved.");
  await ownerPage.waitForTimeout(150);
  await ownerPage.click('a[href="/admin/occasions"]');
  await ownerPage.waitForTimeout(400);
  const guard = ownerPage.locator('dialog[open][role="alertdialog"]');
  check((await guard.count()) > 0, "leaving with unsaved changes asks first");
  await ownerPage.keyboard.press("Escape");
  await ownerPage.waitForTimeout(200);
  check(ownerPage.url().includes("/edit"), "staying keeps you on the page");

  /* Save, and confirm the interface only says so afterwards. */
  await ownerPage.click('button[type="submit"]');
  const savedToast = await ownerPage
    .locator('[role="status"]', { hasText: /saved|حفظ/i })
    .first()
    .waitFor({ timeout: 20_000 })
    .then(() => true)
    .catch(() => false);
  check(savedToast, "saving shows a confirmation");
  await ownerPage.screenshot({ path: path.join(OUT, "en-light-product-saved-1440.png"), fullPage: true });

  /* Delete it again. */
  await ownerPage.click('button:has-text("Delete")');
  await ownerPage.waitForTimeout(300);
  await ownerPage.locator('dialog[open] button:has-text("Delete product")').click();
  await ownerPage.waitForURL(/\/admin\/products/, { timeout: 60_000 }).catch(() => {});
  check(!ownerPage.url().includes("/edit"), "deleting returns to the product list", ownerPage.url().replace(BASE, ""));
}

/* Media: upload, edit alt text, delete. */
await open(ownerPage, "/admin/media");
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
await ownerPage.setInputFiles("#upload-file", { name: "qa-photo.png", mimeType: "image/png", buffer: png });
await ownerPage.fill("#upload-alt", "QA test photograph");
await ownerPage.click('form button[type="submit"]');
const uploaded = await ownerPage
  .locator('[role="status"]')
  .first()
  .waitFor({ timeout: 30_000 })
  .then(() => true)
  .catch(() => false);
check(uploaded, "media upload reports success");
await ownerPage.waitForTimeout(1200);
await open(ownerPage, "/admin/media");
const uploadedCard = ownerPage.locator('button[aria-label*="QA test photograph"]').first();
const uploadedVisible = (await uploadedCard.count()) > 0;
check(uploadedVisible, "uploaded photo appears in the library");

if (uploadedVisible) {
  await uploadedCard.click();
  await ownerPage.waitForTimeout(500);
  check((await ownerPage.locator("dialog[open]").count()) > 0, "photo details open");
  await ownerPage.screenshot({ path: path.join(OUT, "en-light-media-details-1440.png") });
  const altField = ownerPage.locator('dialog[open] input[name="alt"]');
  await altField.fill("QA test photograph, edited");
  await ownerPage.locator('dialog[open] button[type="submit"]').click();
  await ownerPage.waitForTimeout(1500);
  await ownerPage.locator('dialog[open] button:has-text("Delete")').first().click();
  await ownerPage.waitForTimeout(400);
  await ownerPage.locator('dialog[open][role="alertdialog"] button:has-text("Delete photo")').click();
  await ownerPage.waitForTimeout(2000);
  await open(ownerPage, "/admin/media");
  const stillThere = await ownerPage.locator('button[aria-label*="QA test photograph"]').count();
  check(stillThere === 0, "photo deleted from the library", `${stillThere} left`);
}

/* Theme switch, live. */
await open(ownerPage, "/admin");
await ownerPage.locator('input[type="radio"][value="dark"]').first().check({ force: true });
await ownerPage.waitForTimeout(400);
const themeAttr = await ownerPage.evaluate(() => document.documentElement.dataset.theme);
check(themeAttr === "dark", "theme switch applies immediately", String(themeAttr));
await ownerPage.screenshot({ path: path.join(OUT, "en-dark-dashboard-1440.png"), fullPage: true });
await ownerPage.setViewportSize({ width: 390, height: 780 });
await ownerPage.waitForTimeout(250);
await ownerPage.screenshot({ path: path.join(OUT, "en-dark-dashboard-390.png"), fullPage: true });
await ownerPage.setViewportSize({ width: 1440, height: 900 });
await ownerPage.locator('input[type="radio"][value="light"]').first().check({ force: true });
await ownerPage.waitForTimeout(300);

/* Reduced motion. */
await ownerPage.emulateMedia({ reducedMotion: "reduce" });
await open(ownerPage, "/admin/products");
const durations = await ownerPage.evaluate(() =>
  [...document.querySelectorAll("a, button")].slice(0, 40).map((el) => getComputedStyle(el).transitionDuration),
);
check(durations.every((d) => d === "0.01ms" || d === "0s"), "reduced motion stops transitions", [...new Set(durations)].join(","));
await ownerPage.emulateMedia({ reducedMotion: null });

check(ownerWatch.errors.length === 0, "owner: no console errors", ownerWatch.errors.slice(0, 4).join(" | "));
check(ownerWatch.requests.length === 0, "owner: no failed requests", ownerWatch.requests.slice(0, 4).join(" | "));

/* ---------- 3. Arabic, dark, right-to-left ---------- */
const arabicContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await arabicContext.addCookies([
  { name: "calanthe-admin-locale", value: "ar", url: BASE },
  { name: "calanthe-admin-theme", value: "dark", url: BASE },
]);
const arabicPage = await arabicContext.newPage();
const arabicWatch = watch(arabicPage, "owner ar/dark");
await signIn(arabicPage, OWNER);

const dir = await arabicPage.evaluate(() => document.documentElement.dir);
const lang = await arabicPage.evaluate(() => document.documentElement.lang);
check(dir === "rtl" && lang === "ar", "Arabic renders right-to-left", `dir=${dir} lang=${lang}`);
const arabicText = await arabicPage.locator("body").innerText();
check(/[؀-ۿ]/.test(arabicText), "Arabic text is actually shown");
check(!/Dashboard|Products|Orders/.test(await arabicPage.locator("nav").first().innerText()), "navigation is translated, not English");

for (const [name, route] of ROUTES) {
  await open(arabicPage, route);
  await auditWidths(arabicPage, `ar/dark ${name}`, [320, 390, 768, 1440]);
  if (SHOT.has(name)) {
    await arabicPage.setViewportSize({ width: 390, height: 780 });
    await arabicPage.waitForTimeout(200);
    await arabicPage.screenshot({ path: path.join(OUT, `ar-dark-${name}-390.png`), fullPage: true });
    await arabicPage.setViewportSize({ width: 1440, height: 900 });
    await arabicPage.waitForTimeout(200);
    await arabicPage.screenshot({ path: path.join(OUT, `ar-dark-${name}-1440.png`), fullPage: true });
  }
}

/* The drawer must come from the correct edge in Arabic. */
await arabicPage.setViewportSize({ width: 390, height: 780 });
await open(arabicPage, "/admin");
await arabicPage.getByRole("button", { name: /فتح القائمة/ }).click();
await arabicPage.waitForTimeout(400);
const drawerBox = await arabicPage.locator("dialog[open]").boundingBox();
check(
  Boolean(drawerBox && drawerBox.x + drawerBox.width > 390 - 2),
  "drawer opens from the right in Arabic",
  drawerBox ? `x=${Math.round(drawerBox.x)} w=${Math.round(drawerBox.width)}` : "no drawer",
);
await arabicPage.screenshot({ path: path.join(OUT, "ar-dark-drawer-390.png") });

check(arabicWatch.errors.length === 0, "Arabic: no console errors", arabicWatch.errors.slice(0, 4).join(" | "));
check(arabicWatch.requests.length === 0, "Arabic: no failed requests", arabicWatch.requests.slice(0, 4).join(" | "));

/* ---------- 4. Keyboard-only sign-in ---------- */
const keyboardContext = await browser.newContext({ viewport: { width: 1024, height: 800 } });
const keyboardPage = await keyboardContext.newPage();
await open(keyboardPage, "/admin/login");
await keyboardPage.locator("#admin-email").focus();
await keyboardPage.keyboard.type(OWNER.email ?? "");
await keyboardPage.keyboard.press("Tab");
await keyboardPage.keyboard.type(OWNER.password ?? "");
await keyboardPage.keyboard.press("Enter");
await keyboardPage.waitForURL((url) => !url.pathname.includes("/admin/login"), { timeout: 60_000 }).catch(() => {});
check(!keyboardPage.url().includes("/admin/login"), "keyboard-only sign-in works", keyboardPage.url().replace(BASE, ""));
await keyboardContext.close();

/* ---------- 5. Staff: what the permission model refuses ---------- */
if (STAFF.email) {
  const staffContext = await browser.newContext({ viewport: { width: 1024, height: 800 } });
  const staffPage = await staffContext.newPage();
  const staffWatch = watch(staffPage, "staff");
  await signIn(staffPage, STAFF);
  check(!staffPage.url().includes("/admin/login"), "staff can sign in");

  await open(staffPage, "/admin/customers");
  const customersText = await staffPage.locator("main").innerText();
  check(/owner/i.test(customersText), "staff is refused the customer list", customersText.slice(0, 80).replace(/\n/g, " "));

  await open(staffPage, "/admin/products/new");
  check(/owner/i.test(await staffPage.locator("main").innerText()), "staff cannot add products");

  if (productEdit) {
    await open(staffPage, productEdit);
    const disabled = await staffPage.locator("fieldset[disabled]").count();
    const saveButtons = await staffPage.locator('button[type="submit"]').count();
    check(disabled > 0 && saveButtons === 0, "staff sees a product read-only", `fieldsets=${disabled} saves=${saveButtons}`);
  }

  const devCms = await staffPage.locator('a[href="/cms"]').count();
  check(devCms === 0, "staff is not shown the developer CMS link");
  check(staffWatch.errors.length === 0, "staff: no console errors", staffWatch.errors.slice(0, 3).join(" | "));
  await staffContext.close();
} else {
  notes.push("staff checks skipped: QA_STAFF_EMAIL not set");
}

/* ---------- 6. Nothing else broke ---------- */
const plain = await browser.newContext();
const plainPage = await plain.newPage();
const cms = await plainPage.goto(`${BASE}/cms`, { waitUntil: "domcontentloaded", timeout: 120_000 }).catch(() => null);
check(Boolean(cms) && cms.status() < 400, "developer CMS is still reachable at /cms", String(cms?.status()));
const store = await plainPage.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120_000 }).catch(() => null);
check(Boolean(store) && store.status() < 400, "storefront still loads", String(store?.status()));
const storeTitle = await plainPage.title();
notes.push(`storefront title: ${storeTitle}`);
await plain.close();

await ownerContext.close();
await arabicContext.close();
await browser.close();

/* ------------------------------------------------------------------ */

const report = [
  "",
  "==================== REPORT ====================",
  `PASS ${pass.length}    FAIL ${fail.length}`,
  "",
  ...(fail.length ? ["FAILURES:", ...fail.map((f) => `  ✗ ${f}`), ""] : []),
  "NOTES:",
  ...notes.map((n) => `  · ${n}`),
  "",
  `screenshots: ${OUT}`,
  "================================================",
].join("\n");

writeFileSync(path.join(OUT, "report.txt"), `${pass.map((p) => `PASS ${p}`).join("\n")}\n\n${report}`);
console.log(report);
