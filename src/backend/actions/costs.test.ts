import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InvoiceInput } from "@backend/domain/costs";

/**
 * The owner's costs actions — her invoices and the things she buys — and
 * "what goes in" saved with a product.
 *
 * The fake Payload below behaves like the real owner-only collections: it
 * refuses any call that overrides access, and any user who is not the owner.
 * So these tests check both walls — the action's own owner check, and that
 * every call it makes would be refused for anyone else anyway. It also
 * keeps a copy of everything when a transaction starts and puts it back on
 * a rollback, so "saved whole or not at all" is tested, not assumed.
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

const COSTS = ["suppliers", "cost-items", "invoices", "product-costs"] as const;
type CostSlug = (typeof COSTS)[number];
const isCost = (slug: unknown): slug is CostSlug => (COSTS as readonly unknown[]).includes(slug);

const db: Record<CostSlug, Map<number, Doc>> = {
  suppliers: new Map(),
  "cost-items": new Map(),
  invoices: new Map(),
  "product-costs": new Map(),
};
const state = { user: OWNER as Doc | null, nextId: 100, failOn: null as string | null };
const activity: Doc[] = [];
const writes: { op: string; collection: string; args: Doc }[] = [];
const tx = { begun: 0, committed: 0, killed: 0, snapshot: null as string | null };

/* The costs collections are owner-only, read included. */
const guard = (args: Doc) => {
  if (args.overrideAccess !== false) throw new Error("a costs call must not override access");
  if ((args.user as Doc | null)?.role !== "admin") throw new Error("You are not allowed to perform this action.");
};

const idOf = (value: unknown) => (typeof value === "object" && value !== null ? (value as Doc).id : value);

/** Enough of Payload's `where` for these actions: and, equals, not_equals, in, like, and lines.item. */
function matches(doc: Doc, where: Doc | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([field, condition]) => {
    if (field === "and") return (condition as Doc[]).every((part) => matches(doc, part));
    const test = (value: unknown) => {
      const c = condition as Doc;
      if ("equals" in c) return idOf(value) === c.equals;
      if ("not_equals" in c) return value !== c.not_equals;
      if ("in" in c) return (c.in as unknown[]).includes(idOf(value));
      if ("like" in c) return String(value ?? "").toLowerCase().includes(String(c.like).toLowerCase());
      return true;
    };
    if (field === "lines.item") return ((doc.lines as Doc[]) ?? []).some((line) => test(line.item));
    return test(doc[field]);
  });
}

const fail = (op: string, collection: string) => {
  if (state.failOn === `${op}:${collection}`) throw new Error("database unavailable");
};

const fakePayload = {
  auth: vi.fn(async () => ({ user: state.user })),
  find: vi.fn(async (args: Doc) => {
    if (!isCost(args.collection)) return { docs: [] };
    guard(args);
    const docs = [...db[args.collection].values()].filter((doc) => matches(doc, args.where as Doc));
    return { docs: structuredClone(docs) };
  }),
  findByID: vi.fn(async (args: Doc) => {
    if (args.collection === "products") return { id: args.id, name: "Peach Reverie", description: null, seo: {} };
    if (!isCost(args.collection)) throw new Error("Not Found");
    guard(args);
    const doc = db[args.collection].get(args.id as number);
    if (!doc) throw new Error("Not Found");
    return structuredClone(doc);
  }),
  create: vi.fn(async (args: Doc) => {
    const collection = args.collection as string;
    if (collection === "activity-log") {
      activity.push(args.data as Doc);
      return {};
    }
    writes.push({ op: "create", collection, args });
    if (collection === "products") return { id: 41, ...(args.data as Doc) };
    if (!isCost(collection)) return {};
    guard(args);
    fail("create", collection);
    const now = "2026-10-30T10:00:00.000Z";
    const doc = { id: state.nextId++, createdAt: now, updatedAt: now, ...(args.data as Doc) };
    db[collection].set(doc.id as number, doc);
    return structuredClone(doc);
  }),
  update: vi.fn(async (args: Doc) => {
    const collection = args.collection as string;
    writes.push({ op: "update", collection, args });
    if (collection === "products") return { id: args.id, name: "Peach Reverie", ...(args.data as Doc) };
    if (!isCost(collection)) return {};
    guard(args);
    fail("update", collection);
    const current = db[collection].get(args.id as number);
    if (!current) throw new Error("Not Found");
    const doc = { ...current, ...(args.data as Doc) };
    db[collection].set(args.id as number, doc);
    return structuredClone(doc);
  }),
  delete: vi.fn(async (args: Doc) => {
    writes.push({ op: "delete", collection: args.collection as string, args });
    if (!isCost(args.collection)) return {};
    guard(args);
    db[args.collection].delete(args.id as number);
    return {};
  }),
  count: vi.fn(async () => ({ totalDocs: 0 })),
  logger: { error: vi.fn(), warn: vi.fn() },
};

