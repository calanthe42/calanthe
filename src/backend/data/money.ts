import "server-only";
import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";
import { activeRole } from "@backend/payload/access";
import { isCostGroup, type CostGroup } from "@backend/domain/costs";
import {
  PAID_SALE_STATUSES,
  comparisonWindow,
  monthWindow,
  moneyTotals,
  type MoneyInvoiceLike,
  type MoneyOrderLike,
  type MonthKey,
} from "@backend/domain/money";
import { BUSINESS } from "@/lib/business";

/**
 * What the Money screen (/admin/costs) reads: one UAE month of paid orders
 * and supplier invoices, and the stretch of the month before to compare
 * with. The arithmetic is backend/domain/money.ts, pure and tested; this
 * file only fetches, and fetches each thing once.
 *
 * OWNER ONLY, ON THE SERVER. What customers paid and what she kept are her
 * numbers: anyone else gets null without a query being tried, and every
 * read passes her with `overrideAccess: false`, so the owner-only invoices
 * collection decides as well. The page checks the session before it calls
 * this; this does not trust that it did.
 */

export type MoneyMonth = {
  month: MonthKey;
  /** The month she is in, so the sentence says "October so far". */
  soFar: boolean;
  paidFils: number;
  orders: number;
  partlyRefunded: number;
  invoiceCount: number;
  /** Flower and greenery lines, with their share of delivery and VAT. */
  flowersFils: number;
  packagingFils: number;
  /** Estimated: 2.9% + AED 1 on each card payment. */
  cardFeesFils: number;
  /** null while there is no invoice this month. */
  keptFils: number | null;
  /** Any invoice at all, ever: "add your first invoice" only when there is none. */
  anyInvoice: boolean;
  previous: { month: MonthKey; soFar: boolean; paidFils: number; keptFils: number | null };
};

const idOf = (value: unknown): number | null => {
  const id = typeof value === "object" && value !== null ? (value as { id?: unknown }).id : value;
  return typeof id === "number" && Number.isInteger(id) ? id : null;
};

type StoredInvoice = {
  invoiceDate: string;
  deliveryFils?: number | null;
  vatFils?: number | null;
  lines?: { item?: unknown; lineTotalFils?: number | null }[] | null;
};

export async function getMoneyMonth(month: MonthKey, now: Date = new Date()): Promise<MoneyMonth | null> {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await nextHeaders() });
  if (activeRole(user) !== "admin") return null;
  const access = { user, overrideAccess: false } as const;

  const current = monthWindow(month);
  const before = comparisonWindow(month, now);
  const from = before.start.toISOString();
  const to = current.end.toISOString();
  /* An invoice date is a day: a day either side, and the domain decides by
     the UAE day printed on it, whatever time of day it was stored at. */
  const dayEarlier = new Date(before.start.getTime() - 86_400_000).toISOString();
  const dayLater = new Date(current.end.getTime() + 86_400_000).toISOString();

  const [orders, invoices, everInvoiced] = await Promise.all([
    payload.find({
      collection: "orders",
      where: {
        and: [
          { paymentStatus: { in: [...PAID_SALE_STATUSES] } },
          {
            or: [
              { and: [{ paidAt: { greater_than_equal: from } }, { paidAt: { less_than: to } }] },
              /* Paid before payment times were recorded: when it was made. */
              {
                and: [
                  { paidAt: { exists: false } },
                  { createdAt: { greater_than_equal: from } },
                  { createdAt: { less_than: to } },
                ],
              },
            ],
          },
        ],
      },
      select: {
        totalFils: true,
        paymentStatus: true,
        fulfilmentStatus: true,
        paymentMethod: true,
        paidAt: true,
        createdAt: true,
      },
      depth: 0,
      pagination: false,
      ...access,
    }),
    payload.find({
      collection: "invoices",
      where: {
        and: [{ invoiceDate: { greater_than_equal: dayEarlier } }, { invoiceDate: { less_than: dayLater } }],
      },
      depth: 0,
      pagination: false,
      ...access,
    }),
    payload.count({ collection: "invoices", ...access }).then((found) => found.totalDocs > 0),
  ]);

  /* Which group each line's item is in, read once for every line. */
  const stored = invoices.docs as unknown as StoredInvoice[];
  const itemIds = [
    ...new Set(stored.flatMap((invoice) => (invoice.lines ?? []).map((line) => idOf(line.item)))),
  ].filter((id): id is number => id !== null);
  const groups = new Map<number, CostGroup>();
  if (itemIds.length > 0) {
    const items = await payload.find({
      collection: "cost-items",
      where: { id: { in: itemIds } },
      select: { group: true },
      depth: 0,
      pagination: false,
      ...access,
    });
    for (const item of items.docs as unknown as { id: number; group?: unknown }[]) {
      if (isCostGroup(item.group)) groups.set(item.id, item.group);
    }
  }

  const invoiceRows: MoneyInvoiceLike[] = stored.map((invoice) => ({
    invoiceDate: invoice.invoiceDate,
    deliveryFils: invoice.deliveryFils,
    vatFils: invoice.vatFils,
    lines: (invoice.lines ?? []).map((line) => {
      const id = idOf(line.item);
      return { group: id === null ? null : (groups.get(id) ?? null), lineTotalFils: line.lineTotalFils };
    }),
  }));
  const orderRows = orders.docs as unknown as MoneyOrderLike[];

  const inMonth = moneyTotals(orderRows, invoiceRows, current, BUSINESS.vatRegistered);
  const monthBefore = moneyTotals(orderRows, invoiceRows, before, BUSINESS.vatRegistered);

  return {
    month,
    soFar: before.soFar,
    paidFils: inMonth.paidFils,
    orders: inMonth.orders,
    partlyRefunded: inMonth.partlyRefunded,
    invoiceCount: inMonth.invoiceCount,
    flowersFils: inMonth.flowersFils,
    packagingFils: inMonth.packagingFils,
    cardFeesFils: inMonth.cardFeesFils,
    keptFils: inMonth.keptFils,
    anyInvoice: everInvoiced,
    previous: {
      month: before.month,
      soFar: before.soFar,
      paidFils: monthBefore.paidFils,
      keptFils: monthBefore.keptFils,
    },
  };
}
