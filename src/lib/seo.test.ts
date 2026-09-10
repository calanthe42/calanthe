import { describe, expect, it } from "vitest";
import { breadcrumbJsonLd, floristJsonLd, productJsonLd, websiteJsonLd } from "./seo";

/**
 * The point of these tests is not that the JSON serialises. It is that
 * the structured data cannot quietly grow the fields that would make it
 * a lie — Calanthe has no reviews, no ratings and no awards, and those
 * are exactly the fields that most improve a search listing.
 */
const FABRICATION_FIELDS = ["aggregateRating", "review", "reviews", "award"];

describe("structured data claims nothing the business cannot back", () => {
  it("emits no ratings, reviews or awards anywhere", () => {
    const payloads = [
      floristJsonLd(),
      websiteJsonLd(),
      productJsonLd({ name: "Amber", slug: "amber", priceAed: 480 }),
      breadcrumbJsonLd([{ name: "Home", path: "/" }]),
    ];
    for (const payload of payloads) {
      const json = JSON.stringify(payload);
      for (const field of FABRICATION_FIELDS) {
        expect(json).not.toContain(field);
      }
    }
  });

  it("describes the florist with real contact details only", () => {
    const data = floristJsonLd();
    expect(data["@type"]).toBe("Florist");
    expect(data.email).toBe("calanthe.ae@gmail.com");
    expect(data.telephone).toBe("+971 56 211 2733");
    /* No guessed street address: a wrong one in structured data is the
       single SEO error that costs a real delivery. */
    expect(data).not.toHaveProperty("address");
  });

  it("prices a product in AED, as a decimal string, at the real price", () => {
    const offers = productJsonLd({ name: "Amber", slug: "amber", priceAed: 480 })
      .offers as Record<string, unknown>;
    expect(offers.priceCurrency).toBe("AED");
    expect(offers.price).toBe("480.00");
  });

  it("omits the image key entirely when a product has no photograph", () => {
    expect(productJsonLd({ name: "Amber", slug: "amber", priceAed: 480 })).not.toHaveProperty(
      "image",
    );
  });

  it("numbers breadcrumb positions from one, in order", () => {
    const items = breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Shop", path: "/shop" },
    ]).itemListElement as Array<Record<string, unknown>>;
    expect(items.map((i) => i.position)).toEqual([1, 2]);
    expect(items[1]?.name).toBe("Shop");
  });
});

describe("product structured data images", () => {
  it("turns a root-relative photo path into an absolute URL, as search engines require", () => {
    const data = productJsonLd({ name: "Amber", slug: "amber", priceAed: 480, image: "/api/media/file/a.jpg" });
    expect(String(data.image)).toMatch(/^https?:\/\/[^/]+\/api\/media\/file\/a\.jpg$/);
  });
});