const dump = () => JSON.stringify(Object.fromEntries(COSTS.map((slug) => [slug, [...db[slug]]])));
vi.mock("payload", () => ({
  getPayload: async () => fakePayload,
  createLocalReq: async (options: Doc) => ({ user: options.user }),
  initTransaction: async () => {
    tx.begun += 1;
    tx.snapshot = dump();
    return true;
  },
  commitTransaction: async () => {
    tx.committed += 1;
    tx.snapshot = null;
  },
  killTransaction: async () => {
    tx.killed += 1;
    if (tx.snapshot) {
      const saved = JSON.parse(tx.snapshot) as Record<CostSlug, [number, Doc][]>;
      for (const slug of COSTS) db[slug] = new Map(saved[slug]);
    }
    tx.snapshot = null;
  },
}));

const { archiveCostItem, deleteInvoice, saveCostItem, saveInvoice } = await import("./costs");
const { createProduct, updateProduct } = await import("./admin");

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

const midday = (day: string) => new Date(`${day}T12:00:00+04:00`).toISOString();

const rose = (over: Record<string, string> = {}) =>
  form({ name: "Peach Avalanche rose", group: "flowers", packName: "bunch", unitsPerPack: "20", one: "stem", ...over });

/** The concept's invoice: AED 800 of lines, AED 20 delivery, AED 41 VAT, AED 861 printed. */
const alAweer = (over: Partial<InvoiceInput> = {}): InvoiceInput => ({
  supplier: { name: "Al Aweer Flowers" },
  invoiceNumber: "INV-1042",
  invoiceDate: "2026-10-26",
  deliveryAed: "20",
  vatAed: "41",
  totalAed: "861",
  lines: [
    { itemId: 13, printedName: "ROSE PEACH AVAL 50CM", packs: 5, unitsPerPack: 20, lineTotalAed: "300" },
    {
      itemId: null,
      newItem: { name: "Spray rose", group: "flowers", packName: "bunch", unitsPerPack: 10, one: "stem" },
      packs: 25,
      unitsPerPack: 10,
      lineTotalAed: "500",
    },
  ],
  ...over,
});

const product = (over: Record<string, string> = {}) =>
  form({ name: "Peach Reverie", priceAed: "450", category: "bouquet", ...over });
const recipe = (lines: { itemId: number; quantity: number }[], extra: Doc = {}) => JSON.stringify({ lines, ...extra });
const recipeWrites = () => writes.filter((w) => w.collection === "product-costs");
const costWrites = () => writes.filter((w) => isCost(w.collection));

beforeEach(() => {
  vi.clearAllMocks();
  state.user = OWNER;
  state.nextId = 100;
  state.failOn = null;
  db.suppliers = new Map([[5, { id: 5, name: "Holland Direct", createdAt: "2026-10-01T09:00:00.000Z" }]]);
  db["cost-items"] = new Map([
    [
      13,
      { id: 13, name: "Peach Avalanche rose", group: "flowers", packName: "bunch", unitsPerPack: 20, one: "stem", currentUnitCostFils: 369, costSource: "typed", aliases: [] },
    ],
    [
      15,
      { id: 15, name: "Hat box", group: "packaging", packName: "carton", unitsPerPack: 25, one: "piece", currentUnitCostFils: 2200, costSource: "invoice", lastPaidAt: midday("2026-10-12"), lastSupplier: 5, aliases: [] },
    ],
  ]);
  db.invoices = new Map([
    [
      50,
      {
        id: 50,
        supplier: 5,
        invoiceNumber: "hd-77",
        invoiceDate: midday("2026-10-12"),
        createdAt: "2026-10-12T15:00:00.000Z",
        deliveryFils: 0,
        vatFils: 0,
        totalFils: 55000,
        source: "typed",
        lines: [{ item: 15, packs: 1, unitsPerPack: 25, units: 25, lineTotalFils: 55000, priceForOneFils: 2200 }],
      },
    ],
  ]);
  db["product-costs"] = new Map();
  tx.begun = 0;
  tx.committed = 0;
  tx.killed = 0;
  tx.snapshot = null;
  activity.length = 0;
  writes.length = 0;
  revalidated.length = 0;
});

