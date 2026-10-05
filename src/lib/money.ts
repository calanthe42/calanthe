/**
 * Money = integer fils (AED × 100). No floats ever touch money.
 * These are the ONLY conversion/formatting helpers; lib/pricing.ts
 * (Phase B3) builds on them.
 */

export type Fils = number;

/**
 * The smallest amount that can be charged: AED 2.00.
 *
 * Stripe refuses an AED charge below this, so an order that totals less can
 * never be paid. Defined ONCE, here — the payment request form, the order
 * integrity hook and the discount maths all import it, so the three can
 * never disagree about what "too small" means.
 */
export const MIN_CHARGE_FILS: Fils = 200;

/** Throws unless the value is a safe non-negative integer. */
export function assertFils(value: number): asserts value is Fils {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Invalid fils amount: ${value}`);
  }
}

export function aedToFils(aed: number): Fils {
  const fils = Math.round(aed * 100);
  assertFils(fils);
  return fils;
}

/** "AED 1,234.50" — display only; never feed back into arithmetic. */
export function formatFils(fils: Fils): string {
  assertFils(fils);
  const aed = Math.floor(fils / 100);
  const rem = fils % 100;
  const whole = aed.toLocaleString("en-AE");
  return rem === 0 ? `AED ${whole}` : `AED ${whole}.${rem.toString().padStart(2, "0")}`;
}

export function addFils(...amounts: Fils[]): Fils {
  let sum = 0;
  for (const a of amounts) {
    assertFils(a);
    sum += a;
  }
  assertFils(sum);
  return sum;
}

/** Percentage of an amount, rounded half-up to the nearest fils. */
export function percentOfFils(fils: Fils, percent: number): Fils {
  assertFils(fils);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new Error(`Invalid percentage: ${percent}`);
  }
  const result = Math.round((fils * percent) / 100);
  assertFils(result);
  return result;
}

/**
 * "AED 56" wrapped in a left-to-right isolate (U+2066 … U+2069), for an
 * amount placed INSIDE a sentence. On an Arabic page a bare "AED 56" in the
 * middle of a line is reordered by the bidi algorithm; isolated, the code
 * stays in front of the number. Invisible in English.
 */
export function formatFilsInline(fils: Fils): string {
  return `⁦${formatFils(fils)}⁩`;
}
