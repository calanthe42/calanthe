import { addons, deliveryZones, FREE_DELIVERY_THRESHOLD_AED, sizes } from "@/lib/data";
import type { AddonId, SizeId } from "@/lib/data";
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
 */

export type CheckoutLineRequest = {
  productId: string;
  quantity: number;
  sizeId: SizeId;
  addonIds: readonly AddonId[];
  giftMessage?: string;
};

export type PricedLine = {
  product: Product;
  productName: string;
  productSlug: string;
  quantity: number;
  unitPriceFils: number;
  lineTotalFils: number;
  selectedOptions: { label: string; value: string }[];
};

export type PricedOrder = {
  lines: PricedLine[];
  subtotalFils: number;
  deliveryFeeFils: number;
  discountFils: number;
  totalFils: number;
};

const aedToFils = (aed: number) => Math.round(aed * 100);

/** Delivery fee for an emirate, waived above the free-delivery threshold. */
export function deliveryFeeFils(emirate: string, subtotalFils: number): number {
  if (subtotalFils >= aedToFils(FREE_DELIVERY_THRESHOLD_AED)) return 0;
  const zone = deliveryZones.find((z) => z.id === emirate);
  if (!zone) throw new Error(`INVALID_DELIVERY: unsupported emirate "${emirate}"`);
  return aedToFils(zone.feeAed);
}

/**
 * Prices one line against the authoritative product record.
 *
 * Throws rather than skipping: a checkout that silently drops a line the
 * customer chose is worse than one that fails and says why.
 */
export function priceLine(line: CheckoutLineRequest, product: Product): PricedLine {
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
  const unitPriceFils =
    baseFils +
    aedToFils(size.priceDeltaAed) +
    chosenAddons.reduce((sum, a) => sum + aedToFils(a.priceAed), 0);

  if (!Number.isSafeInteger(unitPriceFils) || unitPriceFils <= 0) {
    throw new Error("INVALID_TOTAL: computed unit price is not a valid amount");
  }

  const selectedOptions = [
    { label: "Size", value: size.name },
    ...chosenAddons.map((a) => ({ label: "Add-on", value: a.name })),
  ];

  return {
    product,
    productName: product.name,
    productSlug: product.slug,
    quantity: line.quantity,
    unitPriceFils,
    lineTotalFils: unitPriceFils * line.quantity,
    selectedOptions,
  };
}

/** The whole order. Reconciles exactly, in integers, or throws. */
export function priceOrder(
  lines: CheckoutLineRequest[],
  products: Map<string, Product>,
  emirate: string,
): PricedOrder {
  if (lines.length === 0) throw new Error("INVALID_ORDER: the basket is empty");

  const priced = lines.map((line) => {
    const product = products.get(line.productId);
    if (!product) throw new Error(`INVALID_PRODUCT: product ${line.productId} was not found`);
    return priceLine(line, product);
  });

  const subtotalFils = priced.reduce((sum, l) => sum + l.lineTotalFils, 0);
  const fee = deliveryFeeFils(emirate, subtotalFils);
  const discountFils = 0; /* Coupons are a documented extension point. */
  const totalFils = subtotalFils + fee - discountFils;

  if (totalFils < 0 || !Number.isSafeInteger(totalFils)) {
    throw new Error("INVALID_TOTAL: computed total is not a valid amount");
  }

  return { lines: priced, subtotalFils, deliveryFeeFils: fee, discountFils, totalFils };
}