describe("owner only", () => {
  it("refuses a florist every costs action, before anything is read or written", async () => {
    state.user = STAFF;
    const refused = { ok: false, message: "Only the owner can do that.", code: "actions.costs.ownerOnly" };
    expect(await saveCostItem(rose())).toEqual(refused);
    expect(await archiveCostItem(13, true)).toEqual(refused);
    expect(await saveInvoice(alAweer())).toEqual(refused);
    expect(await deleteInvoice(50)).toEqual(refused);
    expect(writes).toEqual([]);
    expect(fakePayload.find).not.toHaveBeenCalled();
    expect(fakePayload.findByID).not.toHaveBeenCalled();
    expect(tx.begun).toBe(0);
  });

  it("refuses a suspended owner and a signed-out visitor too", async () => {
    state.user = { ...OWNER, accountStatus: "suspended" };
    expect(await saveInvoice(alAweer())).toMatchObject({ ok: false, code: "actions.costs.ownerOnly" });
    state.user = null;
    expect(await saveCostItem(rose())).toMatchObject({ code: "actions.costs.ownerOnly" });
    expect(writes).toEqual([]);
  });
});

describe("saveCostItem", () => {
  it("adds something new with no price yet — null, never 0", async () => {
    const result = await saveCostItem(rose({ name: "Eucalyptus", group: "greenery", unitsPerPack: "10" }));
    expect(result).toEqual({
      ok: true,
      message: "“Eucalyptus” added to what you buy.",
      code: "actions.costs.itemCreated",
      vars: { name: "Eucalyptus" },
      id: 100,
    });
    const created = writes.find((w) => w.op === "create" && w.collection === "cost-items")!;
    expect(created.args).toMatchObject({ user: OWNER, overrideAccess: false });
    expect(created.args.data).toEqual({
      name: "Eucalyptus",
      group: "greenery",
      packName: "bunch",
      unitsPerPack: 10,
      one: "stem",
      archived: false,
      currentUnitCostFils: null,
      costSource: "typed",
    });
    expect(activity[0]).toMatchObject({ action: "create", collection: "cost-items", itemLabel: "Eucalyptus" });
    expect(revalidated).toEqual(expect.arrayContaining(["/admin/costs:layout", "/admin/products:layout"]));
  });

  it("stores a typed price for one in fils", async () => {
    await saveCostItem(rose({ name: "Cake", group: "extra", one: "piece", packName: "single", unitsPerPack: "1", priceAed: "45" }));
    expect(writes.find((w) => w.op === "create")!.args.data).toMatchObject({ currentUnitCostFils: 4500, costSource: "typed" });
  });

  it("refuses a name already in what she buys, whatever its case", async () => {
    expect(await saveCostItem(rose({ name: "peach AVALANCHE rose" }))).toMatchObject({
      ok: false,
      code: "actions.costs.nameTaken",
      vars: { name: "peach AVALANCHE rose" },
    });
    expect(writes).toEqual([]);
  });

  it("lets something keep its own name on edit, and changes a typed price", async () => {
    expect(await saveCostItem(rose({ id: "13", priceAed: "3.50" }))).toMatchObject({ ok: true, code: "actions.costs.itemSaved", id: 13 });
    expect(db["cost-items"].get(13)).toMatchObject({ currentUnitCostFils: 350, costSource: "typed" });
  });

  it("never overwrites a price that came from an invoice", async () => {
    await saveCostItem(form({ id: "15", name: "Hat box", group: "packaging", packName: "carton", unitsPerPack: "25", one: "piece", priceAed: "5" }));
    expect(db["cost-items"].get(15)).toMatchObject({ currentUnitCostFils: 2200, costSource: "invoice" });
  });

  it("keeps the price there is when the box is left empty", async () => {
    await saveCostItem(rose({ id: "13" }));
    expect(db["cost-items"].get(13)).toMatchObject({ currentUnitCostFils: 369, costSource: "typed" });
  });

  it("ticks “I don't buy this any more”", async () => {
    await saveCostItem(rose({ id: "13", archived: "on" }));
    expect(db["cost-items"].get(13)!.archived).toBe(true);
  });

  it("answers a typing mistake in her words, saving nothing", async () => {
    expect(await saveCostItem(rose({ priceAed: "abc" }))).toEqual({
      ok: false,
      message: "Type what one cost you in dirhams, like 3.25.",
      code: "actions.costs.priceInvalid",
      vars: undefined,
      field: "priceAed",
    });
    expect(await saveCostItem(rose({ name: "" }))).toMatchObject({ code: "actions.costs.nameRequired" });
    expect(writes).toEqual([]);
  });
});

