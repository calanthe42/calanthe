import type { Payload } from "payload";

/**
 * Allocating an invoice number: gap-free, and exactly once per order.
 *
 * ONE SQL STATEMENT, and that is the whole design.
 *
 *   target   locks the order row, but only if it is PAID and has no invoice
 *            number yet;
 *   next     bumps this year's counter — but only when `target` produced a
 *            row (INSERT … SELECT FROM target), so nothing is consumed for an
 *            order that does not qualify;
 *   UPDATE   writes the number, the payment time and the VAT snapshot.
 *
 * GAP-FREE, because the counter and the order change in the same statement:
 * if anything fails, both roll back together. A sequence could not promise
 * that — `nextval` is never rolled back — which is why this is a table
 * (created by hand in the quote_pay_link migration).
 *
 * SINGLE WINNER, because of the row lock. Stripe delivers a webhook more
 * than once, sometimes concurrently. The second delivery waits on `FOR
 * UPDATE`, then re-reads the row, finds `invoice_number` set and matches
 * nothing. So "one row came back" means "this caller issued the invoice",
 * and only that caller sends the emails (backend/payments/paid.ts). This is
 * the duplicate-email guard as well as the numbering.
 *
 * Run in AUTOCOMMIT — never inside a Payload transaction — so the lock is
 * held for one statement and not for the length of somebody's request.
 *
 * The number's format must match formatInvoiceNumber in
 * backend/domain/invoice.ts: CAL-INV-YYYY-NNNNN, widening past 99,999.
 */

type DrizzleLike = { execute: (query: unknown) => Promise<unknown> };

export type ClaimInvoiceInput = {
  orderId: number;
  /** The year in Dubai at the moment of payment (invoiceYear). */
  year: number;
  vatRateBps: number;
  vatIncludedFils: number;
  paidAtIso: string;
};

export type ClaimInvoiceResult = { invoiceNumber: string; claimedNow: boolean };

export type ClaimInvoice = (payload: Payload, input: ClaimInvoiceInput) => Promise<ClaimInvoiceResult>;

function firstRow(result: unknown): Record<string, unknown> | undefined {
  /* node-postgres returns { rows: [...] }; some drivers return the array. */
  const rows = Array.isArray(result) ? result : ((result as { rows?: unknown[] })?.rows ?? []);
  return rows[0] as Record<string, unknown> | undefined;
}

export const claimInvoice: ClaimInvoice = async (payload, input) => {
  for (const [name, value] of Object.entries({
    orderId: input.orderId,
    year: input.year,
    vatRateBps: input.vatRateBps,
    vatIncludedFils: input.vatIncludedFils,
  })) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`claimInvoice: ${name} must be a non-negative integer, got ${value}`);
    }
  }
  if (Number.isNaN(new Date(input.paidAtIso).getTime())) {
    throw new Error(`claimInvoice: paidAtIso is not a date: ${input.paidAtIso}`);
  }

  const { sql } = await import("@payloadcms/db-postgres");
  const drizzle = (payload.db as unknown as { drizzle: DrizzleLike }).drizzle;

  /* Every value is a bound parameter. The casts are not decoration: through
     a prepared statement Postgres cannot infer a parameter's type from
     `|| $1` or `coalesce(col, $1)`, and fails with "could not determine data
     type of parameter". */
  const claimed = await drizzle.execute(sql`
    WITH target AS (
      SELECT id FROM orders
      WHERE id = ${input.orderId}::int
        AND invoice_number IS NULL
        AND payment_status = 'PAID'
      FOR UPDATE
    ),
    next AS (
      INSERT INTO invoice_counters (year, last_value)
      SELECT ${input.year}::int, 1 FROM target
      ON CONFLICT (year) DO UPDATE SET last_value = invoice_counters.last_value + 1
      RETURNING last_value
    )
    UPDATE orders o
    SET invoice_number = 'CAL-INV-' || ${String(input.year)}::text || '-' ||
          lpad(next.last_value::text, greatest(5, length(next.last_value::text)), '0'),
        paid_at = coalesce(o.paid_at, ${input.paidAtIso}::timestamptz),
        vat_rate_bps = ${input.vatRateBps}::numeric,
        vat_included_fils = ${input.vatIncludedFils}::numeric
    FROM next, target
    WHERE o.id = target.id
    RETURNING o.invoice_number AS invoice_number
  `);

  const issued = firstRow(claimed)?.invoice_number;
  if (typeof issued === "string" && issued !== "") {
    return { invoiceNumber: issued, claimedNow: true };
  }

  /* Nothing claimed: another delivery got there first, or the order is not
     PAID. Report what is on the row, and that this caller did not issue it. */
  const existing = await drizzle.execute(
    sql`SELECT invoice_number FROM orders WHERE id = ${input.orderId}::int`,
  );
  const current = firstRow(existing)?.invoice_number;
  return { invoiceNumber: typeof current === "string" ? current : "", claimedNow: false };
};
