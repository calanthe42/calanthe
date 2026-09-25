/**
 * The A2 proof: not "sent", but DELIVERED.
 *
 * "Sent" only means Resend accepted the request. Whether it reached an inbox
 * is a separate fact that only the provider can state, so every message id
 * this run produces is looked up in Resend's API afterwards and its status
 * printed. A green run here is evidence; the owner opening the inbox is the
 * confirmation.
 *
 * WHAT IT DRIVES, through the real UI wherever there is one:
 *   1 register            -> verification email
 *   2 verify              -> the account becomes usable
 *   3 COD order           -> customer confirmation + owner + florist
 *   4 password reset      -> reset email
 *   5 status change       -> "being made" email
 *
 * Run against a PREVIEW database with a real Resend key. Never production.
 *
 *   node --env-file=<proof env> --import ./scripts/register-aliases.mjs \
 *        scripts/prove-email-delivery.mts [base-url]
 *
 * A developer utility: never imported by the application.
 */
import { chromium, type Page } from "playwright";
import { getPayload } from "payload";
import config from "../src/payload.config.ts";

const BASE = process.argv[2] ?? "http://localhost:3100";
const CUSTOMER = process.env.PROOF_EMAIL ?? "nettt420@gmail.com";
const PASSWORD = "Calanthe-Proof-2026!";

