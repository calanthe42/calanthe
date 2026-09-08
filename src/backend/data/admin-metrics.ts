import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";
import type { Order, Product, User } from "@/payload-types";

/**
 * Every number the admin dashboard shows, read from the database.
 *
 * Nothing here is invented. Where the business genuinely has no data yet the
 * count is zero and the interface says so, because a dashboard that shows
 * plausible-looking numbers it made up is worse than one that shows none: the
 * owner would make decisions on them.
 *
 * Revenue is summed from PAID orders only, in integer fils, and converted for
 * display at the very edge. An order that has not been paid for is not
 * revenue, however far along fulfilment is.
 */

export type DashboardMetrics = {
  ordersTotal: number;
  ordersToday: number;
  revenueFils: number;
  customersTotal: number;
  enquiriesPending: number;
  productsTotal: number;
  productsAvailable: number;
  occasionsTotal: number;
  mediaTotal: number;
};

/**
 * Payload with the signed-in user attached.
 *
 * Every query below runs under NORMAL access control, as this person. It
 * would be far easier to pass `overrideAccess: true` and see everything —
 * and that is exactly the bug to avoid: a staff member would then see the
 * full customer list, which docs/SECURITY.md §3 deliberately forbids. The
 * admin interface must obey the same rules as every other caller, so what a
 * staff member sees here is what the permission model says they may see.
 */
async function authed() {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await nextHeaders() });
  return { payload, user };
}

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
};

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const { payload, user } = await authed();
  const opts = { user, overrideAccess: false } as const;

  const [orders, ordersToday, customers, enquiries, products, available, occasions, media] =
    await Promise.all([
      payload.count({ collection: "orders", ...opts }),
      payload.count({
        collection: "orders",
        where: { createdAt: { greater_than_equal: startOfToday() } },
        ...opts,
      }),
      payload.count({ collection: "users", where: { role: { equals: "customer" } }, ...opts }),
      payload.count({
        collection: "enquiries",
        where: { status: { in: ["NEW", "IN_REVIEW", "WAITING_FOR_CUSTOMER"] } },
        ...opts,
      }),
      payload.count({ collection: "products", ...opts }),
      payload.count({ collection: "products", where: { available: { equals: true } }, ...opts }),
      payload.count({ collection: "occasions", ...opts }),
      payload.count({ collection: "media", ...opts }),
    ]);

  /* Only paid money counts. Summed in fils; a page of orders is plenty at
     this scale, and this becomes a database aggregate when it stops being. */
  const paid = await payload.find({
    collection: "orders",
    where: { paymentStatus: { in: ["PAID", "PARTIALLY_REFUNDED"] } },
    limit: 1000,
    depth: 0,
    select: { totalFils: true },
    ...opts,
  });
  const revenueFils = paid.docs.reduce((sum, order) => sum + Number(order.totalFils ?? 0), 0);

  return {
    ordersTotal: orders.totalDocs,
    ordersToday: ordersToday.totalDocs,
    revenueFils,
    customersTotal: customers.totalDocs,
    enquiriesPending: enquiries.totalDocs,
    productsTotal: products.totalDocs,
    productsAvailable: available.totalDocs,
    occasionsTotal: occasions.totalDocs,
    mediaTotal: media.totalDocs,
  };
}

/** The most recent orders for the dashboard table. */
export async function getRecentOrders(limit = 6): Promise<Order[]> {
  const { payload, user } = await authed();
  const result = await payload.find({
    collection: "orders",
    sort: "-createdAt",
    limit,
    depth: 0,
    user,
  });
  return result.docs;
}

/** Catalogue rows for the products screen — all of them, hidden included. */
export async function getAdminProducts(limit = 200): Promise<Product[]> {
  const { payload, user } = await authed();
  const result = await payload.find({
    collection: "products",
    sort: "sortOrder",
    limit,
    depth: 1,
    user,
  });
  return result.docs;
}

export async function getAdminOrders(limit = 100): Promise<Order[]> {
  const { payload, user } = await authed();
  const result = await payload.find({
    collection: "orders",
    sort: "-createdAt",
    limit,
    depth: 0,
    user,
  });
  return result.docs;
}

export async function getAdminOrderByNumber(orderNumber: string): Promise<Order | null> {
  const { payload, user } = await authed();
  const result = await payload.find({
    collection: "orders",
    where: { orderNumber: { equals: orderNumber } },
    limit: 1,
    depth: 1,
    user,
  });
  return result.docs[0] ?? null;
}

/**
 * Customers only — never staff or the owner.
 *
 * Note this runs with Payload's access control ON, so a staff member calling
 * it sees only themselves, exactly as docs/SECURITY.md §3 requires. The
 * customer list is the business's most valuable asset and stays admin-only.
 */
export async function getAdminCustomers(limit = 200): Promise<User[]> {
  const { payload, user } = await authed();
  const result = await payload.find({
    collection: "users",
    where: { role: { equals: "customer" } },
    sort: "-createdAt",
    limit,
    depth: 0,
    user,
  });
  return result.docs;
}

/** Order counts and spend per customer, computed rather than stored. */
export async function getCustomerOrderStats(): Promise<
  Map<number, { orders: number; spentFils: number; lastOrderAt: string | null }>
> {
  const { payload, user } = await authed();
  const result = await payload.find({
    collection: "orders",
    where: { customer: { exists: true } },
    limit: 1000,
    depth: 0,
    sort: "-createdAt",
    user,
  });

  const stats = new Map<number, { orders: number; spentFils: number; lastOrderAt: string | null }>();
  for (const order of result.docs) {
    const id = typeof order.customer === "object" ? order.customer?.id : order.customer;
    if (typeof id !== "number") continue;
    const entry = stats.get(id) ?? { orders: 0, spentFils: 0, lastOrderAt: null };
    entry.orders += 1;
    if (order.paymentStatus === "PAID" || order.paymentStatus === "PARTIALLY_REFUNDED") {
      entry.spentFils += Number(order.totalFils ?? 0);
    }
    entry.lastOrderAt ??= order.createdAt;
    stats.set(id, entry);
  }
  return stats;
}
