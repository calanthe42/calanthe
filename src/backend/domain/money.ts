import { cardFeeEstimateFils, invoiceExtrasFils, type CostGroup } from "./costs";
import { dubaiDateInputValue, uaeMidnight } from "./dates";

/**
 * The Money screen's arithmetic: what customers paid in a month, what went on
 * flowers and packaging, the card fees, and what she kept.
 *
 * PURE — orders and invoices in, numbers out, no database and no clock (the
 * time is passed in) — so every figure on the screen is unit-tested in
 * money.test.ts. backend/data/money.ts only fetches.
 *
 * MONEY IN MINUS MONEY OUT, the way her bank account sees it:
 *
 *   customers paid = Σ paid orders in the month (cancelled and refunded out)
 *   flowers        = Σ flower and greenery lines on the month's invoices,
 *                    each with its share of delivery and VAT
 *   packaging      = Σ packaging lines, the same way
 *   card fees      = Σ the estimated fee on each card payment
 *   you kept       = customers paid − flowers − packaging − card fees
 *
 * "Something extra" (a vase, a cake) is left out on both sides for now: it
 * counts as a cost when it is SOLD (a later step), so an invoice line for a
 * carton of vases is not spending here, and nothing is counted twice.
 *
 * NO INVOICE, NO "KEPT". With no invoice in the month, `keptFils` is null and
 * the screen asks for the first one. It never shows "kept = paid".
 *
 * MONTHS ARE UAE MONTHS. The server runs in UTC; an order paid at 01:00 in
 * Dubai on the 1st belongs to the new month, not the old one.
 */

/** "2026-10". */
export type MonthKey = string;

const MONTH_KEY = /^(\d{4})-(0[1-9]|1[0-2])$/;

export const isMonthKey = (value: unknown): value is MonthKey => typeof value === "string" && MONTH_KEY.test(value);

/** The UAE month an instant falls in. */
export function monthOf(at: Date): MonthKey {
  return dubaiDateInputValue(at.toISOString()).slice(0, 7);
}

/** A month moved by whole months: ("2026-01", -1) is "2025-12". */
export function shiftMonth(month: MonthKey, by: number): MonthKey {
  const [year = 0, mon = 1] = month.split("-").map(Number);
  const index = year * 12 + (mon - 1) + by;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

export type Window = { start: Date; end: Date };

/** From UAE midnight on the 1st to UAE midnight on the 1st of the next month. */
export function monthWindow(month: MonthKey): Window {
  return { start: uaeMidnight(`${month}-01`), end: uaeMidnight(`${shiftMonth(month, 1)}-01`) };
}

/**
 * What a month is compared with: the month before it.
 *
 * A month that is over is compared with the whole month before. The month
 * she is IN is compared with the same stretch of the month before — "this
 * time in September" — because twenty days of October against thirty of
 * September would make every month look bad until its last day.
 */
export function comparisonWindow(month: MonthKey, now: Date): Window & { month: MonthKey; soFar: boolean } {
  const previous = shiftMonth(month, -1);
  const whole = monthWindow(previous);
  const current = monthWindow(month);
  const soFar = now.getTime() >= current.start.getTime() && now.getTime() < current.end.getTime();
  if (!soFar) return { ...whole, month: previous, soFar: false };
  const elapsed = now.getTime() - current.start.getTime();
  return {
    month: previous,
    start: whole.start,
    /* 31 October against a 30-day September is all of September. */
    end: new Date(Math.min(whole.end.getTime(), whole.start.getTime() + elapsed)),
    soFar: true,
  };
}

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */

/** What the arithmetic needs of an order, as Payload stores it. */
export type MoneyOrderLike = {
  totalFils?: number | null;
  paymentStatus?: string | null;
  fulfilmentStatus?: string | null;
  paymentMethod?: string | null;
  paidAt?: string | null;
  createdAt: string;
};

/**
 * Money that arrived and stayed. REFUNDED went back to the customer, so it is
 * not hers. PARTIALLY_REFUNDED is counted in full: the order does not store
 * how much went back (Stripe does), so the screen says how many orders were
 * partly refunded rather than guess the amount.
 */
export const PAID_SALE_STATUSES = ["PAID", "PARTIALLY_REFUNDED"] as const;
const PAID_SALE = new Set<string>(PAID_SALE_STATUSES);

/**
 * Payments that carry no card fee. The rest of OUTSIDE_PAYMENT_METHODS
 * (backend/payments/pay-link.ts, held together with this by a test) is a
 * card: an empty method is the website's card payment through Stripe, and a
 * card machine charges a fee as well, so it is estimated the same way —
 * leaving it out would make "you kept" look better than it is.
 */
export const FEE_FREE_PAYMENT_METHODS = ["cash", "bank-transfer"] as const;
const FEE_FREE = new Set<string>(FEE_FREE_PAYMENT_METHODS);

/** A stored amount as safe, non-negative integer fils. */
const fils = (value: number | null | undefined): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
};

/** When the money came in: the payment, or the order itself when no payment time was recorded. */
const paidInstant = (order: MoneyOrderLike): number => new Date(order.paidAt || order.createdAt).getTime();