type Pool = { query: (s: string, p?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> };

const payload = await getPayload({ config });
const pool = (payload.db as unknown as { pool: Pool }).pool;

const host = (process.env.DATABASE_URL ?? "").replace(/^postgres(ql)?:\/\/[^@]*@/, "").split("/")[0];
if (/ep-round-art/.test(host)) {
  console.error("REFUSING: that is the production branch.");
  process.exit(2);
}

const step = (n: number, what: string) => console.log(`\n${"—".repeat(58)}\n${n}. ${what}\n`);
const since = new Date();

console.log(`database : ${host}`);
console.log(`base     : ${BASE}`);
console.log(`customer : ${CUSTOMER}`);
console.log(`env      : VERCEL_ENV=${process.env.VERCEL_ENV ?? "(unset)"}  allowlist=${process.env.EMAIL_ALLOWLIST ?? "(unset)"}`);

/* A previous run leaves an account behind; the proof needs a fresh one. */
await pool.query(`delete from users where email = $1`, [CUSTOMER]).catch(() => {});

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
const page: Page = await ctx.newPage();

async function fillByLabel(p: Page, label: RegExp, value: string) {
  await p.getByLabel(label).first().fill(value);
}

/* ---------------------------------------------------------------- 1 */
step(1, "Register through the real form");
await page.goto(`${BASE}/account/register`, { waitUntil: "load", timeout: 60_000 });
await fillByLabel(page, /name/i, "Calanthe Proof");
await fillByLabel(page, /email/i, CUSTOMER);
const phone = page.getByLabel(/phone/i).first();
if (await phone.count()) await phone.fill("+971500000000");
const pw = page.getByLabel(/^password/i).first();
await pw.fill(PASSWORD);
const confirm = page.getByLabel(/confirm/i).first();
if (await confirm.count()) await confirm.fill(PASSWORD);
await page.getByRole("button", { name: /create|register|sign up/i }).first().click();
await page.waitForTimeout(6000);
console.log(`   registered; page now: ${page.url()}`);

/* ---------------------------------------------------------------- 2 */
step(2, "Verify, using the token Payload stored");
const { rows: userRows } = await pool.query(
  `select id, _verified, _verificationtoken from users where email = $1`,
  [CUSTOMER],
);
const user = userRows[0];
if (!user) {
  console.error("   the account was not created — cannot continue");
  process.exit(1);
}
const token = user._verificationtoken ? String(user._verificationtoken) : null;
console.log(`   account id ${user.id}, verified=${user._verified}, token=${token ? "present" : "MISSING"}`);
if (token) {
  await page.goto(`${BASE}/account/verify?token=${token}`, { waitUntil: "load", timeout: 60_000 });
  await page.waitForTimeout(2500);
  const { rows: after } = await pool.query(`select _verified from users where email = $1`, [CUSTOMER]);
  console.log(`   verified now: ${after[0]?._verified}`);
}

/* ---------------------------------------------------------------- 3 */
step(3, "Place a cash-on-delivery order");
await page.goto(`${BASE}/account/login`, { waitUntil: "load" });
await fillByLabel(page, /email/i, CUSTOMER);
await fillByLabel(page, /password/i, PASSWORD);
await page.getByRole("button", { name: /sign in|log in/i }).first().click();
await page.waitForTimeout(4000);

await page.goto(`${BASE}/shop`, { waitUntil: "load" });
await page.locator('a[href^="/product/"]').first().click();
await page.waitForLoadState("load");
await page.getByRole("button", { name: /add to cart/i }).first().click();
await page.waitForSelector("aside[role=dialog]", { timeout: 15_000 });
await page.keyboard.press("Escape");

await page.goto(`${BASE}/checkout`, { waitUntil: "load" });
await page.waitForTimeout(1500);
await page.selectOption("#zone", "dubai").catch(() => {});
await page.locator("#address").fill("Villa 12, Al Barsha 2, near the mosque");
await page.locator("#name").fill("Calanthe Proof");
await page.locator("#phone").fill("+971500000000");
await page.locator("#email").fill(CUSTOMER);
const recName = page.locator("#rec-name");
if (await recName.count()) await recName.fill("Proof Recipient");
await page.getByRole("button", { name: /place order/i }).first().click();
await page.waitForTimeout(9000);
const { rows: orderRows } = await pool.query(
  `select id, order_number, customer_email, fulfilment_status from orders order by created_at desc limit 1`,
);
const order = orderRows[0];
console.log(`   order: ${order ? `${order.order_number} for ${order.customer_email}` : "NOT CREATED"}`);

/* ---------------------------------------------------------------- 4 */
step(4, "Request a password reset");
await page.goto(`${BASE}/account/forgot-password`, { waitUntil: "load" });
await fillByLabel(page, /email/i, CUSTOMER);
await page.getByRole("button", { name: /send|reset|continue/i }).first().click();
await page.waitForTimeout(6000);
console.log("   requested");

/* ---------------------------------------------------------------- 5 */
step(5, "Move the order to Preparing");
if (order) {
  await payload.update({
    collection: "orders",
    id: Number(order.id),
    data: { fulfilmentStatus: "PREPARING" } as never,
    overrideAccess: true,
  });
  await new Promise((r) => setTimeout(r, 4000));
  console.log("   status changed to PREPARING");
}

await browser.close();

/* ---------------------------------------------------------------- */
step(6, "What the email log recorded");
const { rows: logs } = await pool.query(
  `select id, "to", type, status, subject, provider_id, error, created_at
     from email_log where created_at >= $1 order by created_at asc`,
  [since.toISOString()],
);
if (logs.length === 0) console.log("   NOTHING WAS LOGGED — that is a failure in itself");
for (const l of logs) {
  console.log(
    `   ${String(l.status).padEnd(10)} ${String(l.type).padEnd(20)} -> ${String(l.to).padEnd(24)} ${
      l.provider_id ? String(l.provider_id) : (l.error ? `(${String(l.error).slice(0, 60)})` : "")
    }`,
  );
}

/* ---------------------------------------------------------------- */
step(7, "What RESEND says — delivered, or not");
const key = process.env.RESEND_API_KEY;
let delivered = 0;
let checked = 0;
if (!key) {
  console.log("   no RESEND_API_KEY — cannot confirm delivery");
} else {
  for (const l of logs) {
    if (!l.provider_id) continue;
    checked += 1;
    /* Resend updates status asynchronously; give it a moment on the first
       look and retry once rather than reporting a premature "queued". */
    let data: Record<string, unknown> | null = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const r = await fetch(`https://api.resend.com/emails/${String(l.provider_id)}`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      data = (await r.json().catch(() => null)) as Record<string, unknown> | null;
      if (data && String(data.last_event ?? "") === "delivered") break;
      await new Promise((r2) => setTimeout(r2, 5000));
    }
    const event = String(data?.last_event ?? "unknown");
    if (event === "delivered") delivered += 1;
    console.log(
      `   ${event.padEnd(12)} ${String(l.type).padEnd(20)} ${String(l.to).padEnd(24)} id=${String(l.provider_id)}`,
    );
  }
}

console.log(`\n${"—".repeat(58)}`);
console.log(`${delivered} of ${checked} confirmed DELIVERED by Resend.`);
console.log(
  logs.some((l) => l.status === "failed")
    ? "Some emails FAILED — see the log above."
    : "No failures in the log.",
);
process.exit(0);
