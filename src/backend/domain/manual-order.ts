import { FormInputError } from "@backend/domain/form-error";
import { parseAedToFils, readText, within, type FormReader } from "@backend/domain/product-form";
import {
  CUSTOM_SLUG,
  MANUAL_SOURCE,
  OUTSIDE_PAYMENT_METHODS,
  QUOTE_MIN_FILS,
  SALES_CHANNELS,
  type OutsidePaymentMethod,
  type SalesChannel,
} from "@backend/payments/pay-link";

/**
 * An order the shop writes by hand in the admin — a sale that arrived on
 * WhatsApp, by phone or in person.
 *
 * PURE: a submitted form in, the exact `orders.create` payload out. No
 * database and no clock except the ones passed in, so every rule here is
 * unit-tested (manual-order.test.ts).
 *
 * THE PRICE IS WHAT THE SHOP TYPED. Unlike website checkout, nothing here
 * comes from a customer's browser: a signed-in member of staff states what
 * was agreed. So each line carries its own typed price — a catalogue line is
 * prefilled from the product but may be changed — and there is no delivery
 * fee and no discount code. The total is the sum of the lines and nothing
 * else, which is exactly what validateBespokeLines demands of this source.
 */

export type ManualLocale = "en" | "ar";
export type ManualPayment = "unpaid" | OutsidePaymentMethod;

export const MANUAL_MAX_LINES = 40;
const MAX_QUANTITY = 999;
/** A sale may be written up after the fact, but not from another year. */
const OLDEST_DAYS = 366;

const E164 = /^\+[1-9]\d{7,14}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
/* Noon in the UAE: the stored instant is the same calendar day everywhere. */
const UAE_NOON = "T12:00:00+04:00";

export const PICKUP_ADDRESS: Record<ManualLocale, string> = {
  en: "Collected from Calanthe",
  ar: "استلام من كالانثي",
};

const oneLine = (value: string): string => value.replace(/\s+/g, " ").trim();

/**
 * A phone as people type it in the UAE, as E.164.
 * "050 123 4567" → "+971501234567"; "00971…" → "+971…"; "+…" is kept.
 */
export function normalisePhone(raw: string): string {
  const digits = raw.replace(/[\s\-().]/g, "");
  if (/^00\d+$/.test(digits)) return `+${digits.slice(2)}`;
  if (/^05\d{8}$/.test(digits)) return `+971${digits.slice(1)}`;
  if (/^5\d{8}$/.test(digits)) return `+971${digits}`;
  if (/^971\d{8,9}$/.test(digits)) return `+${digits}`;
  return digits;
}

export type ManualLine = {
  /** A catalogue product; absent for a typed item. */
  productId?: number;
  /** What a typed item is called. Ignored for a catalogue product. */
  description: string;
  /** Size, colour, add-ons — in words. Optional. */
  detail?: string;
  unitFils: number;
  quantity: number;
};

export type ParsedManualOrder = {
  customerName: string;
  customerPhone: string;
  /** Empty when the customer gave none. */
  customerEmail: string;
  lines: ManualLine[];
  totalFils: number;
  deliveryDate: string;
  deliveryTimeSlot: string;
  deliveryAddress: string;
  recipientName?: string;
  recipientPhone?: string;
  cardMessage?: string;
  customerNote?: string;
  locale: ManualLocale;
  salesChannel: SalesChannel;
  payment: ManualPayment;
  paymentReference?: string;
  /** Email the invoice and its pay button now. Only meaningful when unpaid and an email was given. */
  sendEmail: boolean;
};

