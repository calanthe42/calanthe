import { describe, expect, it } from "vitest";
import { keyOf, liveAddonIds, mergeSameLines, sanitizeStoredItems, syncCartItems, type CartItem } from "./cart-lines";
import type { Product } from "./data";
import { DEFAULT_ADDONS, addonsForSale, type StoreAddon } from "./store-settings";

/**
 * The basket keeps only what can be bought: a stored basket read back after
 * the owner changed her add-ons, or an open one when the page refreshes with
 * her new list, drops what she no longer offers rather than sending the
 * server a line it would refuse.
 */

const product = (over: Partial<Product> = {}): Product =>
  ({
    id: "1",
    slug: "amber-hour",
    name: "Amber Hour",
    priceAed: 480,
    images: [{ alt: "Amber Hour", placeholder: { seed: "amber", palette: "warm" } }],
    ...over,
  }) as Product;

const FOR_SALE = addonsForSale(DEFAULT_ADDONS);

const stored = (over: Record<string, unknown> = {}) => ({
  productId: "1",
  sizeId: "standard",
  addonIds: ["vase"],
  qty: 1,
  ...over,
});

describe("liveAddonIds", () => {
  it("keeps the add-ons for sale, once each, in the order chosen", () => {
    expect(liveAddonIds(["polaroid", "vase", "polaroid"], FOR_SALE)).toEqual(["polaroid", "vase"]);
  });

  it("drops one she no longer offers, one she has switched off, and anything that is not a key", () => {
    const list = addonsForSale(DEFAULT_ADDONS.map((a) => (a.key === "teddy" ? { ...a, active: false } : a)));
    expect(liveAddonIds(["chocolates", "teddy", 7, null, "vase"], list)).toEqual(["vase"]);
    expect(liveAddonIds("vase", list)).toEqual([]);
  });
});

describe("sanitizeStoredItems — a basket read back from the browser", () => {
  it("keeps the add-ons for sale and drops chocolates, which are not", () => {
    const { items, dropped } = sanitizeStoredItems([stored({ addonIds: ["vase", "chocolates"] })], [product()], FOR_SALE);
    expect(items[0]!.addonIds).toEqual(["vase"]);
    expect(items[0]!.key).toBe(keyOf(items[0]!));
    /* The arrangement is still there: nothing to tell her. */
    expect(dropped).toBe(0);
  });

  it("takes the price and name from the catalogue, never from storage", () => {
    const { items } = sanitizeStoredItems([stored({ basePriceAed: 1, name: "Free flowers" })], [product()], FOR_SALE);
    expect(items[0]).toMatchObject({ basePriceAed: 480, name: "Amber Hour" });
  });

  it("makes one line of two that now say the same thing", () => {
    const { items, dropped } = sanitizeStoredItems(
      [stored({ addonIds: ["vase", "chocolates"], qty: 2 }), stored({ addonIds: ["vase"], qty: 19 })],
      [product()],
      FOR_SALE,
    );
    expect(items).toHaveLength(1);
    expect(items[0]!.qty).toBe(20);
    /* Merged, not lost: she is not told an arrangement was removed. */
    expect(dropped).toBe(0);
  });

  it("keeps no add-on at all when she offers none", () => {
    const { items } = sanitizeStoredItems([stored({ addonIds: ["vase", "balloon"] })], [product()], []);
    expect(items[0]!.addonIds).toEqual([]);
  });

  it("counts only the lines that could not be kept", () => {
    const { items, dropped } = sanitizeStoredItems([stored(), stored({ productId: "gone" }), "junk"], [product()], FOR_SALE);
    expect(items).toHaveLength(1);
    expect(dropped).toBe(2);
  });
});

describe("syncCartItems — an open basket when the page refreshes", () => {
  const line = (addonIds: string[], qty = 1): CartItem => {
    const item = {
      productId: "1",
      slug: "amber-hour",
      name: "Amber Hour",
      image: product().images[0]!,
      basePriceAed: 480,
      sizeId: "standard" as const,
      addonIds,
      qty,
    };
    return { ...item, key: keyOf(item) };
  };

  it("changes nothing when nothing changed", () => {
    expect(syncCartItems([line(["vase"])], [product()], FOR_SALE)).toBeNull();
  });

  it("takes off an add-on she has just switched off, and re-keys the line", () => {
    const list: StoreAddon[] = addonsForSale(DEFAULT_ADDONS.map((a) => (a.key === "vase" ? { ...a, active: false } : a)));
    const next = syncCartItems([line(["vase", "balloon"])], [product()], list);
    expect(next!.map((i) => i.addonIds)).toEqual([["balloon"]]);
    expect(next![0]!.key).toBe(keyOf(next![0]!));
  });

  it("merges the lines that become one", () => {
    const next = syncCartItems([line(["vase"], 2), line([], 3)], [product()], addonsForSale([]));
    expect(next).toHaveLength(1);
    expect(next![0]).toMatchObject({ addonIds: [], qty: 5 });
  });

  it("follows the add-ons even when the catalogue could not be read", () => {
    const next = syncCartItems([line(["vase"])], null, []);
    expect(next!.map((i) => [i.name, i.addonIds])).toEqual([["Amber Hour", []]]);
  });

  it("still drops a line whose product has left the catalogue", () => {
    expect(syncCartItems([line([])], [product({ id: "2" })], FOR_SALE)).toEqual([]);
  });
});

describe("mergeSameLines", () => {
  it("never holds more of one line than the checkout accepts", () => {
    const a = { ...stored(), key: "k", qty: 15 } as unknown as CartItem;
    const b = { ...stored(), key: "k", qty: 15 } as unknown as CartItem;
    expect(mergeSameLines([a, b])).toEqual([{ ...a, qty: 20 }]);
  });
});
