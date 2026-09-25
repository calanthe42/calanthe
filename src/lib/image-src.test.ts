import { describe, expect, it } from "vitest";
import { checkImageSrc } from "@/lib/image-src";

/**
 * `next/image` throws during render for a source it cannot optimise, and in a
 * Server Component a throw is a 500. These cases are the difference between a
 * page with a placeholder on it and no page at all.
 */
describe("checkImageSrc", () => {
  describe("absent — normal, no report", () => {
    it.each([undefined, null, "", "   "])("%o is absent", (src) => {
      expect(checkImageSrc(src as string | null | undefined).kind).toBe("absent");
    });
  });

  describe("usable", () => {
    it("accepts a same-origin path, which is what Payload's media route gives", () => {
      const v = checkImageSrc("/api/media/file/rose.png");
      expect(v.kind).toBe("ok");
    });

    it("accepts a path with encoded spaces and commas", () => {
      /* The real filename in this database: "ChatGPT Image Sep 23, 2026...". */
      const v = checkImageSrc("/api/media/file/ChatGPT%20Image%20Sep%2023%2C%202026.png");
      expect(v.kind).toBe("ok");
    });

    it.each([
      "https://images.unsplash.com/photo-1",
      "https://images.pexels.com/photos/2.jpeg",
      "https://abc123.public.blob.vercel-storage.com/media/rose.png",
    ])("accepts configured remote host %s", (src) => {
      expect(checkImageSrc(src).kind).toBe("ok");
    });
  });

  describe("unusable — placeholder and a report, never a throw", () => {
    it("rejects the localhost URL a local dev session writes", () => {
      /* The exact shape that reached production: a media row created with no
         Blob credentials, whose URL no deployment can fetch. */
      const v = checkImageSrc("http://localhost:3000/api/media/file/rose.png");
      expect(v.kind).toBe("unusable");
      if (v.kind === "unusable") expect(v.reason).toContain("not https");
    });

    it("rejects a host that is not in remotePatterns", () => {
      const v = checkImageSrc("https://example.com/rose.png");
      expect(v.kind).toBe("unusable");
      if (v.kind === "unusable") expect(v.reason).toContain("remotePatterns");
    });

    it("rejects the apex of a wildcard pattern, matching Next's own rule", () => {
      expect(checkImageSrc("https://public.blob.vercel-storage.com/x.png").kind).toBe(
        "unusable",
      );
    });

    it("rejects a lookalike host that merely ends with the pattern", () => {
      expect(checkImageSrc("https://evilimages.pexels.com.attacker.net/x").kind).toBe(
        "unusable",
      );
    });

    it("rejects a protocol-relative URL", () => {
      expect(checkImageSrc("//images.unsplash.com/photo").kind).toBe("unusable");
    });

    it.each(["not a url at all", "data:image/png;base64,AAAA", "ftp://host/x.png"])(
      "rejects %s",
      (src) => {
        expect(checkImageSrc(src).kind).toBe("unusable");
      },
    );

    it("rejects plain http even on an allowed host", () => {
      expect(checkImageSrc("http://images.unsplash.com/photo").kind).toBe("unusable");
    });
  });

  it("never throws, whatever it is given", () => {
    const nasty = [
      "https://",
      "://",
      "https://[",
      "\u0000",
      "/".repeat(5000),
      "https://images.unsplash.com/" + "a".repeat(5000),
    ];
    for (const src of nasty) {
      expect(() => checkImageSrc(src)).not.toThrow();
    }
  });
});
