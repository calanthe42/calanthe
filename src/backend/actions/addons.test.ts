import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_ADDONS } from "@/lib/store-settings";

/**
 * Saving the owner's add-ons.
 *
 * The fake Payload below behaves like the real `settings` global: anyone may
 * read it, and it refuses an update that overrides access or comes from
 * anyone but the owner. So these tests check both walls — the action's own
 * owner check, and that its write would be refused for anyone else anyway.
 */

type Doc = Record<string, unknown>;

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ unstable_rethrow: () => undefined }));
const revalidated: string[] = [];
vi.mock("next/cache", () => ({
  revalidatePath: (path: string, type?: string) => {
    revalidated.push(type ? `${path}:${type}` : path);
  },
  revalidateTag: (tag: string) => {
    revalidated.push(`tag:${tag}`);
  },
  unstable_cache: <T,>(fn: T) => fn,
}));
vi.mock("@payload-config", () => ({ default: {} }));

const OWNER = { id: 1, role: "admin", email: "owner@example.com", name: "Owner" };
const STAFF = { id: 2, role: "staff", email: "florist@example.com", name: "Florist" };

const state: { user: Doc | null; addons: Doc[]; updatedAt: string | null } = { user: OWNER, addons: [], updatedAt: null };
const activity: Doc[] = [];
const updates: Doc[] = [];

const fakePayload = {
  auth: vi.fn(async () => ({ user: state.user })),
  findGlobal: vi.fn(async () => ({ id: 1, addons: state.addons, updatedAt: state.updatedAt })),
  updateGlobal: vi.fn(async (args: Doc) => {
    if (args.slug !== "settings") throw new Error("wrong global");
    if (args.overrideAccess !== false) throw new Error("the save must not override access");
    if ((args.user as Doc | null)?.role !== "admin") throw new Error("You are not allowed to perform this action.");
    updates.push(args);
    state.addons = ((args.data as Doc).addons as Doc[]).map((row, i) => ({ id: `row-${i}`, ...row }));
    state.updatedAt = "2026-11-01T10:00:00.000Z";
    return { id: 1, addons: state.addons };
  }),
  create: vi.fn(async (args: Doc) => {
    if (args.collection === "activity-log") activity.push(args.data as Doc);
    return {};
  }),
  logger: { error: vi.fn(), warn: vi.fn() },
};
vi.mock("payload", () => ({ getPayload: async () => fakePayload }));

const { saveAddons } = await import("./addons");

type Row = { key?: string; nameEn: string; nameAr: string; priceAed: string; active?: boolean };
const today = (): Row[] =>
  DEFAULT_ADDONS.map((a) => ({ key: a.key, nameEn: a.nameEn, nameAr: a.nameAr, priceAed: String(a.priceFils / 100), active: a.active }));
function form(rows: Row[]): FormData {
  const data = new FormData();
  data.append("addons", JSON.stringify(rows));
  return data;
}

beforeEach(() => {
  state.user = OWNER;
  state.addons = [];
  state.updatedAt = null;
  activity.length = 0;
  updates.length = 0;
  revalidated.length = 0;
  vi.clearAllMocks();
});

describe("saveAddons — owner only", () => {
  it("refuses staff, a signed-out visitor and a suspended owner, before reading anything", async () => {
    for (const user of [STAFF, null, { ...OWNER, accountStatus: "suspended" }]) {
      state.user = user;
      expect(await saveAddons(form(today()))).toEqual({
        ok: false,
        message: "Only the owner can change the add-ons.",
        code: "actions.addons.ownerOnly",
      });
    }
    expect(fakePayload.findGlobal).not.toHaveBeenCalled();
    expect(fakePayload.updateGlobal).not.toHaveBeenCalled();
  });

  it("saves as the owner, never around the global's own rule", async () => {
    const result = await saveAddons(form(today()));
    expect(result).toMatchObject({ ok: true, code: "actions.addons.saved" });
    expect(updates[0]).toMatchObject({ slug: "settings", overrideAccess: false, user: OWNER });
  });
});

