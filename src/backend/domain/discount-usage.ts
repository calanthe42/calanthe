/**
 * How a discount has been used, worked out from the orders that used it.
 *
 * PURE. The data layer fetches the orders (backend/data/discount-usage.ts)
 * and this adds them up, so the arithmetic can be tested without a database.
 *
 * EVERYTHING IS READ FROM THE ORDER'S OWN SNAPSHOT — the regular price stored
 * on each line and the code amount stored on the order — never from the
 * discount as it stands today. The owner may have edited it since; what it
 * took off THEN is what this reports.
 *
 * The caller passes only orders whose payment arrived. A refund afterwards
 * is not subtracted here, the same way a code's use count is never given
 * back on a refund (docs/PAYMENTS.md).
 */

type Ref = number | { id: number } | null | undefined;

const idOf = (ref: Ref): number | null => {
  if (ref === null || ref === undefined) return null;
  const id = typeof ref === "object" ? ref.id : ref;
  return Number.isInteger(id) && id > 0 ? id : null;
};

/** As much of a paid order as the sums below need. */
export type UsageOrder = {
  totalFils: number;
  couponDiscount?: Ref;
  couponDiscountFils?: number | null;
  items?:
    | readonly {
        sale?: Ref;
        quantity: number;
        unitPriceFils: number;
        compareAtUnitPriceFils?: number | null;
      }[]
    | null;
};

export type DiscountUsage = {
  /** Paid orders this discount applied to. */
  orders: number;
  /** What it took off those orders, in fils. */
  discountFils: number;
  /** What those orders came to, in fils — the amount customers actually paid. */
  salesFils: number;
};

export const NO_USAGE: DiscountUsage = { orders: 0, discountFils: 0, salesFils: 0 };

/**
 * Usage per discount id.
 *
 * An order counts ONCE for a discount however many of its lines were on that
 * sale. An order with a sale on its lines and a code on top counts for both:
 * each really did apply to it.
 */
export function summariseDiscountUsage(orders: readonly UsageOrder[]): Map<number, DiscountUsage> {
  const usage = new Map<number, DiscountUsage>();

  for (const order of orders) {
    /* What each discount took off THIS order. */
    const taken = new Map<number, number>();

    const coupon = idOf(order.couponDiscount);
    if (coupon !== null) {
      taken.set(coupon, Math.max(0, Number(order.couponDiscountFils ?? 0)));
    }

    for (const item of order.items ?? []) {
      const sale = idOf(item.sale);
      if (sale === null) continue;
      const was = Number(item.compareAtUnitPriceFils ?? 0);
      const unit = Number(item.unitPriceFils);
      const saved = was > unit ? (was - unit) * item.quantity : 0;
      taken.set(sale, (taken.get(sale) ?? 0) + saved);
    }

    for (const [id, fils] of taken) {
      const entry = usage.get(id) ?? { ...NO_USAGE };
      entry.orders += 1;
      entry.discountFils += fils;
      entry.salesFils += Number(order.totalFils ?? 0);
      usage.set(id, entry);
    }
  }

  return usage;
}
