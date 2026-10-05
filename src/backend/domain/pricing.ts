import { addons, deliveryZones, FREE_DELIVERY_THRESHOLD_AED, sizes } from "@/lib/data";
import type { AddonId, SizeId } from "@/lib/data";
import {
  bestSaleFor,
  checkCoupon,
  couponDiscountFils,
  saleUnitFils,
  type CouponRefusal,
  type CouponRule,
  type DiscountValueType,
  type SaleRule,
  type SaleTarget,
} from "@/lib/discounts";
import { MIN_CHARGE_FILS } from "@/lib/money";
import type { Product } from "@/payload-types";

/**
 * The only place an order total is computed.
 *
 * Pure: fils in, fils out. No database, no network, no clock — everything it
 * needs is passed in, which is what makes money testable (docs/ARCHITECTURE.md §3).
 *
 * THE BROWSER IS NEVER A SOURCE OF PRICE. The client may say "product X,
 * quantity 2, deluxe, with a vase". It may not say what any of that costs.
 * Every figure below is derived from the product record the server loaded and
 * from constants the server holds, so a tampered payload changes what is
 * bought, never what is charged.
 *
 * Size deltas, add-on prices and delivery fees still live in lib/data.ts as
 * configuration. They are not yet database collections; when they become
 * collections this function's inputs change and its arithmetic does not.
 *
 * DISCOUNTS (lib/discounts.ts holds the arithmetic; this file applies it).
 *
 *   An automatic SALE lowers the arrangement — base price plus size uplift —
 *   and never an add-on. It is baked into the line's unit price, with the
 *   regular price kept beside it, so `line = unit × quantity` still holds and
 *   every receipt keeps working.
 *
 *   A discount CODE is the order-level `discountFils`, taken off the
 *   already-reduced subtotal, add-ons included. Delivery is never discounted;
 *   the free-delivery threshold is measured after the code.
 *
 * The rules themselves — which sales are live, which code was typed, whether
 * this email has used it — are loaded by the caller and passed in, with the
 * clock, so this stays pure. A refused code does NOT throw: the order is
 * priced without it and the refusal is reported, and the caller decides
 * whether that is an error.
 */

export type CheckoutLineRequest = {
  productId: string;
  quantity: number;
  sizeId: SizeId;
  addonIds: readonly AddonId[];
  giftMessage?: string;
};

/** The sale that lowered a line, frozen as it was when the line was priced. */
export type PricedSale = {
  id: string;
  /** The owner's internal name. Staff-only; never sent to a browser. */
  title: string;
  labelEn: string;
  labelAr: string;
  valueType: DiscountValueType;
  percentOff: number;
  amountOffFils: number;
};

export type PricedLine = {
  product: Product;
  productName: string;
  productSlug: string;
  quantity: number;
  /** What the customer pays per unit — the sale, if any, already applied. */
  unitPriceFils: number;
  lineTotalFils: number;
  /** The regular unit price (arrangement + add-ons). Null when not on sale. */
  compareAtUnitPriceFils: number | null;
  sale: PricedSale | null;
  selectedOptions: { label: string; value: string }[];
};

/** Everything about discounts the caller loaded, and the moment it is. */
export type OrderDiscounts = {
  sales: readonly SaleRule[];
  coupon: CouponRule | null;
  emailHasUsedCoupon: boolean;
  now: Date;
};

export type PricedCouponRefusal = { reason: CouponRefusal; shortfallFils?: number };

export type PricedOrder = {
  lines: PricedLine[];
  /** Sum of the lines, sale prices already applied. */
  subtotalFils: number;
  deliveryFeeFils: number;
  /** The order-level discount. Always equal to `couponDiscountFils`. */
  discountFils: number;
  totalFils: number;
  /** What the sales took off, summed over the lines. Already in the subtotal. */
  saleSavingsFils: number;
  couponDiscountFils: number;
  /** The code that was applied. Null when none was given or it was refused. */
  coupon: CouponRule | null;
  /** Why the code that was given did not apply. */
  couponRefusal: PricedCouponRefusal | null;
};

const aedToFils = (aed: number) => Math.round(aed * 100);

/** Delivery fee for an emirate, waived above the free-delivery threshold. */
export function deliveryFeeFils(emirate: string, subtotalFils: number): number {
  /* The emirate is checked FIRST. It used to be checked after the free-
     delivery threshold, so a large enough basket skipped the check and an
     order to an emirate the atelier does not serve went through, free. */
  const zone = deliveryZones.find((z) => z.id === emirate);
  if (!zone) throw new Error(`INVALID_DELIVERY: unsupported emirate "${emirate}"`);
  if (subtotalFils >= aedToFils(FREE_DELIVERY_THRESHOLD_AED)) return 0;
  return aedToFils(zone.feeAed);
}

/**
 * Prices one line against the authoritative product record.
 *
 * Throws rather than skipping: a checkout that silently drops a line the
 * customer chose is worse than one that fails and says why.
 */
