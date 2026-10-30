import { cartSaleOf, type CartSale } from "@/lib/cart-pricing";
import { sizes, timeSlots, type AddonId, type Product, type ProductImage, type SizeId } from "@/lib/data";
import type { StoreAddon } from "@/lib/store-settings";

/**
 * The basket's lines, without React: what a line is, how a stored basket is
 * read back, and how the lines follow the live catalogue and the live add-on
 * list. PURE — lib/cart.tsx holds the state and calls these — so the rules
 * that decide what a customer can be charged for are tested on their own
 * (cart-lines.test.ts).
 */

export type CartItem = {
  /** productId + size + sorted addons — one line per configuration. */
  key: string;
  productId: string;
  slug: string;
  name: string;
  image: ProductImage;
  /** The product's REGULAR base price. A sale never changes this. */
  basePriceAed: number;
  /**
   * The sale this product is on, when it is on one. ALWAYS taken from the
   * live catalogue — on hydration and on every re-sync — never from storage,
   * so a basket left overnight cannot keep yesterday's offer.
   */
  sale?: CartSale;
  sizeId: SizeId;
  addonIds: readonly AddonId[];
  qty: number;
  giftMessage?: string;
  /** Chosen on the product page; pre-fills checkout. */
  preferredDay?: string;
  preferredSlot?: string;
  recipientName?: string;
  recipientPhone?: string;
};

/** The most of one line the checkout accepts (backend/domain/pricing.ts). */
const MAX_QTY = 20;

export function keyOf(item: Omit<CartItem, "key">): string {
  return `${item.productId}|${item.sizeId}|${[...item.addonIds].sort().join(",")}|${item.giftMessage ?? ""}`;
}

/**
 * The add-ons a line may keep: those for sale now, once each, in the order
 * they were chosen. A key the owner has removed or switched off — or that
 * never existed — goes, because the server would refuse the whole line for
 * it (INVALID_OPTION).
 */
export function liveAddonIds(raw: unknown, forSale: readonly StoreAddon[]): AddonId[] {
  if (!Array.isArray(raw)) return [];
  const live = new Set(forSale.map((addon) => addon.key));
  const kept: AddonId[] = [];
  for (const id of raw) {
    if (typeof id === "string" && live.has(id) && !kept.includes(id)) kept.push(id);
  }
  return kept;
}

/**
 * Lines that have come to describe the same configuration — two baskets'
 * worth of "Amber Hour, with a vase" once a third add-on left both — are one
 * line, at the first one's place, up to the most one line can hold.
 */
export function mergeSameLines(items: readonly CartItem[]): CartItem[] {
  const merged: CartItem[] = [];
  for (const item of items) {
    const at = merged.findIndex((line) => line.key === item.key);
    if (at === -1) {
      merged.push(item);
      continue;
    }
    const line = merged[at]!;
    merged[at] = { ...line, qty: Math.min(line.qty + item.qty, MAX_QTY) };
  }
  return merged;
}

/**
 * Rebuild stored lines against the live catalog: unknown products are
 * dropped; name, slug, image, price and sale always come from the catalog so
 * stale or tampered storage can never change what is charged. Add-ons are
 * kept only while they are for sale.
 *
 * `dropped` counts the stored lines that could not be kept — the customer is
 * told about those. Two lines that now say the same thing and become one are
 * not "dropped": nothing she chose has gone.
 */
export function sanitizeStoredItems(
  parsed: unknown,
  products: readonly Product[],
  forSale: readonly StoreAddon[],
): { items: CartItem[]; dropped: number } {
  if (!Array.isArray(parsed)) return { items: [], dropped: 0 };
  const items: CartItem[] = [];
  for (const raw of parsed) {
    if (typeof raw !== "object" || raw === null) continue;
    const r = raw as Record<string, unknown>;
    const product = products.find((p) => p.id === r.productId);
    if (!product) continue;

    const sizeId = sizes.some((s) => s.id === r.sizeId)
      ? (r.sizeId as SizeId)
      : "standard";
    const addonIds = liveAddonIds(r.addonIds, forSale);
    const qty =
      typeof r.qty === "number" && Number.isInteger(r.qty)
        ? Math.min(Math.max(r.qty, 1), MAX_QTY)
        : 1;

    const item: Omit<CartItem, "key"> = {
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: product.images[0],
      basePriceAed: product.priceAed,
      /* From the catalogue, never from storage. */
      sale: cartSaleOf(product.sale),
      sizeId,
      addonIds,
      qty,
      giftMessage:
        typeof r.giftMessage === "string" && r.giftMessage.trim()
          ? r.giftMessage.slice(0, 220)
          : undefined,
      preferredDay: typeof r.preferredDay === "string" ? r.preferredDay : undefined,
      recipientName:
        typeof r.recipientName === "string" ? r.recipientName.slice(0, 80) : undefined,
      recipientPhone:
        typeof r.recipientPhone === "string" ? r.recipientPhone.slice(0, 24) : undefined,
      preferredSlot:
        typeof r.preferredSlot === "string" &&
        (timeSlots as readonly string[]).includes(r.preferredSlot)
          ? r.preferredSlot
          : undefined,
    };
    items.push({ ...item, key: keyOf(item) });
  }
  return { items: mergeSameLines(items), dropped: parsed.length - items.length };
}

/**
 * The lines, re-read against what the server has just sent: the catalogue
 * (name, photograph, price, sale; a line whose product has left is dropped)
 * and the add-ons for sale (one she has switched off or removed comes off
 * every line). `catalogue` null means "not known" — the read failed — and
 * leaves the products alone; it must never empty a basket.
 *
 * Returns null when nothing changed, so a refresh that brought no news
 * re-renders nothing and re-quotes nothing.
 */
export function syncCartItems(
  items: readonly CartItem[],
  catalogue: readonly Product[] | null,
  forSale: readonly StoreAddon[],
): CartItem[] | null {
  let changed = false;
  const next: CartItem[] = [];
  for (const item of items) {
    let line = item;
    if (catalogue) {
      const product = catalogue.find((p) => p.id === item.productId);
      if (!product) {
        changed = true;
        continue;
      }
      const sale = cartSaleOf(product.sale);
      const same =
        item.name === product.name &&
        item.slug === product.slug &&
        item.basePriceAed === product.priceAed &&
        JSON.stringify(item.sale ?? null) === JSON.stringify(sale ?? null);
      if (!same) {
        line = {
          ...line,
          name: product.name,
          slug: product.slug,
          image: product.images[0],
          basePriceAed: product.priceAed,
          sale,
        };
      }
    }
    const addonIds = liveAddonIds(line.addonIds, forSale);
    if (addonIds.length !== line.addonIds.length) {
      const fewer = { ...line, addonIds };
      line = { ...fewer, key: keyOf(fewer) };
    }
    if (line !== item) changed = true;
    next.push(line);
  }
  return changed ? mergeSameLines(next) : null;
}
