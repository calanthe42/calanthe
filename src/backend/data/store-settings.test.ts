import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";
import { DEFAULT_ADDONS } from "@/lib/store-settings";

/**
 * The loader: the saved `settings` global, or the defaults while nothing is
 * saved — and the defaults again, logged, when it cannot be read, except for
 * the owner's own editor, which must never open on a fallback.
 */

type Doc = Record<string, unknown>;

/* No Next runtime here: the cache wrapper simply calls through. */
vi.mock("next/cache", () => ({ unstable_cache: <T,>(fn: T) => fn }));
vi.mock("next/navigation", () => ({ unstable_rethrow: () => undefined }));
vi.mock("@payload-config", () => ({ default: {} }));

const state: { global: Doc | null; fail: boolean } = { global: null, fail: false };
const findGlobal = vi.fn<(args: Doc) => Promise<Doc>>(async () => {
  if (state.fail) throw new Error('relation "settings" does not exist');
  return state.global ?? { id: 1, addons: [], updatedAt: null };
});
const fakePayload = { findGlobal, logger: { error: vi.fn(), warn: vi.fn() } };
vi.mock("payload", () => ({ getPayload: async () => fakePayload }));

const { getAddonsForAdmin, getStoreAddons, readStoreAddons } = await import("./store-settings");
const payload = fakePayload as unknown as Payload;

const HER_ROWS = [
  { id: "r1", key: "vase", nameEn: "Glass vase", nameAr: "مزهرية زجاجية", priceFils: 16_000, active: true },
  { id: "r2", key: "teddy", nameEn: "Teddy Bear", nameAr: "دبدوب", priceFils: 9_000, active: false },
];

beforeEach(() => {
  state.global = null;
  state.fail = false;
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("readStoreAddons — what the checkout prices with", () => {
  it("reads the global under its own public rule: no user, no override", async () => {
    await readStoreAddons(payload);
    expect(findGlobal.mock.calls[0]![0]).toMatchObject({ slug: "settings", overrideAccess: false });
    expect(findGlobal.mock.calls[0]![0]).not.toHaveProperty("user");
  });

  it("is the defaults while nothing is saved", async () => {
    expect(await readStoreAddons(payload)).toEqual(DEFAULT_ADDONS);
  });

  it("is her whole list once saved — the switched-off ones too, so they are refused by name", async () => {
    state.global = { id: 1, addons: HER_ROWS, updatedAt: "2026-11-01T10:00:00.000Z" };
    expect((await readStoreAddons(payload)).map((a) => [a.key, a.priceFils, a.active])).toEqual([
      ["vase", 16_000, true],
      ["teddy", 9_000, false],
    ]);
  });

  it("falls back to the defaults, and says so, when the global cannot be read", async () => {
    state.fail = true;
    expect(await readStoreAddons(payload)).toEqual(DEFAULT_ADDONS);
    expect(fakePayload.logger.error).toHaveBeenCalledOnce();
  });
});

describe("getStoreAddons — what the storefront shows", () => {
  it("offers only the ones that are switched on", async () => {
    state.global = { id: 1, addons: HER_ROWS, updatedAt: "2026-11-01T10:00:00.000Z" };
    expect((await getStoreAddons()).map((a) => a.key)).toEqual(["vase"]);
  });

  it("shows the defaults rather than nothing when the global cannot be read", async () => {
    state.fail = true;
    expect(await getStoreAddons()).toEqual(DEFAULT_ADDONS);
  });
});

describe("getAddonsForAdmin — her editor", () => {
  it("says when the shop is still on the defaults", async () => {
    expect(await getAddonsForAdmin()).toEqual({ addons: DEFAULT_ADDONS, saved: false, version: "defaults" });
  });

  it("opens on her saved list, with a version that changes with each save", async () => {
    state.global = { id: 1, addons: HER_ROWS, updatedAt: "2026-11-01T10:00:00.000Z" };
    const result = await getAddonsForAdmin();
    expect(result.saved).toBe(true);
    expect(result.version).toBe("2026-11-01T10:00:00.000Z");
    expect(result.addons).toHaveLength(2);
  });

  it("never opens on a fallback she could save over her own list", async () => {
    state.fail = true;
    await expect(getAddonsForAdmin()).rejects.toThrow(/settings/);
  });
});
