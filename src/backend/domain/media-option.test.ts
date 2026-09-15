import { describe, expect, it } from "vitest";
import { collectMediaUsage, listNames } from "./media-option";

describe("collectMediaUsage — a photo in use is never deleted from under a product", () => {
  it("records every product, share image and occasion that uses a photo", () => {
    const usage = collectMediaUsage(
      [
        { name: "Amber Hour", images: [{ image: 4 }, { image: { id: 9 } }], seo: { image: 4 } },
        { name: "Velvet Hour", images: [{ image: 4 }] },
      ],
      [{ name: "Birthday", image: { id: 9 } }, { name: "Love", image: null }],
    );
    expect(usage.get(4)).toEqual(["Amber Hour", "Amber Hour (share image)", "Velvet Hour"]);
    expect(usage.get(9)).toEqual(["Amber Hour", "Birthday occasion"]);
    expect(usage.has(1)).toBe(false);
  });

  it("does not list the same product twice for the same photo", () => {
    const usage = collectMediaUsage([{ name: "Amber Hour", images: [{ image: 4 }, { image: 4 }] }], []);
    expect(usage.get(4)).toEqual(["Amber Hour"]);
  });
});

describe("listNames", () => {
  it("reads naturally at every length", () => {
    expect(listNames([])).toBe("");
    expect(listNames(["A"])).toBe("A");
    expect(listNames(["A", "B"])).toBe("A and B");
    expect(listNames(["A", "B", "C"])).toBe("A, B and C");
    expect(listNames(["A", "B", "C", "D", "E"])).toBe("A, B and 3 more");
  });
});

describe("servedMediaPath — media URLs next/image can actually load", () => {
  it("serves this app's own file route root-relative, whatever host Payload built", async () => {
    const { servedMediaPath } = await import("./media-option");
    expect(servedMediaPath("http://localhost:3000/api/media/file/a-400x500.jpg")).toBe("/api/media/file/a-400x500.jpg");
    expect(servedMediaPath("https://calanthe.ae/api/media/file/a.jpg?v=2")).toBe("/api/media/file/a.jpg?v=2");
    expect(servedMediaPath("/api/media/file/a.jpg")).toBe("/api/media/file/a.jpg");
  });

  it("leaves other hosts absolute (they are allowed by remotePatterns)", async () => {
    const { servedMediaPath } = await import("./media-option");
    const blob = "https://abc.public.blob.vercel-storage.com/a.jpg";
    expect(servedMediaPath(blob)).toBe(blob);
  });

  it("returns nothing for a missing or unparseable URL", async () => {
    const { servedMediaPath } = await import("./media-option");
    expect(servedMediaPath(null)).toBeUndefined();
    expect(servedMediaPath("")).toBeUndefined();
    expect(servedMediaPath("not a url")).toBeUndefined();
  });
});
