import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The owner's costs actions, and the Cost section saved with a product.
 *
 * The fake Payload below behaves like the real owner-only collections: it
 * refuses any call that overrides access, and any user who is not the owner.
 * So these tests check both walls — the action's own owner check, and that
 * every call it makes would be refused for anyone else anyway.
 */

type Doc = Record<string, unknown>;

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
const revalidated: string[] = [];
vi.mock("next/cache", () => ({
  revalidatePath: (path: string, type?: string) => {
    revalidated.push(type ? `${path}:${type}` : path);
  },
  revalidateTag: vi.fn(),
}));
vi.mock("@payload-config", () => ({ default: {} }));
vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_SERVER_URL: "https://www.calanthe.ae" } }));

const OWNER = { id: 1, role: "admin", email: "owner@example.com", name: "Owner" };
const STAFF = { id: 2, role: "staff", email: "florist@example.com", name: "Florist" };

const COST_COLLECTIONS = new Set(["cost-items", "product-costs"]);

const state: {
  user: Doc | null;
  items: Map<number, Doc>;
  recipes: Map<number, Doc>;
  settings: Doc;
  nextId: number;
  failRecipeWrites: boolean;
} = { user: OWNER, items: new Map(), recipes: new Map(), settings: {}, nextId: 100, failRecipeWrites: false };
const activity: Doc[] = [];
const writes: { op: string; collection: string; args: Doc }[] = [];

/* The costs collections and the global are owner-only, read included. */
const guard = (args: Doc) => {
  if (args.overrideAccess !== false) throw new Error("a costs call must not override access");
  if ((args.user as Doc | null)?.role !== "admin") throw new Error("You are not allowed to perform this action.");
};

const table = (collection: unknown) => (collection === "cost-items" ? state.items : state.recipes);

const matches = (doc: Doc, where: Doc | undefined): boolean => {
  if (!where) return true;
  const [[field, condition]] = Object.entries(where) as [[string, Doc]];
  if (field === "id" && "in" in condition) return (condition.in as number[]).includes(doc.id as number);
  if (field === "product") return doc.product === condition.equals;
  if (field === "name" && "like" in condition) {
    return String(doc.name).toLowerCase().includes(String(condition.like).toLowerCase());
  }
  if (field === "archived") return doc.archived !== true;
  return true;
};

const fakePayload = {
  auth: vi.fn(async () => ({ user: state.user })),
  find: vi.fn(async (args: Doc) => {
    if (COST_COLLECTIONS.has(args.collection as string)) {
      guard(args);
      return { docs: [...table(args.collection).values()].filter((doc) => matches(doc, args.where as Doc)) };
    }
    return { docs: [] };
  }),
  findByID: vi.fn(async (args: Doc) => {
    if (args.collection === "products") return { id: args.id, name: "Amber Hour", description: null, seo: {} };
    guard(args);
    const doc = table(args.collection).get(args.id as number);
    if (!doc) throw new Error("Not Found");
    return doc;
  }),
  create: vi.fn(async (args: Doc) => {
    const collection = args.collection as string;
    if (collection === "activity-log") {
      activity.push(args.data as Doc);
      return {};
    }
    writes.push({ op: "create", collection, args });
    if (collection === "products") return { id: 41, ...(args.data as Doc) };
    guard(args);
    if (collection === "product-costs" && state.failRecipeWrites) throw new Error("database unavailable");
    const doc = { id: state.nextId++, ...(args.data as Doc) };
    table(collection).set(doc.id as number, doc);
    return doc;
  }),
  update: vi.fn(async (args: Doc) => {
    const collection = args.collection as string;
    writes.push({ op: "update", collection, args });
    if (collection === "products") return { id: args.id, name: "Amber Hour", ...(args.data as Doc) };
    guard(args);
    if (collection === "product-costs" && state.failRecipeWrites) throw new Error("database unavailable");
    const doc = { ...table(collection).get(args.id as number)!, ...(args.data as Doc) };
    table(collection).set(args.id as number, doc);
    return doc;
  }),
  delete: vi.fn(async (args: Doc) => {
    writes.push({ op: "delete", collection: args.collection as string, args });
    guard(args);
    table(args.collection).delete(args.id as number);
    return {};
  }),
  findGlobal: vi.fn(async (args: Doc) => {
    guard(args);
    return { ...state.settings };
  }),
  updateGlobal: vi.fn(async (args: Doc) => {
    writes.push({ op: "updateGlobal", collection: args.slug as string, args });
    guard(args);
    state.settings = { ...state.settings, ...(args.data as Doc) };
    return { ...state.settings };
  }),
  count: vi.fn(async () => ({ totalDocs: 0 })),
  logger: { error: vi.fn(), warn: vi.fn() },
};
vi.mock("payload", () => ({ getPayload: async () => fakePayload }));

