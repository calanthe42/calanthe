import type { BusinessDetails } from "@/lib/business";

/**
 * The invoice, as data.
 *
 * PURE — an order snapshot and the business details in, a view out. The
 * email and the /pay page both render THIS, so the two can never disagree
 * about what was sold or what it cost.
 *
 * READS ONLY THE SNAPSHOT. Never the product relation: an invoice issued
 * today must read the same after the product has been renamed, repriced or
 * deleted (collections/Orders.ts explains why the order copies everything).
 *
 * THE NUMBER IS NOT MADE HERE. It is allocated in the database, gap-free, by
 * backend/payments/invoice-number.ts. `formatInvoiceNumber` exists so the
 * format is written down and tested in one place; the SQL must match it.
 */

const INVOICE_PREFIX = "CAL-INV-";
const TIMEZONE = "Asia/Dubai";

/** CAL-INV-2026-00001 — five digits, widening past 99,999 rather than truncating. */
export function formatInvoiceNumber(year: number, seq: number): string {
  if (!Number.isInteger(year) || !Number.isInteger(seq) || seq < 1) {
    throw new Error(`Invalid invoice number parts: ${year}, ${seq}`);
  }
  return `${INVOICE_PREFIX}${year}-${String(seq).padStart(5, "0")}`;
}

/** The invoice year is the year in DUBAI at the moment of payment. */
export function invoiceYear(at: Date): number {
  return Number(new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric" }).format(at));
}

/**
 * The VAT already inside a VAT-inclusive total, rounded to the fils.
 *
 *   total = net × (1 + rate)   →   vat = total × rate / (1 + rate)
 *
 * Zero when the rate is zero, which is every order while the business is not
 * VAT-registered.
 */
export function vatIncludedFils(totalFils: number, rateBps: number): number {
  if (!Number.isSafeInteger(totalFils) || totalFils < 0) {
    throw new Error(`Invalid fils amount: ${totalFils}`);
  }
  if (!Number.isInteger(rateBps) || rateBps <= 0) return 0;
  return Math.round((totalFils * rateBps) / (10_000 + rateBps));
}

export type InvoiceOrder = {
  invoiceNumber?: string | null;
  paidAt?: string | null;
  orderNumber?: string | number | null;
  customerName: string;
  customerEmail: string;
  items?:
    | readonly {
        productName: string;
        quantity: number;
        unitPriceFils: number;
        lineTotalFils: number;
        /** Regular unit price when the line was sold on offer. Not stored yet. */
        compareAtUnitPriceFils?: number | null;
        selectedOptions?: readonly { label?: string | null; value?: string | null }[] | null;
      }[]
    | null;
  subtotalFils: number;
  deliveryFeeFils?: number | null;
  discountFils?: number | null;
  couponCode?: string | null;
  totalFils: number;
  vatRateBps?: number | null;
  vatIncludedFils?: number | null;
};

export type InvoiceLine = {
  description: string;
  /** Size and add-ons in words, when the line has any. */
  detail?: string;
  quantity: number;
  unitFils: number;
  totalFils: number;
  /** The struck "was" price, for a line sold on offer. */
  wasUnitFils?: number;
};

export type InvoiceSeller = {
  tradingName: string;
  legalName?: { en: string; ar: string };
  addressLines?: { en: readonly string[]; ar: readonly string[] };
  city: { en: string; ar: string };
  country: { en: string; ar: string };
  tradeLicence?: string;
  /** Present only on a tax invoice. */
  trn?: string;
  email: string;
  phone: string;
};

export type InvoiceView = {
  number: string;
  /** ISO. An invoice is issued the moment it is paid. */
  issuedAt: string;
  paidAt: string;
  orderNumber: string;
  billTo: { name: string; email: string };
  lines: InvoiceLine[];
  subtotalFils: number;
  deliveryFeeFils: number;
  discountFils: number;
  /** What the discount row is called. Null when there is no discount. */
  discount: { code: string | null; fils: number } | null;
  totalFils: number;
  /** Null while VAT is off: the document is then a plain "Invoice". */
  vat: { rateBps: number; includedFils: number } | null;
  seller: InvoiceSeller;
};

function optionsDetail(
  selected: readonly { label?: string | null; value?: string | null }[] | null | undefined,
): string | undefined {
  const parts = (selected ?? [])
    .map((o) => String(o.value ?? o.label ?? "").trim())
    .filter((p) => p.length > 0);
  return parts.length > 0 ? parts.join(", ") : undefined;
}

/** The seller block, with everything the owner has not supplied left out. */
export function sellerFrom(business: BusinessDetails, taxInvoice: boolean): InvoiceSeller {
  return {
    tradingName: business.tradingName,
    ...(business.legalName ? { legalName: business.legalName } : {}),
    ...(business.addressLines ? { addressLines: business.addressLines } : {}),
    city: business.city,
    country: business.country,
    ...(business.tradeLicence ? { tradeLicence: business.tradeLicence } : {}),
    ...(taxInvoice && business.trn ? { trn: business.trn } : {}),
    email: business.email,
    phone: business.phone,
  };
}

export function buildInvoice(order: InvoiceOrder, business: BusinessDetails): InvoiceView {
  if (!order.invoiceNumber) {
    throw new Error(`Order ${order.orderNumber ?? "?"} has no invoice number: it has not been paid.`);
  }

  const lines: InvoiceLine[] = (order.items ?? []).map((item) => {
    const detail = optionsDetail(item.selectedOptions);
    const was = Number(item.compareAtUnitPriceFils ?? 0);
    return {
      description: item.productName,
      ...(detail ? { detail } : {}),
      quantity: item.quantity,
      unitFils: item.unitPriceFils,
      totalFils: item.lineTotalFils,
      ...(was > item.unitPriceFils ? { wasUnitFils: was } : {}),
    };
  });

  const deliveryFeeFils = Number(order.deliveryFeeFils ?? 0);
  const discountFils = Number(order.discountFils ?? 0);
  const linesTotal = lines.reduce((sum, line) => sum + line.totalFils, 0);

  /* The same arithmetic validateOrderTotals enforced when the order was
     written. Re-asserted because this is the document an accountant reads:
     an invoice that does not add up must never be rendered. */
  if (linesTotal !== order.subtotalFils || linesTotal + deliveryFeeFils - discountFils !== order.totalFils) {
    throw new Error(
      `Invoice ${order.invoiceNumber} does not reconcile: lines ${linesTotal} + delivery ${deliveryFeeFils} − discount ${discountFils} ≠ total ${order.totalFils}.`,
    );
  }

  const rateBps = Number(order.vatRateBps ?? 0);
  const vat =
    rateBps > 0
      ? { rateBps, includedFils: Number(order.vatIncludedFils ?? vatIncludedFils(order.totalFils, rateBps)) }
      : null;

  /* claimInvoice writes the number and the payment time in one statement,
     so an invoice without a date is corrupt rather than merely early. */
  if (!order.paidAt) {
    throw new Error(`Invoice ${order.invoiceNumber} has no payment date.`);
  }
  const paidAt = order.paidAt;

  return {
    number: order.invoiceNumber,
    issuedAt: paidAt,
    paidAt,
    orderNumber: String(order.orderNumber ?? ""),
    billTo: { name: order.customerName, email: order.customerEmail },
    lines,
    subtotalFils: order.subtotalFils,
    deliveryFeeFils,
    discountFils,
    discount: discountFils > 0 ? { code: order.couponCode?.trim() || null, fils: discountFils } : null,
    totalFils: order.totalFils,
    vat,
    seller: sellerFrom(business, vat !== null),
  };
}
