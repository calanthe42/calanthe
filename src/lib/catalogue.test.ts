import { describe, expect, it } from "vitest";
import { hasSecondView, productBadge, uniqueProductViews } from "./catalogue";
import type { ProductImage } from "./data";

const img = (src?: string, seed = "s"): ProductImage => ({
  alt: "a",
  src,
  placeholder: { seed, palette: "warm" },
});

describe("productBadge — badges are database state, never decoration", () => {
  it("says New when the document says newArrival", () => {
    expect(productBadge({ newArrival: true, featured: false })).toBe("New");
  });

  it("says Featured when the document says featured", () => {
    expect(productBadge({ newArrival: false, featured: true })).toBe("Featured");
  });

  it("shows at most one badge, and New outranks Featured", () => {
    expect(productBadge({ newArrival: true, featured: true })).toBe("New");
  });

  it("shows nothing when the document claims nothing", () => {
    expect(productBadge({ newArrival: false, featured: false })).toBeNull();
  });
});

describe("uniqueProductViews — the gallery shows real photographs only", () => {
  it("collapses the padded duplicate a one-photograph product carries", () => {
    const views = uniqueProductViews([img("/a.jpg"), img("/a.jpg")]);
    expect(views).toHaveLength(1);
    expect(views[0]?.src).toBe("/a.jpg");
  });

  it("keeps two genuinely different photographs, in order", () => {
    const views = uniqueProductViews([img("/a.jpg"), img("/b.jpg")]);
    expect(views.map((v) => v.src)).toEqual(["/a.jpg", "/b.jpg"]);
  });

  it("treats two different generated placeholders as two views", () => {
    expect(uniqueProductViews([img(undefined, "x"), img(undefined, "y")])).toHaveLength(2);
  });

  it("treats the same generated placeholder as one view", () => {
    expect(uniqueProductViews([img(undefined, "x"), img(undefined, "x")])).toHaveLength(1);
  });

  it("never invents a view for a product with a single image", () => {
    expect(uniqueProductViews([img("/only.jpg")])).toHaveLength(1);
  });
});

describe("hasSecondView — no hover crossfade between an image and itself", () => {
  it("is false when both slots hold the same photograph", () => {
    expect(hasSecondView([img("/a.jpg"), img("/a.jpg")])).toBe(false);
  });

  it("is true when the product really has two", () => {
    expect(hasSecondView([img("/a.jpg"), img("/b.jpg")])).toBe(true);
  });
});