function parseLines(raw: string): ManualLine[] {
  let rows: unknown;
  try {
    rows = JSON.parse(raw || "[]");
  } catch {
    rows = null;
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new FormInputError("Add at least one item.", "linesRequired");
  }
  if (rows.length > MANUAL_MAX_LINES) {
    throw new FormInputError(`An order can have at most ${MANUAL_MAX_LINES} items.`, "tooManyLines", {
      max: MANUAL_MAX_LINES,
    });
  }

  return rows.map((row, index) => {
    const r = (row ?? {}) as Record<string, unknown>;
    const n = index + 1;
    const productId = Number(r.productId);
    const isProduct = Number.isSafeInteger(productId) && productId > 0;

    const description = within(oneLine(String(r.description ?? "")), 140, `Item ${n}`);
    if (!isProduct && description === "") {
      throw new FormInputError(`Item ${n}: write what it is.`, "lineDescription", { n });
    }

    const unitFils = parseAedToFils(String(r.unitAed ?? "").trim(), `Item ${n} price`);
    if (unitFils === null || unitFils <= 0) {
      throw new FormInputError(`Item ${n}: enter the price in dirhams.`, "linePrice", { n });
    }

    const quantity = Number(r.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      throw new FormInputError(`Item ${n}: the quantity must be between 1 and ${MAX_QUANTITY}.`, "lineQuantity", {
        n,
        max: MAX_QUANTITY,
      });
    }

    const detail = within(oneLine(String(r.detail ?? "")), 140, `Item ${n} details`);
    return {
      ...(isProduct ? { productId } : {}),
      description,
      ...(detail ? { detail } : {}),
      unitFils,
      quantity,
    };
  });
}

export function parseManualOrderForm(
  form: FormReader,
  ctx: { todayDubai: string; slots: readonly string[] },
): ParsedManualOrder {
  const locale: ManualLocale = readText(form.get("locale")) === "ar" ? "ar" : "en";

  const customerName = within(oneLine(readText(form.get("customerName"))), 140, "The customer's name");
  if (customerName === "") throw new FormInputError("Enter the customer's name.", "customerNameRequired");

  const phoneError = () =>
    new FormInputError("Enter the phone in international format, e.g. +971501234567.", "phoneFormat");
  const customerPhone = normalisePhone(readText(form.get("customerPhone")));
  if (!E164.test(customerPhone)) throw phoneError();

  const customerEmail = readText(form.get("customerEmail")).toLowerCase();
  if (customerEmail !== "" && (customerEmail.length > 200 || !EMAIL.test(customerEmail))) {
    throw new FormInputError("Enter the customer's email address.", "emailFormat");
  }

  const lines = parseLines(readText(form.get("lines")));
  const totalFils = lines.reduce((sum, line) => sum + line.unitFils * line.quantity, 0);
  if (!Number.isSafeInteger(totalFils) || totalFils < QUOTE_MIN_FILS) {
    throw new FormInputError("The amount must be at least AED 2.", "amountTooLow");
  }

  const day = readText(form.get("deliveryDate"));
  if (!day) throw new FormInputError("Choose the delivery date.", "deliveryDateRequired");
  const at = DAY.test(day) ? new Date(`${day}${UAE_NOON}`) : new Date(Number.NaN);
  /* 2026-02-31 parses to March in some engines; refuse anything that does
     not come back out as the day that went in. */
  if (Number.isNaN(at.getTime()) || new Date(at.getTime() + 4 * 3_600_000).toISOString().slice(0, 10) !== day) {
    throw new FormInputError("Choose the delivery date.", "deliveryDateRequired");
  }
  const oldest = new Date(new Date(`${ctx.todayDubai}${UAE_NOON}`).getTime() - OLDEST_DAYS * 86_400_000);
  if (at.getTime() < oldest.getTime()) {
    throw new FormInputError("The delivery date is too far in the past.", "deliveryDateTooOld");
  }

  const deliveryTimeSlot = readText(form.get("deliveryTimeSlot"));
  if (!ctx.slots.includes(deliveryTimeSlot)) {
    throw new FormInputError("Choose a time window.", "slotRequired");
  }

  const pickup = readText(form.get("pickup")) === "on";
  const typedAddress = within(readText(form.get("deliveryAddress")), 600, "The delivery address");
  const deliveryAddress = pickup ? PICKUP_ADDRESS[locale] : typedAddress;
  if (!deliveryAddress) throw new FormInputError("Enter the delivery address.", "addressRequired");

  const recipientPhone = normalisePhone(readText(form.get("recipientPhone")));
  if (recipientPhone && !E164.test(recipientPhone)) throw phoneError();
  const recipientName = within(oneLine(readText(form.get("recipientName"))), 140, "The recipient name");
  const cardMessage = within(readText(form.get("cardMessage")), 300, "The card message");
  const customerNote = within(readText(form.get("customerNote")), 600, "The note to the customer");

  const channel = readText(form.get("salesChannel"));
  if (!(SALES_CHANNELS as readonly string[]).includes(channel)) {
    throw new FormInputError("Choose where the order came from.", "channelRequired");
  }

  const paymentRaw = readText(form.get("payment")) || "unpaid";
  if (paymentRaw !== "unpaid" && !(OUTSIDE_PAYMENT_METHODS as readonly string[]).includes(paymentRaw)) {
    throw new FormInputError("Choose how the customer is paying.", "paymentMethod");
  }
  const payment = paymentRaw as ManualPayment;
  const paymentReference = within(oneLine(readText(form.get("paymentReference"))), 140, "The payment note");

  return {
    customerName,
    customerPhone,
    customerEmail,
    lines,
    totalFils,
    deliveryDate: at.toISOString(),
    deliveryTimeSlot,
    deliveryAddress,
    ...(recipientName ? { recipientName } : {}),
    ...(recipientPhone ? { recipientPhone } : {}),
    ...(cardMessage ? { cardMessage } : {}),
    ...(customerNote ? { customerNote } : {}),
    locale,
    salesChannel: channel as SalesChannel,
    payment,
    ...(payment !== "unpaid" && paymentReference ? { paymentReference } : {}),
    sendEmail: payment === "unpaid" && customerEmail !== "" && readText(form.get("sendEmail")) === "on",
  };
}

