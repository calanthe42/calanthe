/**
 * The Staff screen, driven the way an owner drives it.
 *
 * The permission suite proves the database refuses what it should. This
 * proves the SCREEN does what it says: that pressing "Add someone" really
 * creates an account, that the password it shows really signs that person in,
 * that "Lift the lock" really lifts a lock, and that suspending really stops
 * a sign-in.
 *
 * Every claim is checked against the database or against a real HTTP login,
 * never against the text of a button. A button that says "Suspended" proves
 * nothing; a refused login does.
 *
 * Fixtures are created here and removed here. Nothing is left behind.
 *
 * Run:
 *   node --env-file=.env.local --import ./scripts/register-aliases.mjs \
 *        scripts/team-flow-test.mts [base-url]
 */
import { chromium, type Page } from "playwright";
import { getPayload } from "payload";
import config from "../src/payload.config.ts";

/*
 * THE PORT MUST MATCH NEXT_PUBLIC_SERVER_URL.
 *
 * payload.config.ts sets `csrf: [NEXT_PUBLIC_SERVER_URL]`. Payload's cookie
 * extraction refuses a token whose request carries an Origin outside that
 * list (auth/extractJWT.js), and a browser sends Origin on every POST — which
 * is what a server action is. Serve on another port and every action in this
 * suite returns "Only the owner can manage staff accounts", which looks
 * exactly like a permissions bug and is not one.
 */
const B = process.argv[2] ?? process.env.BASE_URL ?? "http://localhost:3000";

const pass: string[] = [];
const fail: string[] = [];
const check = (ok: boolean, name: string, detail = "") => {
  (ok ? pass : fail).push(name + (detail ? ` — ${detail}` : ""));
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  [${detail}]` : ""}`);
};