export function priceLine(
  line: CheckoutLineRequest,
  product: Product,
  sale?: SaleRule | null,
): PricedLine {
  if (!product.available) {
    throw new Error(`PRODUCT_UNAVAILABLE: ${product.name} is not currently for sale`);
  }
  if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 20) {
    throw new Error("INVALID_QUANTITY: quantity must be between 1 and 20");
  }

  const size = sizes.find((s) => s.id === line.sizeId);
  if (!size) throw new Error(`INVALID_OPTION: unknown size "${line.sizeId}"`);

  const chosenAddons = line.addonIds.map((id) => {
    const addon = addons.find((a) => a.id === id);
    if (!addon) throw new Error(`INVALID_OPTION: unknown add-on "${id}"`);
    return addon;
  });

  /* Base price comes from the database record, never from the request. */
  const baseFils = Number(product.priceFils);
  /* The ARRANGEMENT is what a sale reduces: the flowers at the chosen size.
     Add-ons are bought-in goods and stay at full price. */
  const arrangementFils = baseFils + aedToFils(size.priceDeltaAed);
  const saleArrangementFils = sale ? saleUnitFils(arrangementFils, sale) : arrangementFils;
  const addonsFils = chosenAddons.reduce((sum, a) => sum + aedToFils(a.priceAed), 0);
  const unitPriceFils = saleArrangementFils + addonsFils;

  if (!Number.isSafeInteger(unitPriceFils) || unitPriceFils <= 0) {
    throw new Error("INVALID_TOTAL: computed unit price is not a valid amount");
  }

  const selectedOptions = [
    { label: "Size", value: size.name },
    ...chosenAddons.map((a) => ({ label: "Add-on", value: a.name })),
  ];

  const applied = sale && saleArrangementFils < arrangementFils ? sale : null;

  return {
    product,
    productName: product.name,
    productSlug: product.slug,
    quantity: line.quantity,
    unitPriceFils,
    /* Exact: the order's integrity hook requires line = unit × quantity. */
    lineTotalFils: unitPriceFils * line.quantity,
    compareAtUnitPriceFils: applied ? arrangementFils + addonsFils : null,
    sale: applied
      ? {
          id: applied.id,
          title: applied.title,
          labelEn: applied.labelEn,
          labelAr: applied.labelAr,
          valueType: applied.valueType,
          percentOff: applied.percentOff,
          amountOffFils: applied.amountOffFils,
        }
      : null,
    selectedOptions,
  };
}

/** Occasion relationships arrive as ids or documents depending on depth. */
function occasionIdsOf(product: Product): string[] {
  const occasions: unknown[] = Array.isArray(product.occasions) ? product.occasions : [];
  return occasions
    .map((occasion) =>
      typeof occasion === "object" && occasion !== null
        ? (occasion as { id?: unknown }).id
        : occasion,
    )
    .filter((id) => id !== null && id !== undefined)
    .map(String);
}

/** A product as the sale rules see it. Shared with the storefront mapping. */
export function saleTargetOf(product: Product): SaleTarget {
  return {
    id: String(product.id),
    priceFils: Number(product.priceFils),
    occasionIds: occasionIdsOf(product),
    category: String(product.category ?? ""),
  };
}

/**
 * The whole order. Reconciles exactly, in integers, or throws.
 *
 * `discounts` is optional so a caller with none prices exactly as before.
 */
export function priceOrder(
  lines: CheckoutLineRequest[],
  products: Map<string, Product>,
  emirate: string,
  discounts?: OrderDiscounts,
): PricedOrder {
  if (lines.length === 0) throw new Error("INVALID_ORDER: the basket is empty");

  const priced = lines.map((line) => {
    const product = products.get(line.productId);
    if (!product) throw new Error(`INVALID_PRODUCT: product ${line.productId} was not found`);
    /* The sale is chosen on the product's BASE price and then used for
       whichever size was picked, so the card, the product page, the basket
       and this function all name the same one. */
    const sale = discounts
      ? bestSaleFor(saleTargetOf(product), discounts.sales, discounts.now)
      : null;
    return priceLine(line, product, sale);
  });

  const subtotalFils = priced.reduce((sum, l) => sum + l.lineTotalFils, 0);
  const saleSavingsFils = priced.reduce(
    (sum, l) =>
      l.compareAtUnitPriceFils === null
        ? sum
        : sum + (l.compareAtUnitPriceFils - l.unitPriceFils) * l.quantity,
    0,
  );

  /* The code, measured against the subtotal AFTER sale prices. */
  let coupon: CouponRule | null = null;
  let couponRefusal: PricedCouponRefusal | null = null;
  let couponFils = 0;
  if (discounts?.coupon) {
    const check = checkCoupon(discounts.coupon, {
      now: discounts.now,
      subtotalFils,
      emailHasUsed: discounts.emailHasUsedCoupon,
    });
    if (check.ok) {
      coupon = discounts.coupon;
      couponFils = couponDiscountFils(subtotalFils, coupon);
    } else {
      couponRefusal = {
        reason: check.reason,
        ...(check.shortfallFils !== undefined ? { shortfallFils: check.shortfallFils } : {}),
      };
    }
  }

  /* Delivery is never discounted, and whether it is free is decided on what
     is actually being paid for the flowers. */
  const fee = deliveryFeeFils(emirate, subtotalFils - couponFils);
  const totalFils = subtotalFils - couponFils + fee;

  if (totalFils < 0 || !Number.isSafeInteger(totalFils)) {
    throw new Error("INVALID_TOTAL: computed total is not a valid amount");
  }
  /* There is no free-order path: only a card payment confirms an order, and
     a card cannot be charged less than this. */
  if (totalFils < MIN_CHARGE_FILS) {
    throw new Error(`TOTAL_TOO_LOW: computed total ${totalFils} is under the minimum charge`);
  }

  return {
    lines: priced,
    subtotalFils,
    deliveryFeeFils: fee,
    discountFils: couponFils,
    totalFils,
    saleSavingsFils,
    couponDiscountFils: couponFils,
    coupon,
    couponRefusal,
  };
}
