import { describe, expect, it } from "vitest";
import { Media } from "../../collections/Media";
import { MAX_UPLOAD_BYTES, resolveStorageMode } from "./storage";

/**
 * These assert the promises the media layer makes, so that a future edit that
 * quietly breaks one fails the build instead of production.
 */

describe("storage mode resolution", () => {
  it("uses Vercel Blob whenever a token is present", () => {
    expect(
      resolveStorageMode({ token: "vercel_blob_rw_test", vercelEnv: "production", isBuildPhase: false }),
    ).toBe("vercel-blob");
  });

  it("refuses to run in production without a token rather than losing uploads", () => {
    expect(() =>
      resolveStorageMode({ token: undefined, vercelEnv: "production", isBuildPhase: false }),
    ).toThrow(/BLOB_READ_WRITE_TOKEN is missing in production/);
  });

  it("production never silently falls back to the local filesystem", () => {
    let mode: string | undefined;
    try {
      mode = resolveStorageMode({ token: undefined, vercelEnv: "production", isBuildPhase: false });
    } catch {
      mode = "threw";
    }
    expect(mode).not.toBe("local-disk");
  });

  it("does not require the token during next build", () => {
    expect(
      resolveStorageMode({ token: undefined, vercelEnv: "production", isBuildPhase: true }),
    ).toBe("local-disk");
  });

  it("falls back to local disk in development", () => {
    expect(resolveStorageMode({ token: undefined, vercelEnv: undefined, isBuildPhase: false })).toBe(
      "local-disk",
    );
  });

  it("uses Blob on preview deployments when the store is connected", () => {
    expect(
      resolveStorageMode({ token: "vercel_blob_rw_test", vercelEnv: "preview", isBuildPhase: false }),
    ).toBe("vercel-blob");
  });

  it("allows a preview without a token, since preview data is disposable", () => {
    expect(resolveStorageMode({ token: undefined, vercelEnv: "preview", isBuildPhase: false })).toBe(
      "local-disk",
    );
  });
});

describe("upload configuration", () => {
  it("stays under Vercel's 4.5 MB serverless request-body limit", () => {
    expect(MAX_UPLOAD_BYTES).toBeLessThan(4.5 * 1024 * 1024);
    expect(MAX_UPLOAD_BYTES).toBeGreaterThan(0);
  });

  it("accepts only raster image types", () => {
    expect(Media.upload).toBeTruthy();
    const mimeTypes = (Media.upload as { mimeTypes?: string[] }).mimeTypes ?? [];
    expect(mimeTypes).toEqual(
      expect.arrayContaining(["image/jpeg", "image/png", "image/webp", "image/avif"]),
    );
    expect(mimeTypes.every((type) => type.startsWith("image/"))).toBe(true);
  });

  it("rejects SVG, which is a script container rather than a picture", () => {
    const mimeTypes = (Media.upload as { mimeTypes?: string[] }).mimeTypes ?? [];
    expect(mimeTypes).not.toContain("image/svg+xml");
  });

  it("keeps the responsive sizes the storefront renders", () => {
    const sizes = (Media.upload as { imageSizes?: { name: string }[] }).imageSizes ?? [];
    expect(sizes.map((size) => size.name).sort()).toEqual(["card", "hero", "og", "thumbnail"]);
  });

  it("keeps the local fallback directory outside the source tree", () => {
    const staticDir = (Media.upload as { staticDir?: string }).staticDir ?? "";
    expect(staticDir).not.toMatch(/[\\/]src[\\/]/);
    expect(staticDir).toMatch(/uploads$/);
  });
});

describe("media access control", () => {
  it("declares all four operations rather than relying on defaults", () => {
    expect(Media.access).toBeTruthy();
    for (const operation of ["read", "create", "update", "delete"] as const) {
      expect(typeof Media.access?.[operation]).toBe("function");
    }
  });

  it("is publicly readable, because product photography is public", () => {
    expect(Media.access?.read?.({ req: { user: null } } as never)).toBe(true);
  });

  it("is never publicly writable", () => {
    const anonymous = { req: { user: null } } as never;
    expect(Media.access?.create?.(anonymous)).toBe(false);
    expect(Media.access?.update?.(anonymous)).toBe(false);
    expect(Media.access?.delete?.(anonymous)).toBe(false);
  });

  it("refuses uploads from a signed-in customer", () => {
    const customer = { req: { user: { id: 1, role: "customer" } } } as never;
    expect(Media.access?.create?.(customer)).toBe(false);
    expect(Media.access?.update?.(customer)).toBe(false);
    expect(Media.access?.delete?.(customer)).toBe(false);
  });

  it("lets staff upload but not delete", () => {
    const staff = { req: { user: { id: 1, role: "staff" } } } as never;
    expect(Media.access?.create?.(staff)).toBe(true);
    expect(Media.access?.update?.(staff)).toBe(true);
    expect(Media.access?.delete?.(staff)).toBe(false);
  });

  it("gives admin full control", () => {
    const admin = { req: { user: { id: 1, role: "admin" } } } as never;
    expect(Media.access?.create?.(admin)).toBe(true);
    expect(Media.access?.update?.(admin)).toBe(true);
    expect(Media.access?.delete?.(admin)).toBe(true);
  });

  it("requires alt text, so an image is never inaccessible by default", () => {
    const alt = Media.fields.find((field) => "name" in field && field.name === "alt");
    expect(alt).toBeTruthy();
    expect((alt as { required?: boolean }).required).toBe(true);
  });
});
