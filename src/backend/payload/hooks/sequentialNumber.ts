import { APIError } from "payload";
import type { Payload } from "payload";

/**
 * Atomic, human-readable reference numbers backed by a Postgres sequence.
 *
 * WHY NOT `count() + 1`: two submissions landing in the same millisecond
 * both read the same count and mint the same number. The unique index then
 * rejects one of them — so a customer who filled in a form gets an error
 * instead of a confirmation. `nextval()` is atomic and lock-free, which is
 * the only property that matters.
 *
 * Gaps are expected and harmless (a rolled-back transaction consumes a
 * value). The requirement is uniqueness and monotonicity, never density.
 *
 * The sequences themselves are created by the migration that introduces the
 * collection using them, since Payload has no concept of a sequence.
 *
 * NOTE: Orders has its own copy of this logic (orderNumber.ts) written
 * before this helper existed. It is deliberately left alone — rewriting a
 * working, tested money path to remove twenty duplicated lines is a poor
 * trade. Anything new uses this.
 */

type DrizzleLike = { execute: (query: unknown) => Promise<unknown> };

/** Reads `n` out of whichever row shape the driver returns. */
function readSequenceValue(result: unknown): number {
  const rows = Array.isArray(result) ? result : ((result as { rows?: unknown[] })?.rows ?? []);
  const first = rows[0] as Record<string, unknown> | undefined;
  const parsed = Number(first?.n ?? first?.nextval);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new APIError("Could not allocate a reference number.", 500);
  }
  return parsed;
}

/**
 * Claims the next value from a named sequence.
 *
 * `sequenceName` is interpolated into SQL, so it must never come from user
 * input — it is a module constant at every call site, and the guard below
 * makes an accidental change fail loudly rather than open an injection.
 */
export async function nextSequenceValue(payload: Payload, sequenceName: string): Promise<number> {
  if (!/^[a-z_][a-z0-9_]*$/.test(sequenceName)) {
    throw new APIError(`Refusing to use an unsafe sequence name: ${sequenceName}`, 500);
  }

  const { sql } = await import("@payloadcms/db-postgres");
  const drizzle = (payload.db as unknown as { drizzle: DrizzleLike }).drizzle;
  const result = await drizzle.execute(sql.raw(`SELECT nextval('${sequenceName}') AS n`));

  return readSequenceValue(result);
}

/** `CAL-E-000001` — prefix, then at least six digits, widening as needed. */
export function formatReference(prefix: string, value: number): string {
  return `${prefix}${String(value).padStart(6, "0")}`;
}
