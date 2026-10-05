/**
 * Probes for the money guard (migration 20261006_000000_orders_money_guard).
 *
 * Tries, against a real Postgres, to push a paid order backwards — the way a
 * stale whole-row write would — and checks that the trigger puts every money
 * column back; then walks the legitimate transitions and checks they still
 * pass. EVERYTHING RUNS INSIDE ONE TRANSACTION THAT IS ROLLED BACK: the
 * database is left exactly as it was.
 *
 *   npx tsx --env-file=.env.local scripts/money-guard-probe.mts <host-fragment>
 *
 * SAFETY. It refuses to run unless DATABASE_URL contains the host fragment
 * you pass — name the TEST database's host, never production's.
 *
 * A developer utility: never imported by the application.
 */
import { sql } from "@payloadcms/db-postgres";
import { getPayload } from "payload";
import config from "../src/payload.config.ts";

const expectedHost = process.argv[2] ?? "";
const url = process.env.DATABASE_URL ?? "";
if (!expectedHost || !url.includes(expectedHost)) {
  console.error("refusing: pass the TEST database's host fragment; DATABASE_URL does not contain it");
  process.exit(1);
}

type Row = Record<string, unknown>;
type Tx = { execute: (query: unknown) => Promise<unknown> };
const rowsOf = (result: unknown): Row[] =>
  Array.isArray(result) ? (result as Row[]) : (((result as { rows?: Row[] })?.rows ?? []) as Row[]);

const payload = await getPayload({ config });
const drizzle = (payload.db as unknown as { drizzle: { transaction: (fn: (tx: Tx) => Promise<void>) => Promise<void> } })
  .drizzle;

const results: { probe: string; pass: boolean; detail?: string }[] = [];
const check = (probe: string, pass: boolean, detail?: string) => results.push({ probe, pass, ...(pass ? {} : { detail }) });
const MONEY = sql`payment_status::text AS payment_status, invoice_number, paid_at, coupon_redeemed_at, payment_method, payment_reference, stripe_payment_intent_id, vat_rate_bps, vat_included_fils, fulfilment_status::text AS fulfilment_status`;

class Rollback extends Error {}