describe("archiveCostItem", () => {
  it("says she doesn't buy it any more, and brings it back", async () => {
    expect(await archiveCostItem(13, true)).toMatchObject({ ok: true, code: "actions.costs.itemArchived", vars: { name: "Peach Avalanche rose" } });
    expect(db["cost-items"].get(13)!.archived).toBe(true);
    expect(await archiveCostItem(13, false)).toMatchObject({ ok: true, code: "actions.costs.itemRestored" });
    expect(db["cost-items"].get(13)!.archived).toBe(false);
    expect(activity).toHaveLength(2);
  });

  it("says so when it is gone", async () => {
    expect(await archiveCostItem(999, true)).toMatchObject({ ok: false });
  });
});

describe("saveInvoice", () => {
  it("works out the price for one stem, stores it, and reprices what is on it (the concept's AED 3.23)", async () => {
    const result = await saveInvoice(alAweer());
    expect(result).toMatchObject({ ok: true, code: "actions.costs.invoiceAdded", message: "Invoice added." });
    if (!result.ok) throw new Error("not saved");

    /* The supplier, created the first time she types it. */
    const supplier = [...db.suppliers.values()].find((doc) => doc.name === "Al Aweer Flowers")!;
    expect(supplier).toBeDefined();

    /* The new thing, created once, priced by the invoice. */
    const spray = [...db["cost-items"].values()].find((doc) => doc.name === "Spray rose")!;
    expect(spray).toMatchObject({ group: "flowers", one: "stem", unitsPerPack: 10, costSource: "invoice", currentUnitCostFils: 215.25 });

    /* The invoice: units and price for one stored with what she typed. */
    const invoice = db.invoices.get(result.id)!;
    expect(invoice).toMatchObject({
      supplier: supplier.id,
      invoiceNumber: "INV-1042",
      invoiceDate: midday("2026-10-26"),
      deliveryFils: 2000,
      vatFils: 4100,
      totalFils: 86100,
      source: "typed",
    });
    expect(invoice.lines).toEqual([
      { item: 13, printedName: "ROSE PEACH AVAL 50CM", packs: 5, unitsPerPack: 20, units: 100, lineTotalFils: 30000, priceForOneFils: 322.88 },
      { item: spray.id, printedName: null, packs: 25, unitsPerPack: 10, units: 250, lineTotalFils: 50000, priceForOneFils: 215.25 },
    ]);

    /* The rose: its price is now the invoice's, with the day and the
       supplier, and the printed name is learned. */
    expect(db["cost-items"].get(13)).toMatchObject({
      currentUnitCostFils: 322.88,
      costSource: "invoice",
      lastPaidAt: midday("2026-10-26"),
      lastSupplier: supplier.id,
      aliases: [{ text: "ROSE PEACH AVAL 50CM" }],
    });

    expect(result.changes).toEqual([
      { itemId: 13, name: "Peach Avalanche rose", one: "stem", beforeFils: 369, nowFils: 322.88 },
      { itemId: spray.id, name: "Spray rose", one: "stem", beforeFils: null, nowFils: 215.25 },
    ]);

    expect(tx).toMatchObject({ begun: 1, committed: 1, killed: 0 });
    expect(costWrites().every((w) => (w.args as Doc).overrideAccess === false && (w.args as Doc).req)).toBe(true);
    expect(activity[0]).toMatchObject({ action: "create", collection: "invoices", itemLabel: "Al Aweer Flowers INV-1042" });
    expect(revalidated).toEqual(expect.arrayContaining(["/admin/costs:layout", "/admin/products:layout"]));
  });

  it("finds her supplier by name, whatever its case", async () => {
    await saveInvoice(alAweer({ supplier: { name: "holland direct" }, invoiceNumber: "HD-78" }));
    expect(db.suppliers.size).toBe(1);
    expect([...db.invoices.values()].at(-1)).toMatchObject({ supplier: 5 });
  });

  it("refuses the same invoice twice, naming the day she added it, and keeps nothing", async () => {
    const result = await saveInvoice(alAweer({ supplier: { id: 5 }, invoiceNumber: " HD-77 " }));
    /* The number as it was saved, and the day it was added. */
    expect(result).toEqual({
      ok: false,
      message: "You added invoice hd-77 from Holland Direct on 12 Oct 2026.",
      code: "actions.costs.invoiceDuplicate",
      field: "invoiceNumber",
      vars: { number: "hd-77", supplier: "Holland Direct", date: "12 Oct 2026" },
    });
    expect(db.invoices.size).toBe(1);
    expect([...db["cost-items"].values()].some((doc) => doc.name === "Spray rose")).toBe(false);
    expect(tx).toMatchObject({ committed: 0, killed: 1 });
  });

  it("allows an invoice with no number, and the same number from another supplier", async () => {
    expect(await saveInvoice(alAweer({ supplier: { id: 5 }, invoiceNumber: "" }))).toMatchObject({ ok: true });
    expect(await saveInvoice(alAweer({ invoiceNumber: "HD-77" }))).toMatchObject({ ok: true });
  });

  it("lets an invoice keep its own number when it is changed", async () => {
    const result = await saveInvoice({
      id: 50,
      supplier: { id: 5 },
      invoiceNumber: "HD-77",
      invoiceDate: "2026-10-12",
      deliveryAed: "",
      vatAed: "",
      totalAed: "600",
      lines: [{ itemId: 15, packs: 1, unitsPerPack: 25, lineTotalAed: "600" }],
    });
    expect(result).toMatchObject({ ok: true, id: 50, code: "actions.costs.invoiceSaved" });
    expect(db.invoices.size).toBe(1);
    expect(db["cost-items"].get(15)).toMatchObject({ currentUnitCostFils: 2400 });
    if (result.ok) expect(result.changes).toEqual([{ itemId: 15, name: "Hat box", one: "piece", beforeFils: 2200, nowFils: 2400 }]);
  });

  it("leaves today's price alone when an older invoice is typed late", async () => {
    const result = await saveInvoice(
      alAweer({ supplier: { id: 5 }, invoiceNumber: "HD-12", invoiceDate: "2026-10-01", deliveryAed: "", vatAed: "", totalAed: "", lines: [{ itemId: 15, packs: 1, unitsPerPack: 25, lineTotalAed: "500" }] }),
    );
    expect(db["cost-items"].get(15)).toMatchObject({ currentUnitCostFils: 2200, lastPaidAt: midday("2026-10-12") });
    if (result.ok) expect(result.changes).toEqual([{ itemId: 15, name: "Hat box", one: "piece", beforeFils: 2200, nowFils: 2200 }]);
  });

  it("reprices what an edit took off the invoice", async () => {
    /* Invoice 50 was the hat box's only invoice: changed to a rose instead,
       the hat box keeps its price, now as one she typed. */
    await saveInvoice({
      id: 50,
      supplier: { id: 5 },
      invoiceNumber: "HD-77",
      invoiceDate: "2026-10-12",
      deliveryAed: "",
      vatAed: "",
      totalAed: "",
      lines: [{ itemId: 13, packs: 1, unitsPerPack: 20, lineTotalAed: "64" }],
    });
    expect(db["cost-items"].get(15)).toMatchObject({ currentUnitCostFils: 2200, costSource: "typed", lastPaidAt: null, lastSupplier: null });
    expect(db["cost-items"].get(13)).toMatchObject({ currentUnitCostFils: 320, costSource: "invoice" });
  });

  it("takes a “new” name already on her list as that thing, and the same new thing twice once", async () => {
    const result = await saveInvoice(
      alAweer({
        lines: [
          { itemId: null, newItem: { name: "peach avalanche ROSE", group: "flowers", packName: "bunch", unitsPerPack: 20, one: "stem" }, packs: 1, unitsPerPack: 20, lineTotalAed: "60" },
          { itemId: null, newItem: { name: "Ruscus", group: "greenery", packName: "bunch", unitsPerPack: 10, one: "stem" }, packs: 1, unitsPerPack: 10, lineTotalAed: "20" },
          { itemId: null, newItem: { name: "ruscus", group: "greenery", packName: "bunch", unitsPerPack: 10, one: "stem" }, packs: 1, unitsPerPack: 10, lineTotalAed: "20" },
        ],
        deliveryAed: "",
        vatAed: "",
        totalAed: "",
      }),
    );
    expect(result.ok).toBe(true);
    const names = [...db["cost-items"].values()].map((doc) => doc.name);
    expect(names.filter((name) => String(name).toLowerCase() === "peach avalanche rose")).toHaveLength(1);
    expect(names.filter((name) => String(name).toLowerCase() === "ruscus")).toHaveLength(1);
    if (result.ok) expect(result.changes.map((change) => change.name)).toEqual(["Peach Avalanche rose", "Ruscus"]);
  });

  it("puts something she had stopped buying back on her list when she buys it again", async () => {
    db["cost-items"].get(13)!.archived = true;
    await saveInvoice(alAweer());
    expect(db["cost-items"].get(13)!.archived).toBe(false);
  });

  it("points at a line whose thing has gone, and keeps nothing", async () => {
    const result = await saveInvoice(alAweer({ lines: [{ itemId: 999, packs: 1, unitsPerPack: 20, lineTotalAed: "60" }] }));
    expect(result).toMatchObject({ ok: false, code: "actions.costs.lineItemGone", field: "lines.0.item", vars: { line: 1 } });
    expect(db.suppliers.size).toBe(1);
    expect(tx.killed).toBe(1);
  });

  it("keeps nothing at all when the database fails half-way", async () => {
    state.failOn = "create:invoices";
    const result = await saveInvoice(alAweer());
    expect(result).toEqual({
      ok: false,
      message: "The invoice could not be saved. Nothing was changed.",
      code: "actions.costs.invoiceFailed",
    });
    expect(db.suppliers.size).toBe(1);
    expect([...db["cost-items"].values()].some((doc) => doc.name === "Spray rose")).toBe(false);
    expect(db["cost-items"].get(13)!.currentUnitCostFils).toBe(369);
    expect(tx).toMatchObject({ committed: 0, killed: 1 });
  });

  it("answers a typing mistake with the field to point at, before touching the database", async () => {
    const result = await saveInvoice(alAweer({ invoiceDate: "2026-02-30" }));
    expect(result).toMatchObject({ ok: false, code: "actions.costs.dateRequired", field: "invoiceDate" });
    expect(tx.begun).toBe(0);
    expect(fakePayload.find).not.toHaveBeenCalled();
  });

  it("says so when the invoice being changed has gone", async () => {
    expect(await saveInvoice(alAweer({ id: 777 }))).toMatchObject({ ok: false, code: "actions.costs.invoiceNotFound" });
  });
});

