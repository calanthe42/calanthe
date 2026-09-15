import { APIError } from "payload";
import type { CollectionBeforeChangeHook } from "payload";

/**
 * Human-facing order numbers: CAL-000001, CAL-000002, …
 *
 * WHY A POSTGRES SEQUENCE, and not `count() + 1`:
 * two checkouts completing in the same millisecond would both read the same
 * count and mint the same number. The unique index would then reject one of
 * them — meaning a customer who paid gets an error instead of an order.
 * `nextval()` is atomic, lock-free and safe under any concurrency, which is
 * the only property that matters here.
 *
 * The sequence is created by the Orders migration. Gaps are possible (a
 * rolled-back transaction consumes a value) and are fine — the requirement
 * is uniqueness and monotonicity, not density. Accountants care that no two
 * orders share a number, not that none is skipped.
 *
 * Deliberately NOT the database id (docs/DATABASE.md §8): the id leaks how
 * many rows exist, is reused across environments, and ties a customer-facing
 * identifier to an implementation detail.
 */

export const ORDER_NUMBER_SEQUENCE = "calanthe_order_number_seq";

/** CAL- + six digits, widening past 999,999 rather than truncating. */
export function formatOrderNumber(value: number): string {
  return `CAL-${String(value).padStart(6, "0")}`;
}

type DrizzleLike = {
  execute: (query: unknown) => Promise<unknown>;
};

function readSequenceValue(result: unknown): number {
  /* node-postgres returns { rows: [...] }; some drivers return the array
     directly. Handle both rather than assuming a shape that may change. */
  const rows = Array.isArray(result)
    ? result
    : ((result as { rows?: unknown[] })?.rows ?? []);
  const first = rows[0] as Record<string, unknown> | undefined;
  const raw = first?.n ?? first?.nextval;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new APIError("Could not allocate an order number.", 500);
  }
  return parsed;
}

export const assignOrderNumber: CollectionBeforeChangeHook = async ({
  data,
  operation,
  req,
}) => {
  if (operation !== "create") return data;
  /* Never re-mint. A number supplied by a data import is respected. */
  if (typeof data.orderNumber === "string" && data.orderNumber.trim() !== "") {
    return data;
  }

  const { sql } = await import("@payloadcms/db-postgres");
  const drizzle = (req.payload.db as unknown as { drizzle: DrizzleLike }).drizzle;

  const result = await drizzle.execute(
    sql.raw(`SELECT nextval('${ORDER_NUMBER_SEQUENCE}') AS n`),
  );

  data.orderNumber = formatOrderNumber(readSequenceValue(result));
  return data;
};
