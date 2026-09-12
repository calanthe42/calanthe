import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";
import type { Order, User } from "@/payload-types";

/**
 * Admin reads that more than one screen needs.
 *
 * Every query runs under NORMAL access control, as the signed-in person. It
 * would be far easier to pass `overrideAccess: true` and see everything — and
 * that is exactly the bug to avoid: a staff member would then see the full
 * customer list, which docs/SECURITY.md §3 deliberately forbids. The admin
 * interface obeys the same rules as every other caller.
 *
 * The dashboard's own figures live in data/dashboard.ts.
 */

async function authed() {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await nextHeaders() });
  return { payload, user };
}

export async function getAdminOrderByNumber(orderNumber: string): Promise<Order | null> {
  const { payload, user } = await authed();
  const result = await payload.find({
    collection: "orders",
    where: { orderNumber: { equals: orderNumber } },
    limit: 1,
    depth: 1,
    user,
    overrideAccess: false,
  });
  return result.docs[0] ?? null;
}

/**
 * Customers only — never staff or the owner.
 *
 * Runs with Payload's access control ON, so a staff member calling it sees
 * only themselves, exactly as docs/SECURITY.md §3 requires. The customer list
 * is the business's most valuable asset and stays admin-only.
 */
export async function getAdminCustomers(limit = 1000): Promise<User[]> {
  const { payload, user } = await authed();
  const result = await payload.find({
    collection: "users",
    where: { role: { equals: "customer" } },
    sort: "-createdAt",
    limit,
    depth: 0,
    user,
    overrideAccess: false,
  });
  return result.docs;
}

/** Order counts and paid spend per customer, computed rather than stored. */
export async function getCustomerOrderStats(): Promise<
  Map<number, { orders: number; spentFils: number; lastOrderAt: string | null }>
> {
  const { payload, user } = await authed();
  const result = await payload.find({
    collection: "orders",
    where: { customer: { exists: true } },
    limit: 5000,
    depth: 0,
    sort: "-createdAt",
    user,
    overrideAccess: false,
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

/** Owner and staff accounts that can be assigned work. Read as the caller. */
export async function getTeamOptions(): Promise<{ label: string; value: string }[]> {
  const { payload, user } = await authed();
  const team = await payload
    .find({
      collection: "users",
      where: { role: { in: ["admin", "staff"] } },
      limit: 50,
      depth: 0,
      user,
      overrideAccess: false,
    })
    .catch(() => ({ docs: [] as User[] }));
  return team.docs.map((member) => ({
    label: [member.firstName, member.lastName].filter(Boolean).join(" ") || member.name || member.email,
    value: String(member.id),
  }));
}