const { archiveCostItem, saveCostItem, saveCostSettings } = await import("./costs");
const { createProduct, updateProduct } = await import("./admin");

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

const rose = (over: Record<string, string> = {}) =>
  form({ name: "Red Naomi rose", kind: "flower", useUnit: "stem", packName: "Bunch", unitsPerPack: "20", unitCostAed: "0.375", ...over });

const product = (over: Record<string, string> = {}) =>
  form({ name: "Amber Hour", priceAed: "480", category: "bouquet", ...over });

const recipe = (lines: { itemId: number; quantity: number }[], wastePercent = 10, makingMinutes = 20) =>
  JSON.stringify({ lines, wastePercent, makingMinutes });

const recipeWrites = () => writes.filter((w) => w.collection === "product-costs");

beforeEach(() => {
  vi.clearAllMocks();
  state.user = OWNER;
  state.items = new Map([
    [1, { id: 1, name: "Red Naomi rose", kind: "flower", useUnit: "stem", currentUnitCostFils: 37.5, costSource: "manual" }],
    [2, { id: 2, name: "Glass vase", kind: "container", useUnit: "piece", currentUnitCostFils: 1200, costSource: "purchase" }],
  ]);
  state.recipes = new Map();
  state.settings = {};
  state.nextId = 100;
  state.failRecipeWrites = false;
  activity.length = 0;
  writes.length = 0;
  revalidated.length = 0;
});

describe("owner only", () => {
  it("refuses a florist every costs action, before anything is read or written", async () => {
    state.user = STAFF;
    const refused = { ok: false, message: "Only the owner can do that.", code: "actions.costs.ownerOnly" };
    expect(await saveCostItem(rose())).toEqual(refused);
    expect(await archiveCostItem(1, true)).toEqual(refused);
    expect(await saveCostSettings(form({ targetMarginPercent: "60" }))).toEqual(refused);
    expect(writes).toEqual([]);
    expect(fakePayload.find).not.toHaveBeenCalled();
  });

  it("refuses a suspended owner and a signed-out visitor too", async () => {
    state.user = { ...OWNER, accountStatus: "suspended" };
    expect(await saveCostItem(rose())).toMatchObject({ code: "actions.costs.ownerOnly" });
    state.user = null;
    expect(await saveCostSettings(form({}))).toMatchObject({ code: "actions.costs.ownerOnly" });
    expect(writes).toEqual([]);
  });
});