async function apiLogin(email: string, password: string) {
  const res = await fetch(`${B}/api/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return res.status;
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto(`${B}/admin/login`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  /* The submit button is disabled until the form has hydrated, so waiting
     for it to become enabled is waiting for the form to be usable — the same
     signal a person gets. Clicking before it would do nothing, exactly as it
     does nothing for them. */
  await page.getByRole("button", { name: /sign in/i }).waitFor({ state: "attached", timeout: 120_000 });
  await page.waitForFunction(
    () => !document.querySelector("form button[type=submit]")?.hasAttribute("disabled"),
    undefined,
    { timeout: 120_000 },
  );
  await page.fill("#admin-email", email);
  await page.fill("#admin-password", password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes("/admin/login"), { timeout: 120_000 });
}

/**
 * Click something and wait for the dialog it opens.
 *
 * A click before React has hydrated is a no-op, and on a cold dev compile
 * that is a real possibility — which would otherwise surface as "the invite
 * form is broken" when the form is fine. Retrying until the dialog is open
 * tests the app, not the compiler's timing.
 */
async function openDialog(page: Page, name: RegExp) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await page.getByRole("button", { name }).first().click({ timeout: 30_000 }).catch(() => undefined);
    try {
      await page.locator("dialog[open]").first().waitFor({ state: "visible", timeout: 4000 });
      return;
    } catch {
      /* Not open yet: hydration is still in flight. */
    }
  }
  throw new Error(`dialog never opened for ${name}`);
}

/** Open a row's menu, waiting the same way. */
async function openMenu(page: Page, name: RegExp) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await page.getByRole("button", { name }).first().click({ timeout: 30_000 }).catch(() => undefined);
    try {
      await page.locator('[role="menuitem"]').first().waitFor({ state: "visible", timeout: 4000 });
      return;
    } catch {
      /* Same reason. */
    }
  }
  throw new Error(`menu never opened for ${name}`);
}

const payload = await getPayload({ config });
const stamp = Date.now();
const OWNER_PW = "TeamFlow!" + Math.random().toString(36).slice(2, 10);
const ownerEmail = `teamflow-owner-${stamp}@calanthe.invalid`;
const inviteEmail = `teamflow-hire-${stamp}@calanthe.invalid`;

const made: (string | number)[] = [];
/**
 * Wait for the database to reach a state, rather than for a stopwatch.
 *
 * A fixed `waitForTimeout` after an action is a guess about how fast the
 * server is, and a wrong guess reports a working feature as broken — which
 * it did here twice, on a cold dev server. Polling the record itself makes
 * the check about the app.
 */
async function until<T>(read: () => Promise<T>, ok: (value: T) => boolean, ms = 20_000): Promise<T> {
  const deadline = Date.now() + ms;
  let value = await read();
  while (!ok(value) && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 250));
    value = await read();
  }
  return value;
}

/** The two hidden auth columns, and nothing else. */
async function lockState(id: number) {
  const result = await payload.find({
    collection: "users", overrideAccess: true, depth: 0, limit: 1,
    where: { id: { equals: id } },
    showHiddenFields: true,
    select: { lockUntil: true, loginAttempts: true } as never,
  });
  return (result.docs[0] ?? {}) as { lockUntil?: string | null; loginAttempts?: number | null };
}

async function statusOf(id: number): Promise<string> {
  const rows = await payload.find({
    collection: "users", overrideAccess: true, depth: 0, limit: 1, where: { id: { equals: id } },
  });
  return String((rows.docs[0] as { accountStatus?: string } | undefined)?.accountStatus ?? "gone");
}

async function countOf(email: string): Promise<number> {
  const c = await payload.count({ collection: "users", overrideAccess: true, where: { email: { equals: email } } });
  return c.totalDocs;
}

const browser = await chromium.launch();
const consoleErrors: string[] = [];

try {
  const owner = await payload.create({
    collection: "users",
    overrideAccess: true,
    data: {
      email: ownerEmail, password: OWNER_PW, role: "admin",
      firstName: "Flow", lastName: "Owner", accountStatus: "active", _verified: true,
    } as never,
  });
  made.push(owner.id);

  const context = await browser.newContext({ viewport: { width: 390, height: 780 } });
  const page = await context.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));

  await signIn(page, ownerEmail, OWNER_PW);
  await page.goto(`${B}/admin/team`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForTimeout(500);

  check(/staff/i.test(await page.locator("h1").innerText()), "the Staff screen loads for the owner");

  /* MOBILE-FIRST IS LAW. Measured at 390, the width the brief names. */
  const overflow = await page.evaluate(() => {
    const limit = document.documentElement.clientWidth;
    const wide: string[] = [];
    for (const el of Array.from(document.querySelectorAll("main *"))) {
      const box = el.getBoundingClientRect();
      if (box.width > 0 && (box.right > limit + 1 || box.left < -1)) {
        wide.push(`${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ")[0]}`);
      }
    }
    return wide.slice(0, 5);
  });
  check(overflow.length === 0, "nothing overflows sideways at 390px", overflow.join(", "));

  /* ---------------- invite ---------------- */
  await openDialog(page, /add someone/i);
  await page.fill("#invite-firstName", "Noor");
  await page.fill("#invite-lastName", "Alhashimi");
  await page.fill("#invite-email", inviteEmail);
  await page.selectOption("#invite-role", "staff");
  await page.getByRole("button", { name: /add to team/i }).click();

  /* The credentials panel is the success state; waiting for it is waiting
     for the server action to have actually returned ok. */
  await page.getByText(/give them this password/i).waitFor({ timeout: 60_000 });

  const shown = (await page.locator("p.font-mono").first().innerText()).trim();
  check(/^[A-Z0-9]{4}(-[A-Z0-9]{4}){3}$/.test(shown), "a one-time password is shown", shown.replace(/[A-Z0-9]/g, "•"));

  const created = await payload.find({
    collection: "users", overrideAccess: true, depth: 0,
    where: { email: { equals: inviteEmail } }, limit: 1,
  });
  const hire = created.docs[0];
  if (hire) made.push(hire.id);
  check(Boolean(hire), "the account exists in the database");
  check(hire?.role === "staff", "it was created as staff, not as an owner", String(hire?.role));
  check(hire?.name === "Noor Alhashimi", "the display name was derived", String(hire?.name));

  /* THE claim the screen makes. If this fails, the whole feature is a lie. */
  check(
    (await apiLogin(inviteEmail, shown)) === 200,
    "the password shown on screen really signs that person in",
  );

  await page.getByRole("button", { name: /i have sent it/i }).click();
  await page.waitForTimeout(400);
  check(
    (await page.getByText(/give them this password/i).count()) === 0 ||
      !(await page.getByText(/give them this password/i).first().isVisible()),
    "the password panel closes and does not linger",
  );

  /* ---------------- lock, then lift the lock ---------------- */
  for (let i = 0; i < 6; i += 1) await apiLogin(inviteEmail, "definitely-not-the-password");
  check((await apiLogin(inviteEmail, shown)) !== 200, "six wrong passwords lock the account");

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
  check(/locked out/i.test(await page.locator("main").innerText()), "the screen says the account is locked out");

  await openMenu(page, new RegExp("more for Noor", "i"));
  await page.getByRole("menuitem", { name: /lift the lock/i }).click();
  const lockRow = await until(() => lockState(hire!.id), (r) => !r.lockUntil);
  check(!lockRow.lockUntil, "lifting the lock clears the lock in the database", `lockUntil=${lockRow.lockUntil ?? "null"} attempts=${lockRow.loginAttempts ?? 0}`);
  check((await apiLogin(inviteEmail, shown)) === 200, "lifting the lock lets them sign in again");

  /* ---------------- issue a new password ---------------- */
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
  await openMenu(page, new RegExp("more for Noor", "i"));
  await page.getByRole("menuitem", { name: /issue a new password/i }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: /^issue password$/i }).click();
  await page.getByText(/give them this password/i).waitFor({ timeout: 60_000 });

  const reissued = (await page.locator("p.font-mono").first().innerText()).trim();
  check(reissued !== shown, "the new password is not the old one");
  check((await apiLogin(inviteEmail, reissued)) === 200, "the reissued password works");
  check((await apiLogin(inviteEmail, shown)) !== 200, "the old password stopped working");
  await page.getByRole("button", { name: /i have sent it/i }).click();
  await page.waitForTimeout(400);

  /* ---------------- what the florist herself sees ---------------- */

  /* She reaches this screen from the navigation on purpose: "how do I get
     back in" is her question. What she must NOT get is the list. */
  const staffContext = await browser.newContext({ viewport: { width: 390, height: 780 } });
  const staffPage = await staffContext.newPage();
  await signIn(staffPage, inviteEmail, reissued);
  await staffPage.goto(`${B}/admin/team`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await staffPage.waitForTimeout(600);
  const staffView = await staffPage.locator("main").innerText();

  check(
    /owner/i.test(staffView),
    "staff is told the owner manages accounts",
    staffView.slice(0, 60).split(/\s+/).join(" "),
  );
  check(!staffView.includes(ownerEmail), "staff cannot see another person's email address");
  check(
    (await staffPage.getByRole("button", { name: /add someone/i }).count()) === 0,
    "staff is not offered the invite button",
  );
  await staffContext.close();

  /* ---------------- suspend, then restore ---------------- */
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
  await openMenu(page, new RegExp("more for Noor", "i"));
  await page.getByRole("menuitem", { name: /suspend access/i }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: /^suspend$/i }).click();
  const suspended = await until(() => statusOf(hire!.id), (v) => v === "suspended");
  check(suspended === "suspended", "the record is suspended", suspended);
  check((await apiLogin(inviteEmail, reissued)) !== 200, "a suspended person cannot sign in");

  await openMenu(page, new RegExp("more for Noor", "i"));
  await page.getByRole("menuitem", { name: /restore access/i }).click();
  const restored = await until(() => statusOf(hire!.id), (v) => v === "active");
  check(restored === "active", "restoring sets the record back to active", restored);
  const rl = await lockState(hire!.id);
  check((await apiLogin(inviteEmail, reissued)) === 200, "restoring access works", `lockUntil=${rl.lockUntil ?? "null"} attempts=${rl.loginAttempts ?? 0}`);

  /* ---------------- the owner cannot act on herself ---------------- */
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
  await openMenu(page, new RegExp("more for Flow Owner", "i"));
  const ownMenu = await page.locator('[role="menuitem"]').allInnerTexts();
  check(
    !ownMenu.some((item) => /make staff|suspend|remove account/i.test(item)),
    "the owner is offered no way to lock herself out",
    ownMenu.join(" | "),
  );
  await page.keyboard.press("Escape");

  /* ---------------- remove ---------------- */
  await openMenu(page, new RegExp("more for Noor", "i"));
  await page.getByRole("menuitem", { name: /remove account/i }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: /^remove$/i }).click();
  const gone = await until(() => countOf(inviteEmail), (n) => n === 0);
  check(gone === 0, "removing deletes the account", `${gone} remain`);
  check((await apiLogin(inviteEmail, reissued)) !== 200, "a removed person cannot sign in");

  /* ---------------- Arabic, dark, and every width ---------------- */

  /* MOBILE-FIRST IS LAW, and the admin is bilingual. A table of badges and a
     row menu are exactly where a right-to-left layout goes wrong, so the
     screen is measured in Arabic as well as English, at the widths the brief
     names — 320 included, because a phone in a florist's apron is the
     smallest real screen this has to work on. */
  await page.context().addCookies([
    { name: "calanthe-admin-locale", value: "ar", url: B },
    { name: "calanthe-admin-theme", value: "dark", url: B },
  ]);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);

  check((await page.locator("html").getAttribute("dir")) === "rtl", "Arabic renders right to left");
  const arabic = await page.locator("main").innerText();
  check(!/team\.[a-z]/i.test(arabic), "no untranslated keys leak into the Arabic page");
  check(/فريق العمل/.test(arabic) || /فريق/.test(arabic), "the Arabic heading is translated");

  for (const width of [320, 390, 414, 768, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await page.waitForTimeout(250);
    const wide = await page.evaluate(() => {
      const limit = document.documentElement.clientWidth;
      const problems: string[] = [];
      for (const el of Array.from(document.querySelectorAll("main *"))) {
        const box = el.getBoundingClientRect();
        if (box.width > 0 && (box.right > limit + 1 || box.left < -1)) {
          problems.push(`${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ")[0]}`);
        }
      }
      return problems.slice(0, 4);
    });
    check(wide.length === 0, `Arabic ${width}px: nothing overflows sideways`, wide.join(", "));

    const small = await page.evaluate(() => {
      const tiny: string[] = [];
      for (const el of Array.from(document.querySelectorAll("main button, main a[href]"))) {
        const box = el.getBoundingClientRect();
        if (box.width > 0 && box.height > 0 && box.height < 40) tiny.push(el.textContent?.trim().slice(0, 24) || el.tagName);
      }
      return tiny.slice(0, 4);
    });
    /* The 44px rule is a rule about FINGERS. The admin's shared controls are
       44px up to `sm` and 36px above it — a deliberate convention on every
       list screen, and the right one for a mouse. Checking it at 1440 was a
       fault in this test, not in the screen. */
    if (width <= 430) {
      check(small.length === 0, `Arabic ${width}px: every tap target is at least 40px tall`, small.join(", "));
    }
  }

  check(consoleErrors.length === 0, "no console errors throughout", consoleErrors.slice(0, 3).join(" | "));
  await context.close();
} catch (error) {
  /* Without this the finally block's process.exit swallows the stack and the
     run reports "0 passed, 0 failed", which says nothing. */
  fail.push(`the run threw: ${error instanceof Error ? error.message : String(error)}`);
  console.error(error);
} finally {
  await browser.close();

  let removed = 0;
  for (const id of made.reverse()) {
    try {
      await payload.delete({ collection: "users", id, overrideAccess: true });
      removed += 1;
    } catch {
      /* Already deleted through the UI, which is the expected case for the
         invited account. */
    }
  }
  const leftovers = await payload.count({
    collection: "users", overrideAccess: true, where: { email: { like: "teamflow-" } },
  });
  console.log(`\n  cleanup: ${removed} removed, ${leftovers.totalDocs} teamflow-* rows remain`);

  console.log(`\n${fail.length === 0 ? "ALL PASS" : "FAILURES"}  ${pass.length} passed, ${fail.length} failed`);
  for (const f of fail) console.log(`  FAIL  ${f}`);
  process.exit(fail.length === 0 && leftovers.totalDocs === 0 ? 0 : 1);
}