export type ManualProduct = { id: number; name: string; slug: string };

/**
 * The exact `orders.create` payload.
 *
 * A catalogue line takes its NAME and slug from the product as it is today
 * (the order snapshots them, like every order), and its price from the form.
 * A typed line has no product and the reserved slug. The order is created
 * unpaid — payment is recorded in a second, guarded step.
 */
export function manualOrderData(
  parsed: ParsedManualOrder,
  products: ReadonlyMap<number, ManualProduct>,
  extra: { salt: string; tokenHash: string; expiresAt: Date; staffId?: number },
) {
  const items = parsed.lines.map((line, index) => {
    const product = line.productId ? products.get(line.productId) : undefined;
    if (line.productId && !product) {
      throw new FormInputError(
        `Item ${index + 1}: that product is no longer in the catalogue. Remove it and add it again.`,
        "productMissing",
        { n: index + 1 },
      );
    }
    return {
      ...(product ? { product: product.id } : {}),
      productName: product ? product.name.slice(0, 140) : line.description,
      productSlug: product ? product.slug : CUSTOM_SLUG,
      quantity: line.quantity,
      unitPriceFils: line.unitFils,
      lineTotalFils: line.unitFils * line.quantity,
      selectedOptions: line.detail ? [{ label: "Details", value: line.detail }] : [],
    };
  });
  const subtotalFils = items.reduce((sum, item) => sum + item.lineTotalFils, 0);

  return {
    locale: parsed.locale,
    source: MANUAL_SOURCE,
    salesChannel: parsed.salesChannel,
    customerType: "guest" as const,
    customerName: parsed.customerName,
    customerEmail: parsed.customerEmail,
    customerPhone: parsed.customerPhone,
    deliveryAddress: parsed.deliveryAddress,
    /* The only zone the atelier delivers to. */
    deliveryEmirate: "abu-dhabi" as const,
    deliveryDate: parsed.deliveryDate,
    deliveryTimeSlot: parsed.deliveryTimeSlot,
    ...(parsed.customerNote ? { customerNote: parsed.customerNote } : {}),
    ...(parsed.recipientName ? { recipientName: parsed.recipientName } : {}),
    ...(parsed.recipientPhone ? { recipientPhone: parsed.recipientPhone } : {}),
    ...(parsed.cardMessage ? { cardMessage: parsed.cardMessage } : {}),
    items,
    subtotalFils,
    deliveryFeeFils: 0,
    discountFils: 0,
    totalFils: subtotalFils,
    currency: "AED" as const,
    /* Unpaid until Stripe's webhook, or the owner's recorded payment, says otherwise. */
    paymentStatus: "PENDING" as const,
    fulfilmentStatus: "NEW" as const,
    payTokenSalt: extra.salt,
    payTokenHash: extra.tokenHash,
    payLinkExpiresAt: extra.expiresAt.toISOString(),
    ...(extra.staffId ? { assignedStaff: extra.staffId } : {}),
  };
}

/** One line of words for emails and lists: "Amber Hour × 2, Candle". */
export function describeLines(
  items: readonly { productName: string; quantity?: number | null }[] | null | undefined,
): string {
  return (items ?? [])
    .map((item) => (Number(item.quantity ?? 1) > 1 ? `${item.productName} × ${item.quantity}` : item.productName))
    .join(", ");
}
