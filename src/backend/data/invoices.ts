import "server-only";
import { timingSafeEqual } from "node:crypto";
import { getPayload, type Where } from "payload";
import config from "@payload-config";
import { getAdminSession } from "@backend/data/admin-session";
import { buildInvoiceSheet, type InvoiceSheetView, type SheetStatus } from "@backend/domain/invoice";
import {
  PAY_LINK_SOURCES,
  invoiceKey,
  invoiceUrl,
  isInvoiceNumberShape,
  isSettled,
  payLinkOrigin,
  payRequestState,
  payToken,
  payUrl,
  paymentMethodOf,
  type PaymentMethod,
} from "@backend/payments/pay-link";
import { cardPaymentsConfigured, getStripe } from "@backend/payments/stripe";
import { BUSINESS } from "@/lib/business";
import { env } from "@/lib/env";
import { SITE_ORIGIN } from "@/lib/site";

/**
 * Invoices: every order that has an invoice number, in the order the
 * numbers were issued.
 *
 * There is no invoices table. An invoice IS an order's own snapshot plus its
 * number — given at payment to a website order or a payment request, and at
 * creation to an invoice written by hand — so a list of invoices is a list
 * of orders that have a number, and it can never disagree with them.
 */

function origin(): string {
  return payLinkOrigin(SITE_ORIGIN, {
    env: process.env.VERCEL_ENV,
    branchUrl: process.env.VERCEL_BRANCH_URL,
  });
}

export type PublicInvoice = {
  sheet: InvoiceSheetView;
  locale: "en" | "ar";
  /** Where an unpaid invoice can be paid by card, when that is possible right now. */
  payUrl: string | null;
};

/**
 * The invoice behind `/invoice/<number>/<key>` — paid, unpaid or void — or null.
 *
 * One answer for a wrong number, a wrong key and an invoice that cannot be
 * built: nothing. The key is compared in constant time before any query.
 */
export async function loadInvoiceByKey(number: unknown, key: unknown): Promise<PublicInvoice | null> {
  if (!isInvoiceNumberShape(number) || typeof key !== "string" || key.length > 64) return null;
  const expected = Buffer.from(invoiceKey(env.PAYLOAD_SECRET, number));
  const given = Buffer.from(key);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  const payload = await getPayload({ config });
  const found = await payload.find({
    collection: "orders",
    where: { invoiceNumber: { equals: number } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const order = found.docs[0];
  if (!order) return null;

  try {
    const sheet = buildInvoiceSheet(order, BUSINESS);
    const locale = order.locale === "ar" ? "ar" : "en";
    const payable =
      sheet.status === "unpaid" &&
      Boolean(order.payTokenSalt) &&
      payRequestState(order, new Date()) === "awaiting" &&
      Boolean(getStripe()) &&
      cardPaymentsConfigured();
    return {
      sheet,
      locale,
      payUrl:
        payable && order.payTokenSalt
          ? payUrl(origin(), payToken(env.PAYLOAD_SECRET, order.payTokenSalt), locale)
          : null,
    };
  } catch (error) {
    payload.logger.error(
      `invoice page: ${number} could not be built: ${error instanceof Error ? error.message : "unknown"}`,
    );
    return null;
  }
}

export type InvoiceRow = {
  orderId: number;
  orderNumber: string;
  invoiceNumber: string;
  status: SheetStatus;
  /** The day it was paid, or — while unpaid — the day it was issued. */
  date: string | null;
  customerName: string;
  customerPhone: string;
  totalFils: number;
  method: PaymentMethod;
  /** Opens the branded invoice, ready to print or save as a PDF. */
  url: string;
};

export type InvoiceList = {
  rows: InvoiceRow[];
  total: number;
  totalPages: number;
  /** Orders written by hand or confirmed from an enquiry that nobody has paid yet. */
  awaitingPayment: number;
};

const EMPTY: InvoiceList = { rows: [], total: 0, totalPages: 1, awaitingPayment: 0 };

/** The admin's Invoices list: newest number first, searchable. Staff and owner. */
export async function listInvoices(options: { q?: string; page?: number; pageSize?: number }): Promise<InvoiceList> {
  if (!(await getAdminSession())) return EMPTY;
  const payload = await getPayload({ config });

  const q = (options.q ?? "").trim().slice(0, 80);
  const and: Where[] = [{ invoiceNumber: { exists: true } }, { invoiceNumber: { not_equals: "" } }];
  if (q) {
    and.push({
      or: [
        { invoiceNumber: { contains: q } },
        { orderNumber: { contains: q } },
        { customerName: { contains: q } },
        { customerPhone: { contains: q.replace(/\s+/g, "") } },
        { customerEmail: { contains: q } },
      ],
    });
  }

  const [found, awaiting] = await Promise.all([
    payload.find({
      collection: "orders",
      where: { and },
      /* CAL-INV-YYYY-NNNNN sorts as text in issue order (five digits, widening
         only past 99,999 a year); paidAt breaks the tie that will never happen. */
      sort: ["-invoiceNumber", "-paidAt"],
      page: Math.max(1, options.page ?? 1),
      limit: options.pageSize ?? 25,
      depth: 0,
      overrideAccess: true,
    }),
    payload.count({
      collection: "orders",
      where: {
        and: [
          { source: { in: [...PAY_LINK_SOURCES] } },
          { paymentStatus: { not_in: ["PAID", "REFUNDED", "PARTIALLY_REFUNDED"] } },
          { fulfilmentStatus: { not_equals: "CANCELLED" } },
        ],
      },
      overrideAccess: true,
    }),
  ]);

  const base = origin();
  return {
    rows: found.docs.map((order) => {
      const invoiceNumber = String(order.invoiceNumber ?? "");
      return {
        orderId: order.id,
        orderNumber: String(order.orderNumber ?? order.id),
        invoiceNumber,
        status: isSettled(order.paymentStatus)
          ? ("paid" as const)
          : order.fulfilmentStatus === "CANCELLED"
            ? ("void" as const)
            : ("unpaid" as const),
        date: order.paidAt ?? order.createdAt ?? null,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        totalFils: order.totalFils,
        method: paymentMethodOf(order),
        url: invoiceUrl(base, env.PAYLOAD_SECRET, invoiceNumber, order.locale === "ar" ? "ar" : "en"),
      };
    }),
    total: found.totalDocs,
    totalPages: Math.max(1, found.totalPages),
    awaitingPayment: awaiting.totalDocs,
  };
}

/** The shareable invoice address for one paid order, for the order page. */
export function invoiceUrlFor(order: { invoiceNumber?: string | null; locale?: string | null }): string | null {
  if (!isInvoiceNumberShape(order.invoiceNumber)) return null;
  return invoiceUrl(origin(), env.PAYLOAD_SECRET, order.invoiceNumber, order.locale === "ar" ? "ar" : "en");
}
