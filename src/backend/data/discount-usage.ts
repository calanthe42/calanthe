import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";
import { SETTLED_PAYMENT_STATUSES } from "@backend/domain/dashboard";
import { summariseDiscountUsage, type DiscountUsage } from "@backend/domain/discount-usage";

/**
 * How the owner's discounts have been used — for the list's "Used" column
 * and the editor's Performance card.
 *
 * ONE QUERY for every discount asked about, not one per row: the paid orders
 * that carry any of them are read once and added up in memory
 * (backend/domain/discount-usage.ts, pure and tested).
 *
 * Read as the signed-in user, never with overrideAccess: this is the admin.
 * Only orders whose payment ARRIVED are counted — an abandoned checkout that
 * carried a code used nothing.
 *
 * NULL MEANS "COULD NOT BE READ", never "not used". These figures sit beside
 * the screens where the owner switches a sale off; a failed count must not
 * take those screens down with it, and must not print a confident zero
 * either. The screens show a dash.
 */
export async function getDiscountUsage(
  ids: readonly number[],
): Promise<Map<number, DiscountUsage> | null> {
  try {
    return await readDiscountUsage(ids);
  } catch (error) {
    console.error("[discounts] usage could not be read", error);
    return null;
  }
}

async function readDiscountUsage(ids: readonly number[]): Promise<Map<number, DiscountUsage>> {
  const wanted = [...new Set(ids)].filter((id) => Number.isInteger(id) && id > 0);
  if (wanted.length === 0) return new Map();

  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await nextHeaders() });

  const found = await payload.find({
    collection: "orders",
    where: {
      and: [
        { paymentStatus: { in: [...SETTLED_PAYMENT_STATUSES] } },
        { or: [{ couponDiscount: { in: wanted } }, { "items.sale": { in: wanted } }] },
      ],
    },
    /* Only what the sums need; relationships stay as ids. */
    select: {
      totalFils: true,
      couponDiscount: true,
      couponDiscountFils: true,
      items: { sale: true, quantity: true, unitPriceFils: true, compareAtUnitPriceFils: true },
    },
    depth: 0,
    sort: "-createdAt",
    limit: 5000,
    user,
    overrideAccess: false,
  });

  const all = summariseDiscountUsage(found.docs);
  /* An order may also carry a discount nobody asked about (a sale on its
     lines beside the code being looked at); only the wanted ones go back. */
  const usage = new Map<number, DiscountUsage>();
  for (const id of wanted) {
    const entry = all.get(id);
    if (entry) usage.set(id, entry);
  }
  return usage;
}
