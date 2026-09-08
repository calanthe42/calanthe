import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Product as PayloadProduct } from "@/payload-types";

/**
 * These tests exist for one reason: to prove that the storefront cannot be
 * served an unavailable product.
 *
 * That guarantee lives in the `where` clause of every query, not in the
 * callers — so the tests assert on the query Payload is actually asked to run.
 * A test that only checked the returned array would pass just as happily
 * against a layer that fetched everything and filtered in JavaScript, which is
 * exactly the mistake this design avoids: filtering after the fact leaks the
 * row to anyone who can reach the process.
 */

const find = vi.fn();

vi.mock("payload", () => ({
  getPayload: async () => ({ find }),
}));
vi.mock("@payload-config", () => ({ default: {} }));

const {
  getAvailableProductBySlug,
  getAvailableProductSlugs,
  getAvailableProducts,
  getBestSellers,
  getFeaturedProducts,
  getNewArrivals,
  getProductsForOccasion,
  __internal,
} = await import("./products");

/**
 * A complete Payload product document. Typed as the real generated `Product`
 * so a schema change breaks these tests rather than letting them drift.
 */
function doc(over: Partial<PayloadProduct> & Record<string, unknown> = {}): PayloadProduct {
  return {
    id: 1,
    slug: "amber-hour",
    name: "Amber Hour",
    priceFils: 48000,
    currency: "AED" as const,
    category: "bouquet" as const,
    createdAt: "2026-09-07T00:00:00.000Z",
    updatedAt: "2026-09-07T00:00:00.000Z",
    available: true,
    featured: true,
    newArrival: true,
    flowers: ["roses"] as PayloadProduct["flowers"],
    occasions: [{ slug: "birthday" }],
    legacyImages: [
      { alt: "Amber Hour", src: "https://example.test/a.jpg", placeholderSeed: "a", placeholderPalette: "warm" },
      { alt: "Amber Hour detail", src: null, placeholderSeed: "b", placeholderPalette: "olive" },
    ],
    ...over,
  } as PayloadProduct;
}

/** Every `where` clause must constrain availability, however it is nested. */
function requiresAvailable(where: unknown): boolean {
  const json = JSON.stringify(where);
  return json.includes('"available":{"equals":true}');
}

beforeEach(() => {
  find.mockReset();
  find.mockResolvedValue({ docs: [] });
});

describe("availability is enforced in the query", () => {
  const cases: [string, () => Promise<unknown>][] = [
    ["getAvailableProducts", () => getAvailableProducts()],
    ["getAvailableProductBySlug", () => getAvailableProductBySlug("amber-hour")],
    ["getFeaturedProducts", () => getFeaturedProducts()],
    ["getNewArrivals", () => getNewArrivals()],
    ["getBestSellers", () => getBestSellers()],
    ["getProductsForOccasion", () => getProductsForOccasion("birthday")],
    ["getAvailableProductSlugs", () => getAvailableProductSlugs()],
  ];

  for (const [name, call] of cases) {
    it(`${name} filters available: true in the database query`, async () => {
      await call();
      expect(find).toHaveBeenCalled();
      const { where } = find.mock.calls[0][0];
      expect(requiresAvailable(where)).toBe(true);
    });
  }
});

describe("query shape", () => {
  it("returns available products", async () => {
    find.mockResolvedValue({ docs: [doc()] });
    const products = await getAvailableProducts();
    expect(products).toHaveLength(1);
    expect(products[0].slug).toBe("amber-hour");
  });

  it("excludes unavailable products — the database returns none", async () => {
    find.mockResolvedValue({ docs: [] });
    expect(await getAvailableProducts()).toEqual([]);
  });

  it("returns null for an unavailable product by slug", async () => {
    find.mockResolvedValue({ docs: [] });
    expect(await getAvailableProductBySlug("hidden-product")).toBeNull();
  });

  it("returns null for an unknown slug", async () => {
    find.mockResolvedValue({ docs: [] });
    expect(await getAvailableProductBySlug("does-not-exist")).toBeNull();
  });

  it("does not query at all for an empty slug", async () => {
    expect(await getAvailableProductBySlug("")).toBeNull();
    expect(find).not.toHaveBeenCalled();
  });

  it("featured query also constrains featured", async () => {
    await getFeaturedProducts();
    expect(JSON.stringify(find.mock.calls[0][0].where)).toContain('"featured":{"equals":true}');
  });

  it("new arrivals query also constrains newArrival", async () => {
    await getNewArrivals();
    expect(JSON.stringify(find.mock.calls[0][0].where)).toContain('"newArrival":{"equals":true}');
  });

  it("occasion query constrains the occasion slug", async () => {
    await getProductsForOccasion("birthday");
    expect(JSON.stringify(find.mock.calls[0][0].where)).toContain('"occasions.slug"');
  });

  it("returns nothing for an empty occasion slug without querying", async () => {
    expect(await getProductsForOccasion("")).toEqual([]);
    expect(find).not.toHaveBeenCalled();
  });
});

describe("database failures", () => {
  it("propagates so the branded error boundary renders", async () => {
    find.mockRejectedValue(new Error("connection terminated"));
    /* Deliberately NOT swallowed into an empty array: an outage that renders
       as "no products" looks like an empty shop and hides the incident. */
    await expect(getAvailableProducts()).rejects.toThrow("connection terminated");
  });
});

describe("document mapping", () => {
  it("converts integer fils to the AED the storefront renders", () => {
    expect(__internal.toStorefrontProduct(doc({ priceFils: 48000 })).priceAed).toBe(480);
    expect(__internal.toStorefrontProduct(doc({ priceFils: 39050 })).priceAed).toBe(390.5);
  });

  it("exposes no admin-only fields", () => {
    const mapped = __internal.toStorefrontProduct(
      doc({ stock: 5, trackStock: true, compareAtPriceFils: 99000, seo: { noIndex: true } }),
    );
    expect(Object.keys(mapped).sort()).toEqual(
      ["featured", "flowers", "id", "images", "name", "newArrival", "occasions", "priceAed", "slug"],
    );
  });

  it("always yields exactly two images, even from one", () => {
    const mapped = __internal.toStorefrontProduct(
      doc({ legacyImages: [{ alt: "only", src: null, placeholderSeed: "x", placeholderPalette: "warm" }] }),
    );
    expect(mapped.images).toHaveLength(2);
  });

  it("yields two images even with none, so a page never breaks", () => {
    const mapped = __internal.toStorefrontProduct(doc({ legacyImages: [], images: [] }));
    expect(mapped.images).toHaveLength(2);
    expect(mapped.images[0].alt).toBe("Amber Hour");
  });

  it("prefers real Media over the imported legacy reference", () => {
    const mapped = __internal.toStorefrontProduct(
      doc({
        images: [
          {
            image: {
              id: 1,
              url: "/media/real.jpg",
              alt: "Real photograph",
              createdAt: "2026-09-07T00:00:00.000Z",
              updatedAt: "2026-09-07T00:00:00.000Z",
            },
          },
        ],
      }),
    );
    expect(mapped.images[0].src).toBe("/media/real.jpg");
    expect(mapped.images[0].alt).toBe("Real photograph");
  });

  it("maps occasion relationships to slugs", () => {
    expect(__internal.toStorefrontProduct(doc()).occasions).toEqual(["birthday"]);
  });

  it("survives occasions returned as bare ids", () => {
    expect(__internal.toStorefrontProduct(doc({ occasions: [7, 9] })).occasions).toEqual([]);
  });
});