try {
  await drizzle.transaction(async (tx) => {
    const one = async (query: unknown): Promise<Row> => rowsOf(await tx.execute(query))[0] ?? {};

    const trigger = await one(sql`SELECT count(*)::int AS n FROM pg_trigger WHERE tgname = 'orders_keep_money_state' AND NOT tgisinternal`);
    check("the trigger is installed", trigger.n === 1, `found ${String(trigger.n)}`);

    /* ---------- A: a settled order cannot be pushed backwards ---------- */
    const paid = await one(sql`SELECT id FROM orders WHERE payment_status = 'PAID' AND coalesce(invoice_number, '') <> '' AND paid_at IS NOT NULL ORDER BY id DESC LIMIT 1`);
    if (!paid.id) {
      check("a paid, invoiced order exists to probe", false, "none in this database — pay one first");
    } else {
      /* Give it every money column, so each has something to lose. */
      await tx.execute(sql`UPDATE orders SET payment_method = coalesce(nullif(payment_method, ''), 'cash'), payment_reference = coalesce(nullif(payment_reference, ''), 'probe-ref'), stripe_payment_intent_id = coalesce(nullif(stripe_payment_intent_id, ''), 'pi_probe_kept'), coupon_redeemed_at = coalesce(coupon_redeemed_at, now()) WHERE id = ${paid.id}`);
      const before = await one(sql`SELECT ${MONEY} FROM orders WHERE id = ${paid.id}`);

      await tx.execute(sql`UPDATE orders SET payment_status = 'PENDING', invoice_number = NULL, paid_at = NULL, coupon_redeemed_at = NULL, payment_method = NULL, payment_reference = NULL, stripe_payment_intent_id = NULL, vat_rate_bps = 999, vat_included_fils = 999, internal_notes = 'probe note' WHERE id = ${paid.id}`);
      const after = await one(sql`SELECT ${MONEY}, internal_notes FROM orders WHERE id = ${paid.id}`);
      for (const column of ["payment_status", "invoice_number", "paid_at", "coupon_redeemed_at", "payment_method", "payment_reference", "stripe_payment_intent_id", "vat_rate_bps", "vat_included_fils"]) {
        check(`paid order: ${column} survives a stale whole-row write`, String(after[column]) === String(before[column]), `${String(before[column])} -> ${String(after[column])}`);
      }
      check("paid order: an ordinary column in the same write still saves", after.internal_notes === "probe note");

      await tx.execute(sql`UPDATE orders SET invoice_number = 'CAL-INV-1999-00001', paid_at = '1999-01-01', stripe_payment_intent_id = 'pi_other' WHERE id = ${paid.id}`);
      const changed = await one(sql`SELECT ${MONEY} FROM orders WHERE id = ${paid.id}`);
      check("paid order: the invoice number cannot be changed", changed.invoice_number === before.invoice_number);
      check("paid order: the payment time cannot be changed", String(changed.paid_at) === String(before.paid_at));
      check("paid order: the intent id cannot be changed", changed.stripe_payment_intent_id === before.stripe_payment_intent_id);

      for (const status of ["AUTHORIZED", "FAILED"]) {
        await tx.execute(sql`UPDATE orders SET payment_status = ${status}::enum_orders_payment_status WHERE id = ${paid.id}`);
        const now = await one(sql`SELECT payment_status::text AS s FROM orders WHERE id = ${paid.id}`);
        check(`paid order: cannot become ${status}`, now.s === "PAID", String(now.s));
      }

      await tx.execute(sql`UPDATE orders SET fulfilment_status = 'PREPARING' WHERE id = ${paid.id}`);
      check("paid order: fulfilment still moves", (await one(sql`SELECT fulfilment_status::text AS s FROM orders WHERE id = ${paid.id}`)).s === "PREPARING");

      await tx.execute(sql`UPDATE orders SET payment_status = 'REFUNDED' WHERE id = ${paid.id}`);
      check("paid order: may become REFUNDED (a future refund feature)", (await one(sql`SELECT payment_status::text AS s FROM orders WHERE id = ${paid.id}`)).s === "REFUNDED");
      await tx.execute(sql`UPDATE orders SET payment_status = 'PENDING' WHERE id = ${paid.id}`);
      check("refunded order: cannot go back to PENDING", (await one(sql`SELECT payment_status::text AS s FROM orders WHERE id = ${paid.id}`)).s === "REFUNDED");
    }

    /* ---------- B: every legitimate step on an unpaid order ---------- */
    const unpaid = await one(sql`SELECT id, coalesce(invoice_number, '') AS invoice_number FROM orders WHERE payment_status = 'PENDING' AND paid_at IS NULL ORDER BY (coalesce(invoice_number, '') = '') DESC, id DESC LIMIT 1`);
    if (!unpaid.id) {
      check("an unpaid order exists to probe", false, "none in this database — create one first");
    } else {
      const id = unpaid.id;
      await tx.execute(sql`UPDATE orders SET stripe_payment_intent_id = 'pi_first' WHERE id = ${id}`);
      await tx.execute(sql`UPDATE orders SET stripe_payment_intent_id = 'pi_replacement' WHERE id = ${id}`);
      check("unpaid order: a cancelled intent can be replaced", (await one(sql`SELECT stripe_payment_intent_id AS v FROM orders WHERE id = ${id}`)).v === "pi_replacement");
      await tx.execute(sql`UPDATE orders SET stripe_payment_intent_id = NULL WHERE id = ${id}`);
      check("unpaid order: the intent id cannot be emptied", (await one(sql`SELECT stripe_payment_intent_id AS v FROM orders WHERE id = ${id}`)).v === "pi_replacement");

      await tx.execute(sql`UPDATE orders SET fulfilment_status = 'CANCELLED' WHERE id = ${id}`);
      await tx.execute(sql`UPDATE orders SET fulfilment_status = 'NEW' WHERE id = ${id}`);
      check("unpaid order: cancel and revert both pass", (await one(sql`SELECT fulfilment_status::text AS s FROM orders WHERE id = ${id}`)).s === "NEW");

      if (unpaid.invoice_number === "") {
        await tx.execute(sql`UPDATE orders SET invoice_number = 'CAL-INV-2099-00001', vat_rate_bps = 0, vat_included_fils = 0 WHERE id = ${id}`);
        check("unpaid order: an invoice number can be issued", (await one(sql`SELECT invoice_number AS v FROM orders WHERE id = ${id}`)).v === "CAL-INV-2099-00001");
      }
      await tx.execute(sql`UPDATE orders SET invoice_number = 'CAL-INV-2099-99999' WHERE id = ${id}`);
      check("unpaid order: an issued number cannot be changed", (await one(sql`SELECT invoice_number AS v FROM orders WHERE id = ${id}`)).v !== "CAL-INV-2099-99999");

      await tx.execute(sql`UPDATE orders SET payment_status = 'PAID', payment_method = 'bank-transfer', payment_reference = 'probe' WHERE id = ${id}`);
      const settled = await one(sql`SELECT ${MONEY} FROM orders WHERE id = ${id}`);
      check("unpaid order: can be paid, with its method", settled.payment_status === "PAID" && settled.payment_method === "bank-transfer");
      check("just paid: the payment time is still empty for the stamp to write", settled.paid_at === null);
      await tx.execute(sql`UPDATE orders SET paid_at = '2026-10-06T10:00:00Z' WHERE id = ${id} AND paid_at IS NULL`);
      await tx.execute(sql`UPDATE orders SET paid_at = '2026-10-07T10:00:00Z' WHERE id = ${id}`);
      const stamped = await one(sql`SELECT to_char(paid_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS d FROM orders WHERE id = ${id}`);
      check("just paid: the payment time is written once, first value wins", stamped.d === "2026-10-06", String(stamped.d));
      await tx.execute(sql`UPDATE orders SET coupon_redeemed_at = '2026-10-06T10:00:00Z' WHERE id = ${id}`);
      await tx.execute(sql`UPDATE orders SET coupon_redeemed_at = NULL WHERE id = ${id}`);
      check("just paid: a counted discount code stays counted", (await one(sql`SELECT coupon_redeemed_at AS v FROM orders WHERE id = ${id}`)).v !== null);
    }

    throw new Rollback();
  });
} catch (error) {
  if (!(error instanceof Rollback)) {
    console.error("PROBE CRASHED:", error instanceof Error ? error.message : error);
    process.exit(2);
  }
}

const failed = results.filter((r) => !r.pass);
for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.probe}${r.detail ? `  (${r.detail})` : ""}`);
console.log(`\n${results.length - failed.length}/${results.length} passed. Nothing was changed: the transaction was rolled back.`);
process.exit(failed.length === 0 ? 0 : 1);