describe("deleteInvoice", () => {
  it("deletes it and reprices what was on it from the invoices left", async () => {
    const added = await saveInvoice(alAweer({ supplier: { id: 5 }, invoiceNumber: "HD-80", lines: [{ itemId: 15, packs: 1, unitsPerPack: 25, lineTotalAed: "600" }], deliveryAed: "", vatAed: "", totalAed: "" }));
    expect(db["cost-items"].get(15)).toMatchObject({ currentUnitCostFils: 2400 });
    if (!added.ok) throw new Error("not saved");

    expect(await deleteInvoice(added.id)).toMatchObject({ ok: true, code: "actions.costs.invoiceDeleted", id: added.id });
    expect(db.invoices.has(added.id)).toBe(false);
    expect(db["cost-items"].get(15)).toMatchObject({ currentUnitCostFils: 2200, costSource: "invoice", lastPaidAt: midday("2026-10-12") });
    expect(activity.at(-1)).toMatchObject({ action: "delete", collection: "invoices" });
  });

  it("leaves something with no invoice left at its last price, as one she typed", async () => {
    await deleteInvoice(50);
    expect(db["cost-items"].get(15)).toMatchObject({ currentUnitCostFils: 2200, costSource: "typed", lastPaidAt: null, lastSupplier: null });
  });

  it("says so when it has already gone", async () => {
    expect(await deleteInvoice(999)).toMatchObject({ ok: false, code: "actions.costs.invoiceNotFound" });
    expect(tx.killed).toBe(1);
  });
});

