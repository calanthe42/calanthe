import { sizes, type AddonId, type ProductSale, type SizeId } from "@/lib/data";
import { saleUnitFils } from "@/lib/discounts";
import type { StoreAddon } from "@/lib/store-settings";

/**
 * What one basket line costs, in the browser.
 *
 * PURE, and deliberately separate from the cart's React code so it can be
 * tested beside the server's `priceLine` (backend/domain/pricing.ts): both
 * call the same `saleUnitFils`, on the same arrangement — base price plus
 * size uplift — and add the add-ons at full price afterwards. The parity test
 * in cart-pricing.test.ts pins the two together, so what a customer is shown
 * and what she is charged cannot drift apart.
 *
 * This is a DISPLAY. The server never reads a price from the browser; if the
 * two ever did disagree, checkout answers PRICE_CHANGED and charges nothing.
 *
 * THE ADD-ONS ARE PASSED IN: the owner's list as the storefront layout read
 * it (lib/store-settings.ts), the same list the server prices with. A key that
 * is not on it costs nothing here — and the basket never keeps one, because
 * the server would refuse the line (lib/cart-lines.ts `liveAddonIds`).
 */

/** As much of a sale as a basket line needs: the label and the terms. */
export type CartSale = Pick<ProductSale, "id" | "label" | "valueType" | "percentOff" | "amountOffFils">;

export type PricedSelection = {
  /** The product's REGULAR base price. */
  basePriceAed: number;
  sizeId: SizeId;
  addonIds: readonly AddonId[];
  sale?: CartSale;
};

const toFils = (aed: number): number => Math.round(aed * 100);

function parts(
  item: PricedSelection,
  addons: readonly StoreAddon[],
): { arrangementFils: number; addonFils: number } {
  const size = sizes.find((s) => s.id === item.sizeId);
  const addonFils = item.addonIds.reduce(
    (sum, id) => sum + (addons.find((a) => a.key === id)?.priceFils ?? 0),
    0,
  );
  return {
    arrangementFils: toFils(item.basePriceAed) + toFils(size?.priceDeltaAed ?? 0),
    addonFils,
  };
}

/** The regular unit price in fils: no sale applied. */
export function itemRegularUnitFils(item: PricedSelection, addons: readonly StoreAddon[]): number {
  const { arrangementFils, addonFils } = parts(item, addons);
  return arrangementFils + addonFils;
}

/** The unit price the customer pays, in fils: the sale lowers the arrangement only. */
export function itemUnitFils(item: PricedSelection, addons: readonly StoreAddon[]): number {
  const { arrangementFils, addonFils } = parts(item, addons);
  const arrangement = item.sale ? saleUnitFils(arrangementFils, item.sale) : arrangementFils;
  return arrangement + addonFils;
}

/** The same two figures in dirhams, for the places that still speak AED. */
export function itemUnitPrice(item: PricedSelection, addons: readonly StoreAddon[]): number {
  return itemUnitFils(item, addons) / 100;
}

export function itemRegularUnitPrice(item: PricedSelection, addons: readonly StoreAddon[]): number {
  return itemRegularUnitFils(item, addons) / 100;
}

/** The part of a product's sale a basket line keeps. */
export function cartSaleOf(sale: ProductSale | undefined): CartSale | undefined {
  if (!sale) return undefined;
  return {
    id: sale.id,
    label: sale.label,
    valueType: sale.valueType,
    percentOff: sale.percentOff,
    amountOffFils: sale.amountOffFils,
  };
}