describe("saveCostItem", () => {
  it("adds an item with a cost typed by hand, stored in fils for one stem", async () => {
    state.items.delete(1);
    const result = await saveCostItem(rose({ aliases: "RS NAOMI RED 60" }));
    expect(result).toEqual({
      ok: true,
      message: "“Red Naomi rose” added to your library.",
      code: "actions.costs.itemCreated",
      vars: { name: "Red Naomi rose" },
      id: 100,
    });
    const created = writes.find((w) => w.op === "create" && w.collection === "cost-items")!;
    expect(created.args).toMatchObject({ user: OWNER, overrideAccess: false });
    expect(created.args.data).toMatchObject({
      name: "Red Naomi rose",
      unitsPerPack: 20,
      currentUnitCostFils: 37.5,
      costSource: "manual",
      aliases: [{ text: "RS NAOMI RED 60" }],
    });
    expect(activity[0]).toMatchObject({ action: "create", collection: "cost-items", itemLabel: "Red Naomi rose" });
    expect(revalidated).toEqual(expect.arrayContaining(["/admin/costs:layout", "/admin/products:layout"]));
  });

  it("starts a new item with no cost at 0", async () => {
    await saveCostItem(rose({ name: "Kraft paper", kind: "wrapping", useUnit: "sheet", unitCostAed: "" }));
    expect(writes.find((w) => w.op === "create")!.args.data).toMatchObject({ currentUnitCostFils: 0, costSource: "manual" });
  });

  it("refuses a name already in the library, whatever its case", async () => {
    state.items.delete(1);
    state.items.set(7, { id: 7, name: "red naomi ROSE" });
    expect(await saveCostItem(rose())).toMatchObject({ ok: false, code: "actions.costs.nameTaken", vars: { name: "Red Naomi rose" } });
    expect(writes).toEqual([]);
  });

  it("lets an item keep its own name on edit", async () => {
    expect(await saveCostItem(rose({ id: "1", packName: "Box" }))).toMatchObject({ ok: true, code: "actions.costs.itemSaved", id: 1 });
  });

  it("keeps a cost taken from a purchase when the same cost is sent back", async () => {
    await saveCostItem(form({ id: "2", name: "Glass vase", kind: "container", useUnit: "piece", unitCostAed: "12" }));
    const data = writes.find((w) => w.op === "update")!.args.data as Doc;
    expect(data).not.toHaveProperty("costSource");
    expect(data).not.toHaveProperty("currentUnitCostFils");
  });

  it("makes the cost hers when she types a new one", async () => {
    await saveCostItem(form({ id: "2", name: "Glass vase", kind: "container", useUnit: "piece", unitCostAed: "13.50" }));
    expect(writes.find((w) => w.op === "update")!.args.data).toMatchObject({ currentUnitCostFils: 1350, costSource: "manual" });
  });

  it("answers a typing mistake in her words, saving nothing", async () => {
    expect(await saveCostItem(rose({ unitCostAed: "abc" }))).toEqual({
      ok: false,
      message: "Enter what one unit costs you in dirhams, like 0.75.",
      code: "actions.costs.costInvalid",
      vars: undefined,
    });
    expect(await saveCostItem(rose({ name: "" }))).toMatchObject({ code: "actions.costs.nameRequired" });
    expect(writes).toEqual([]);
  });
});

describe("archiveCostItem", () => {
  it("archives and restores, and says what that means", async () => {
    expect(await archiveCostItem(1, true)).toMatchObject({ ok: true, code: "actions.costs.itemArchived", vars: { name: "Red Naomi rose" } });
    expect(state.items.get(1)!.archived).toBe(true);
    expect(await archiveCostItem(1, false)).toMatchObject({ ok: true, code: "actions.costs.itemRestored" });
    expect(state.items.get(1)!.archived).toBe(false);
    expect(activity).toHaveLength(2);
  });

  it("says so when the item is gone", async () => {
    expect(await archiveCostItem(999, true)).toMatchObject({ ok: false });
  });
});

describe("saveCostSettings", () => {
  it("stores the hourly rate in fils", async () => {
    const result = await saveCostSettings(
      form({ targetMarginPercent: "55", labourRatePerHourAed: "72.50", defaultWastePercent: "12", vatRatePercent: "5" }),
    );
    expect(result).toEqual({ ok: true, message: "Cost settings saved.", code: "actions.costs.settingsSaved" });
    expect(fakePayload.updateGlobal).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: "cost-settings",
        user: OWNER,
        overrideAccess: false,
        data: {
          targetMarginPercent: 55,
          labourRatePerHourFils: 7250,
          defaultWastePercent: 12,
          vatReclaimable: false,
          vatRatePercent: 5,
        },
      }),
    );
    expect(activity[0]).toMatchObject({ collection: "cost-settings" });
  });

  it("refuses a target outside 1–95%", async () => {
    expect(
      await saveCostSettings(form({ targetMarginPercent: "99", labourRatePerHourAed: "60", defaultWastePercent: "10", vatRatePercent: "5" })),
    ).toMatchObject({ ok: false, code: "actions.costs.targetInvalid", vars: { min: 1, max: 95 } });
    expect(fakePayload.updateGlobal).not.toHaveBeenCalled();
  });
});

