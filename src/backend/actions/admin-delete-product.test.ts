import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Deleting a product from the admin — including one that has been ordered
 * (the owner's decision of 29 Oct 2026). The orders keep their own lines.
 */

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@payload-config", () => ({ default: {} }));
vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_SERVER_URL: "https://www.calanthe.ae" } }));
const recordActivity = vi.fn(async () => undefined);
vi.mock("@backend/activity/record", () => ({
  diffFields: () => [],
  recordActivity: (...args: unknown[]) => recordActivity(...(args as [])),
}));

const owner = { id: 1, role: "admin", email: "owner@calanthe.ae" };
const fakePayload = {
  auth: vi.fn(async () => ({ user: owner })),
  count: vi.fn(async () => ({ totalDocs: 0 })),
  findByID: vi.fn(async () => ({ id: 3, name: "Quiet Devotion" })),
  delete: vi.fn<(args: Record<string, unknown>) => Promise<{ id: number }>>(async () => ({ id: 3 })),
};
vi.mock("payload", () => ({ getPayload: async () => fakePayload }));

const { deleteProduct } = await import("./admin");

beforeEach(() => {
  vi.clearAllMocks();
  fakePayload.count.mockResolvedValue({ totalDocs: 0 });
});

describe("deleteProduct", () => {
  it("deletes a product that was never ordered", async () => {
    expect(await deleteProduct(3)).toEqual({
      ok: true,
      message: "“Quiet Devotion” deleted.",
      code: "actions.product.deleted",
      vars: { name: "Quiet Devotion" },
    });
    expect(fakePayload.delete).toHaveBeenCalledWith({ collection: "products", id: 3, user: owner, overrideAccess: false });
  });

  it("deletes an ordered product too, and says its orders keep their details", async () => {
    fakePayload.count.mockResolvedValue({ totalDocs: 3 });
    const result = await deleteProduct(3);
    expect(result).toMatchObject({
      ok: true,
      code: "actions.product.ordered",
      vars: { count: 3, name: "Quiet Devotion" },
    });
    expect(result.message).toContain("3 past orders keep the name and price");
    expect(fakePayload.delete).toHaveBeenCalledTimes(1);
  });

  it("still deletes only with the owner's own permissions", async () => {
    await deleteProduct(3);
    expect(fakePayload.delete.mock.calls[0]![0]).toMatchObject({ user: owner, overrideAccess: false });
    expect(recordActivity).toHaveBeenCalledWith(
      fakePayload,
      expect.objectContaining({ action: "delete", itemLabel: "Quiet Devotion" }),
    );
  });
});