describe("saveAddons — what is saved", () => {
  it("saves her prices in fils, her names, her switches and her order", async () => {
    const rows = today();
    rows[0] = { ...rows[0]!, priceAed: "160" };
    rows[3] = { ...rows[3]!, active: false };
    await saveAddons(form([rows[1]!, rows[0]!, rows[2]!, rows[3]!, rows[4]!]));
    expect((updates[0]!.data as Doc).addons).toEqual([
      { key: "balloon", nameEn: "Balloon", nameAr: "بالون", priceFils: 3_500, active: true },
      { key: "vase", nameEn: "Vase", nameAr: "مزهرية", priceFils: 16_000, active: true },
      { key: "cake", nameEn: "Bento Cake", nameAr: "كيكة بنتو", priceFils: 9_500, active: true },
      { key: "teddy", nameEn: "Teddy Bear", nameAr: "دبدوب", priceFils: 9_000, active: false },
      { key: "polaroid", nameEn: "Polaroid Card", nameAr: "بطاقة بولارويد", priceFils: 2_500, active: true },
    ]);
  });

  it("keeps a key through a rename, and gives a new add-on one from its English name, unique", async () => {
    await saveAddons(form([...today(), { nameEn: "Silk ribbon", nameAr: "شريط حرير", priceAed: "12.50" }]));
    /* Next visit: the vase renamed, a second "Silk ribbon" style row added. */
    const saved = state.addons.map((row) => ({
      key: String(row.key),
      nameEn: String(row.nameEn),
      nameAr: String(row.nameAr),
      priceAed: String(Number(row.priceFils) / 100),
      active: row.active !== false,
    }));
    saved[0] = { ...saved[0]!, nameEn: "Glass vase", nameAr: "مزهرية زجاجية" };
    await saveAddons(form([...saved, { nameEn: "Silk-Ribbon (red)", nameAr: "شريط حرير أحمر", priceAed: "15" }]));
    const keys = ((updates[1]!.data as Doc).addons as Doc[]).map((row) => row.key);
    expect(keys).toEqual(["vase", "balloon", "cake", "teddy", "polaroid", "silk-ribbon", "silk-ribbon-red"]);
  });

  it("does not let a browser send a key she has not got", async () => {
    await saveAddons(form([{ key: "vase", nameEn: "Vase", nameAr: "مزهرية", priceAed: "150" }, { key: "free-gift", nameEn: "Card", nameAr: "بطاقة", priceAed: "5" }]));
    expect(((updates[0]!.data as Doc).addons as Doc[]).map((row) => row.key)).toEqual(["vase", "card"]);
  });

  it("refuses what she typed wrong, in her words, and saves nothing", async () => {
    const rows = today();
    rows[2] = { ...rows[2]!, nameAr: " " };
    expect(await saveAddons(form(rows))).toEqual({
      ok: false,
      message: "Add-on 3: write its name in Arabic.",
      code: "actions.addons.nameArRequired",
      vars: { n: 3 },
    });
    rows[2] = { ...rows[2]!, nameAr: "كيكة", priceAed: "20000" };
    expect(await saveAddons(form(rows))).toMatchObject({ ok: false, code: "actions.addons.priceRange" });
    expect(await saveAddons(form([]))).toMatchObject({ ok: false, code: "actions.addons.atLeastOne" });
    expect(fakePayload.updateGlobal).not.toHaveBeenCalled();
    expect(activity).toHaveLength(0);
  });

  it("puts the change on the shop at once, and in the activity log", async () => {
    const rows = today().filter((row) => row.key !== "balloon");
    rows[0] = { ...rows[0]!, priceAed: "160" };
    await saveAddons(form(rows));
    expect(revalidated).toEqual(expect.arrayContaining(["tag:store-addons", "/:layout", "/admin/addons"]));
    expect(activity[0]).toMatchObject({ action: "update", area: "products", collection: "settings", itemLabel: "Add-ons" });
    expect(activity[0]!.summary).toBe("Add-ons: Vase price AED 150 → AED 160, Balloon AED 35 → removed");
    expect(activity[0]!.notable).toBe(true);
  });

  it("says nothing failed silently when the save itself fails", async () => {
    fakePayload.updateGlobal.mockRejectedValueOnce(new Error("connection reset\nat Pool.connect"));
    expect(await saveAddons(form(today()))).toMatchObject({ ok: false, code: "actions.addons.saveFailed" });
    expect(revalidated).toHaveLength(0);
  });
});