describe("the product's own Save", () => {
  it("creates a product without a Cost section and touches no recipe", async () => {
    expect(await createProduct(product())).toMatchObject({ ok: true, code: "actions.product.created", id: 41 });
    expect(recipeWrites()).toEqual([]);
  });

  it("creates the recipe after the product, as the owner", async () => {
    const result = await createProduct(product({ costRecipe: recipe([{ itemId: 1, quantity: 12 }, { itemId: 2, quantity: 1 }]) }));
    expect(result).toMatchObject({ ok: true, code: "actions.product.created", id: 41 });
    const order = writes.map((w) => `${w.op}:${w.collection}`);
    expect(order.indexOf("create:products")).toBeLessThan(order.indexOf("create:product-costs"));
    const created = recipeWrites()[0]!.args;
    expect(created).toMatchObject({ user: OWNER, overrideAccess: false });
    expect(created.data).toEqual({
      product: 41,
      lines: [
        { item: 1, quantity: 12 },
        { item: 2, quantity: 1 },
      ],
      wastePercent: 10,
      makingMinutes: 20,
    });
  });

  it("replaces an existing recipe on update", async () => {
    state.recipes.set(9, { id: 9, product: 41, lines: [{ item: 1, quantity: 3 }] });
    expect(await updateProduct(41, product({ costRecipe: recipe([{ itemId: 1, quantity: 7 }], 15, 30) }))).toMatchObject({
      ok: true,
      code: "actions.product.saved",
    });
    expect(recipeWrites().map((w) => w.op)).toEqual(["update"]);
    expect(state.recipes.get(9)).toMatchObject({ lines: [{ item: 1, quantity: 7 }], wastePercent: 15, makingMinutes: 30 });
  });

  it("removes the recipe when every line is taken out", async () => {
    state.recipes.set(9, { id: 9, product: 41, lines: [{ item: 1, quantity: 3 }] });
    await updateProduct(41, product({ costRecipe: recipe([]) }));
    expect(recipeWrites().map((w) => w.op)).toEqual(["delete"]);
    expect(state.recipes.size).toBe(0);
  });

  it("drops a line whose item has left the library", async () => {
    await createProduct(product({ costRecipe: recipe([{ itemId: 1, quantity: 2 }, { itemId: 555, quantity: 1 }]) }));
    expect(recipeWrites()[0]!.args.data).toMatchObject({ lines: [{ item: 1, quantity: 2 }] });
  });

  it("ignores a recipe sent by a florist", async () => {
    state.user = STAFF;
    await updateProduct(41, product({ costRecipe: recipe([{ itemId: 1, quantity: 99 }]) }));
    expect(writes.some((w) => w.collection === "products")).toBe(true);
    expect(recipeWrites()).toEqual([]);
    expect(fakePayload.find.mock.calls.some(([args]) => (args as Doc).collection === "product-costs")).toBe(false);
  });

  it("never loses a new product when its cost will not save, and says so", async () => {
    state.failRecipeWrites = true;
    const result = await createProduct(product({ costRecipe: recipe([{ itemId: 1, quantity: 2 }]) }));
    expect(result).toMatchObject({ ok: true, id: 41, code: "actions.costs.productCreatedCostFailed", vars: { name: "Amber Hour" } });
    expect(result.message).toContain("created, but its cost could not be saved");
    expect(writes.some((w) => w.op === "create" && w.collection === "products")).toBe(true);
  });

  it("keeps the product changes when the cost will not save on update, and asks to save again", async () => {
    state.failRecipeWrites = true;
    const result = await updateProduct(41, product({ costRecipe: recipe([{ itemId: 1, quantity: 2 }]) }));
    expect(result).toMatchObject({ ok: false, code: "actions.costs.productSavedCostFailed" });
    expect(writes.some((w) => w.op === "update" && w.collection === "products")).toBe(true);
  });

  it("treats an unreadable recipe as a cost not saved, never as a product not saved", async () => {
    const result = await createProduct(product({ costRecipe: "{broken" }));
    expect(result).toMatchObject({ ok: true, id: 41, code: "actions.costs.productCreatedCostFailed" });
    expect(recipeWrites()).toEqual([]);
  });
});