describe("the product's own Save", () => {
  it("creates a product without a Cost section and touches nothing in costs", async () => {
    expect(await createProduct(product())).toMatchObject({ ok: true, code: "actions.product.created", id: 41 });
    expect(recipeWrites()).toEqual([]);
  });

  it("saves what goes in after the product, as the owner — items and how many, nothing else", async () => {
    const result = await createProduct(
      product({ costRecipe: recipe([{ itemId: 13, quantity: 15 }, { itemId: 15, quantity: 1 }], { wastePercent: 10, makingMinutes: 20 }) }),
    );
    expect(result).toMatchObject({ ok: true, code: "actions.product.created", id: 41 });
    const order = writes.map((w) => `${w.op}:${w.collection}`);
    expect(order.indexOf("create:products")).toBeLessThan(order.indexOf("create:product-costs"));
    const created = recipeWrites()[0]!.args;
    expect(created).toMatchObject({ user: OWNER, overrideAccess: false });
    expect(created.data).toEqual({
      product: 41,
      lines: [
        { item: 13, quantity: 15 },
        { item: 15, quantity: 1 },
      ],
    });
  });

  it("replaces what goes in on update, and removes it when every line is taken out", async () => {
    db["product-costs"].set(9, { id: 9, product: 41, lines: [{ item: 13, quantity: 3 }] });
    expect(await updateProduct(41, product({ costRecipe: recipe([{ itemId: 13, quantity: 7 }]) }))).toMatchObject({
      ok: true,
      code: "actions.product.saved",
    });
    expect(db["product-costs"].get(9)).toMatchObject({ lines: [{ item: 13, quantity: 7 }] });
    await updateProduct(41, product({ costRecipe: recipe([]) }));
    expect(db["product-costs"].size).toBe(0);
  });

  it("drops a line whose thing has left the list", async () => {
    await createProduct(product({ costRecipe: recipe([{ itemId: 13, quantity: 2 }, { itemId: 555, quantity: 1 }]) }));
    expect(recipeWrites()[0]!.args.data).toMatchObject({ lines: [{ item: 13, quantity: 2 }] });
  });

  it("ignores what goes in sent by a florist", async () => {
    state.user = STAFF;
    await updateProduct(41, product({ costRecipe: recipe([{ itemId: 13, quantity: 99 }]) }));
    expect(writes.some((w) => w.collection === "products")).toBe(true);
    expect(recipeWrites()).toEqual([]);
    expect(fakePayload.find.mock.calls.some(([args]) => (args as Doc).collection === "product-costs")).toBe(false);
  });

  it("never loses a new product when its cost will not save, and says so", async () => {
    state.failOn = "create:product-costs";
    const result = await createProduct(product({ costRecipe: recipe([{ itemId: 13, quantity: 2 }]) }));
    expect(result).toMatchObject({ ok: true, id: 41, code: "actions.costs.productCreatedCostFailed", vars: { name: "Peach Reverie" } });
    expect(writes.some((w) => w.op === "create" && w.collection === "products")).toBe(true);
  });

  it("keeps the product changes when the cost will not save on update, and asks to save again", async () => {
    state.failOn = "create:product-costs";
    const result = await updateProduct(41, product({ costRecipe: recipe([{ itemId: 13, quantity: 2 }]) }));
    expect(result).toMatchObject({ ok: false, code: "actions.costs.productSavedCostFailed" });
    expect(writes.some((w) => w.op === "update" && w.collection === "products")).toBe(true);
  });

  it("treats an unreadable recipe as a cost not saved, never as a product not saved", async () => {
    const result = await createProduct(product({ costRecipe: "{broken" }));
    expect(result).toMatchObject({ ok: true, id: 41, code: "actions.costs.productCreatedCostFailed" });
    expect(recipeWrites()).toEqual([]);
  });
});