/** Is this a sale whose money arrived inside the window? A cancelled order is not a sale. */
export function isPaidSaleIn(order: MoneyOrderLike, window: Window): boolean {
  if (!PAID_SALE.has(order.paymentStatus ?? "")) return false;
  if (order.fulfilmentStatus === "CANCELLED") return false;
  const at = paidInstant(order);
  return Number.isFinite(at) && at >= window.start.getTime() && at < window.end.getTime();
}

export const isCardPayment = (order: MoneyOrderLike): boolean => !FEE_FREE.has(order.paymentMethod ?? "");

/* ------------------------------------------------------------------ */
/* Invoices                                                            */
/* ------------------------------------------------------------------ */

export type MoneyInvoiceLike = {
  /** As stored (an ISO timestamp) or as typed (YYYY-MM-DD): read as the UAE day printed on it. */
  invoiceDate: string;
  deliveryFils?: number | null;
  vatFils?: number | null;
  /** `group` null: the item has left the list; it is counted with the flowers, never dropped. */
  lines: { group: CostGroup | null; lineTotalFils?: number | null }[];
};

/** The UAE day an invoice is dated, whichever way the date was stored. */
export function invoiceDay(invoiceDate: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(invoiceDate)) return invoiceDate;
  return dubaiDateInputValue(invoiceDate);
}

/** Is the invoice dated inside the window? A day belongs to it when its UAE midnight does. */
export function isInvoiceIn(invoice: MoneyInvoiceLike, window: Window): boolean {
  const day = invoiceDay(invoice.invoiceDate);
  if (!day) return false;
  const at = uaeMidnight(day).getTime();
  return Number.isFinite(at) && at >= window.start.getTime() && at < window.end.getTime();
}

/**
 * What one invoice spent on flowers and greenery, and on packaging, with
 * delivery and (while the shop is not VAT-registered) VAT shared over ALL its
 * lines by value — the same rule that worked out each price for one
 * (backend/domain/costs.ts `invoicePricesForOne`), so a stem's price and the
 * month's spending can never disagree. A line of something extra takes its
 * share too, and that share is left out with it.
 *
 * Not rounded: the month's totals are rounded once, at the end.
 */
export function invoiceSpend(
  invoice: MoneyInvoiceLike,
  vatRegistered: boolean,
): { flowersFils: number; packagingFils: number } {
  const extras = invoiceExtrasFils(fils(invoice.deliveryFils), fils(invoice.vatFils), vatRegistered);
  const totals = invoice.lines.map((line) => fils(line.lineTotalFils));
  const sum = totals.reduce((a, b) => a + b, 0);
  let flowersFils = 0;
  let packagingFils = 0;
  invoice.lines.forEach((line, i) => {
    const total = totals[i] ?? 0;
    const share = sum > 0 ? (extras * total) / sum : extras / invoice.lines.length;
    if (line.group === "packaging") packagingFils += total + share;
    else if (line.group !== "extra") flowersFils += total + share;
  });
  return { flowersFils, packagingFils };
}

/* ------------------------------------------------------------------ */
/* The month                                                           */
/* ------------------------------------------------------------------ */

export type MoneyTotals = {
  paidFils: number;
  orders: number;
  /** Orders counted in full although part of their money went back. */
  partlyRefunded: number;
  invoiceCount: number;
  flowersFils: number;
  packagingFils: number;
  cardFeesFils: number;
  /** null while there is no invoice in the window: "kept" would only be what customers paid. */
  keptFils: number | null;
};

/** Everything the Money screen says about one window, from the orders and invoices that fall in it. */
export function moneyTotals(
  orders: readonly MoneyOrderLike[],
  invoices: readonly MoneyInvoiceLike[],
  window: Window,
  vatRegistered: boolean,
): MoneyTotals {
  let paidFils = 0;
  let count = 0;
  let partlyRefunded = 0;
  let cardFeesFils = 0;
  for (const order of orders) {
    if (!isPaidSaleIn(order, window)) continue;
    const total = fils(order.totalFils);
    paidFils += total;
    count += 1;
    if (order.paymentStatus === "PARTIALLY_REFUNDED") partlyRefunded += 1;
    if (isCardPayment(order)) cardFeesFils += cardFeeEstimateFils(total);
  }

  let flowers = 0;
  let packaging = 0;
  let invoiceCount = 0;
  for (const invoice of invoices) {
    if (!isInvoiceIn(invoice, window)) continue;
    invoiceCount += 1;
    const spend = invoiceSpend(invoice, vatRegistered);
    flowers += spend.flowersFils;
    packaging += spend.packagingFils;
  }

  const flowersFils = Math.round(flowers);
  const packagingFils = Math.round(packaging);
  return {
    paidFils,
    orders: count,
    partlyRefunded,
    invoiceCount,
    flowersFils,
    packagingFils,
    cardFeesFils,
    /* The difference of the rounded parts, so the bars add up to what she reads. */
    keptFils: invoiceCount === 0 ? null : paidFils - flowersFils - packagingFils - cardFeesFils,
  };
}
