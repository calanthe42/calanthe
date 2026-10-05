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

/* ------------------------------------------------------------------ */
/* Invoices written by hand: numbered when ISSUED, stamped when PAID   */
/* ------------------------------------------------------------------ */

export type IssueInvoiceInput = {
  orderId: number;
  /** The year in Dubai at the moment the invoice is issued. */
  year: number;
  vatRateBps: number;
  vatIncludedFils: number;
};

export type IssueInvoice = (payload: Payload, input: IssueInvoiceInput) => Promise<string>;

/**
 * Gives an order written by hand in the admin its invoice number AT ONCE.
 *
 * The shop sends such an invoice to the customer before it is paid, so it
 * needs its number the moment it exists. Same counter, same single
 * statement, same guarantees as claimInvoice — gap-free, once per order —
 * with one difference: the order need not be paid, and no payment time is
 * written. Only `source = 'admin-manual'` qualifies: a website order and a
 * payment request still get their number at payment, and nowhere else.
 *
 * Returns the number on the order afterwards ("" if it has none, which only
 * a missing order or another source can cause).
 */
export const issueInvoice: IssueInvoice = async (payload, input) => {
  for (const [name, value] of Object.entries(input)) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`issueInvoice: ${name} must be a non-negative integer, got ${value}`);
    }
  }

  const { sql } = await import("@payloadcms/db-postgres");
  const drizzle = (payload.db as unknown as { drizzle: DrizzleLike }).drizzle;

  const issued = await drizzle.execute(sql`
    WITH target AS (
      SELECT id FROM orders
      WHERE id = ${input.orderId}::int
        AND invoice_number IS NULL
        AND source = 'admin-manual'
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
        vat_rate_bps = ${input.vatRateBps}::numeric,
        vat_included_fils = ${input.vatIncludedFils}::numeric
    FROM next, target
    WHERE o.id = target.id
    RETURNING o.invoice_number AS invoice_number
  `);
  const fresh = firstRow(issued)?.invoice_number;
  if (typeof fresh === "string" && fresh !== "") return fresh;

  const existing = await drizzle.execute(
    sql`SELECT invoice_number FROM orders WHERE id = ${input.orderId}::int`,
  );
  const current = firstRow(existing)?.invoice_number;
  return typeof current === "string" ? current : "";
};

export type StampPaid = (payload: Payload, input: { orderId: number; paidAtIso: string }) => Promise<boolean>;

/**
 * The single-winner gate for PAYING an invoice that already has its number.
 *
 * claimInvoice cannot be that gate here — there is nothing left to claim —
 * so the payment time is: one conditional statement writes `paid_at` only if
 * it is still empty. "A row came back" means "this caller recorded the
 * payment", and only that caller sends the thank-you. A second webhook
 * delivery, or a second click, matches nothing.
 */
export const stampPaid: StampPaid = async (payload, input) => {
  if (!Number.isSafeInteger(input.orderId) || input.orderId < 0) {
    throw new Error(`stampPaid: orderId must be a non-negative integer, got ${input.orderId}`);
  }
  if (Number.isNaN(new Date(input.paidAtIso).getTime())) {
    throw new Error(`stampPaid: paidAtIso is not a date: ${input.paidAtIso}`);
  }
  const { sql } = await import("@payloadcms/db-postgres");
  const drizzle = (payload.db as unknown as { drizzle: DrizzleLike }).drizzle;
  const stamped = await drizzle.execute(sql`
    UPDATE orders
    SET paid_at = ${input.paidAtIso}::timestamptz
    WHERE id = ${input.orderId}::int
      AND payment_status = 'PAID'
      AND invoice_number IS NOT NULL
      AND paid_at IS NULL
    RETURNING id
  `);
  return firstRow(stamped) !== undefined;
};
