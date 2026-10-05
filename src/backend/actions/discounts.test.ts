import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The owner's discount actions — above all, the rule that a discount goes
 * live only when she has explicitly said so, having been shown what changes.
 */

type Doc = Record<string, unknown>;

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
const revalidated: string[] = [];
vi.mock("next/cache", () => ({
  revalidatePath: (path: string, type?: string) => {
    revalidated.push(type ? `${path}:${type}` : path);
  },
}));
vi.mock("@payload-config", () => ({ default: {} }));

const OWNER = { id: 1, role: "admin", email: "owner@example.com", name: "Owner" };
const state: { user: Doc | null; discounts: Map<number, Doc>; orderUses: number; products: Doc[] } = {
  user: OWNER,
  discounts: new Map(),
  orderUses: 0,
  products: [],
};
const activity: Doc[] = [];
const calls: { op: string; args: Doc }[] = [];

/* The collection is owner-only; the fake refuses anyone else, as Payload would. */
const guard = (args: Doc) => {
  if (args.overrideAccess !== false) throw new Error("an admin action must not override access");
  if ((args.user as Doc | null)?.role !== "admin") throw new Error("You are not allowed to perform this action.");
};

const fakePayload = {
  auth: vi.fn(async () => ({ user: state.user })),
  find: vi.fn(async (args: Doc) => {
    calls.push({ op: "find", args });
    if (args.collection === "discounts") {
      guard(args);
      return { docs: [] };
    }
    return { docs: state.products };
  }),
  findByID: vi.fn(async (args: Doc) => {
    guard(args);
    const doc = state.discounts.get(args.id as number);
    if (!doc) throw new Error("Not Found");
    return doc;
  }),
  create: vi.fn(async (args: Doc) => {
    calls.push({ op: "create", args });
    if (args.collection === "activity-log") {
      activity.push(args.data as Doc);
      return {};
    }
    guard(args);
    const doc = { id: 5, ...(args.data as Doc) };
    state.discounts.set(5, doc);
    return doc;
  }),
  update: vi.fn(async (args: Doc) => {
    calls.push({ op: "update", args });
    guard(args);
    const doc = { ...state.discounts.get(args.id as number)!, ...(args.data as Doc) };
    state.discounts.set(args.id as number, doc);
    return doc;
  }),
  delete: vi.fn(async (args: Doc) => {
    calls.push({ op: "delete", args });
    guard(args);
    state.discounts.delete(args.id as number);
    return {};
  }),
  count: vi.fn(async (args: Doc) => {
    calls.push({ op: "count", args });
    return { totalDocs: state.orderUses };
  }),
  logger: { error: vi.fn(), warn: vi.fn() },
};
vi.mock("payload", () => ({ getPayload: async () => fakePayload }));

const {
  createDiscount,
  deleteDiscount,
  getDiscountImpact,
  previewDiscount,
  setDiscountActive,
  updateDiscount,
} = await import("./discounts");

function form(fields: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const item of Array.isArray(value) ? value : [value]) data.append(key, item);
  }
  return data;
}

const sale = (over: Record<string, string | string[]> = {}) =>
  form({
    title: "Eid 2026",
    labelEn: "Eid offer",
    labelAr: "عرض العيد",
    valueType: "percentage",
    percentOff: "20",
    appliesTo: "all",
    ...over,
  });

const code = (over: Record<string, string | string[]> = {}) =>
  form({ code: "EID10", valueType: "percentage", percentOff: "10", ...over });

const product = (over: Doc = {}): Doc => ({
  id: 1,
  name: "Amber Hour",
  priceFils: 48000,
  category: "bouquet",
  occasions: [],
  available: true,
  ...over,
});

const stored = (over: Doc = {}): Doc => ({
  id: 5,
  kind: "automatic",
  title: "Eid 2026",
  code: null,
  valueType: "percentage",
  percentOff: 20,
  amountOffFils: null,
  appliesTo: "all",
  products: [],
  occasions: [],
  categories: [],
  labelEn: "Eid offer",
  labelAr: "عرض العيد",
  startsAt: null,
  endsAt: null,
  active: false,
  minSubtotalFils: null,
  usageLimit: null,
  oncePerCustomer: false,
  ...over,
});

const written = () => calls.filter((c) => ["create", "update", "delete"].includes(c.op) && c.args.collection === "discounts");

beforeEach(() => {
  state.user = OWNER;
  state.discounts = new Map();
  state.orderUses = 0;
  state.products = [product(), product({ id: 2, name: "Peony Cloud", priceFils: 12000 })];
  activity.length = 0;
  calls.length = 0;
  revalidated.length = 0;
  vi.clearAllMocks();
});

describe("a discount is a draft unless the owner explicitly activates it", () => {
  it("saves a form with the Active switch off as a draft: nothing changes on the store", async () => {
    const result = await createDiscount("automatic", sale());
    expect(result).toMatchObject({ ok: true, code: "actions.discount.savedDraft", id: 5 });
    expect(state.discounts.get(5)).toMatchObject({ kind: "automatic", active: false, percentOff: 20 });
  });

  it("REFUSES to save live without her confirmation — and saves nothing at all", async () => {
    const result = await createDiscount("automatic", sale({ active: "on" }));
    expect(result).toMatchObject({ ok: false, code: "actions.discount.confirmNeeded" });
    expect(written()).toEqual([]);
    expect(revalidated).toEqual([]);
  });

  it("saves live once she has confirmed", async () => {
    const result = await createDiscount("automatic", sale({ active: "on", confirmActivation: "on" }));
    expect(result).toMatchObject({ ok: true, code: "actions.discount.savedLive" });
    expect(state.discounts.get(5)).toMatchObject({ active: true });
  });

  it("needs no confirmation to SCHEDULE: nothing changes today", async () => {
    const result = await createDiscount(
      "automatic",
      sale({ active: "on", startDate: "2099-01-01", startTime: "18:00" }),
    );
    expect(result).toMatchObject({ ok: true, code: "actions.discount.savedScheduled" });
    expect(result.ok && result.vars).toEqual({ date: "1 Jan, 18:00" });
  });

  it("applies the same rule to a code", async () => {
    expect(await createDiscount("code", code({ active: "on" }))).toMatchObject({
      ok: false,
      code: "actions.discount.confirmNeeded",
    });
    expect(await createDiscount("code", code({ active: "on", confirmActivation: "on" }))).toMatchObject({
      ok: true,
      code: "actions.discount.savedLive",
    });
  });
});

describe("editing", () => {
  it("needs confirmation to take a draft live", async () => {
    state.discounts.set(5, stored());
    expect(await updateDiscount(5, sale({ active: "on" }))).toMatchObject({ code: "actions.discount.confirmNeeded" });
    expect(written()).toEqual([]);
    expect(await updateDiscount(5, sale({ active: "on", confirmActivation: "on" }))).toMatchObject({
      code: "actions.discount.savedLive",
    });
  });

  it("needs confirmation to change what a LIVE discount does: 20% to 50%", async () => {
    state.discounts.set(5, stored({ active: true }));
    expect(await updateDiscount(5, sale({ active: "on", percentOff: "50" }))).toMatchObject({
      ok: false,
      code: "actions.discount.confirmNeeded",
    });
    expect(state.discounts.get(5)).toMatchObject({ percentOff: 20 });
  });

  it("needs none to rename a live discount or change its label", async () => {
    state.discounts.set(5, stored({ active: true }));
    const result = await updateDiscount(5, sale({ active: "on", title: "Eid", labelEn: "Eid special" }));
    expect(result).toMatchObject({ ok: true, code: "actions.discount.savedLive" });
    expect(state.discounts.get(5)).toMatchObject({ title: "Eid", labelEn: "Eid special", active: true });
  });

  it("needs none to switch a live discount off: saving without Active makes it a draft", async () => {
    state.discounts.set(5, stored({ active: true }));
    expect(await updateDiscount(5, sale({ percentOff: "50" }))).toMatchObject({ code: "actions.discount.savedDraft" });
    expect(state.discounts.get(5)).toMatchObject({ active: false, percentOff: 50 });
  });

  it("reads the form as the kind the discount already is, and never sends a kind", async () => {
    state.discounts.set(5, stored({ kind: "code", code: "EID10", title: "EID10" }));
    await updateDiscount(5, code({ percentOff: "15" }));
    const update = written()[0]!;
    expect(update.args.data).toMatchObject({ code: "EID10", percentOff: 15 });
    expect(update.args.data).not.toHaveProperty("kind");
  });
});

describe("the Activate switch", () => {
  it("needs confirmation to go live, and none to go off", async () => {
    state.discounts.set(5, stored());
    expect(await setDiscountActive(5, true)).toMatchObject({ ok: false, code: "actions.discount.confirmNeeded" });
    expect(state.discounts.get(5)).toMatchObject({ active: false });

    expect(await setDiscountActive(5, true, true)).toMatchObject({ ok: true, code: "actions.discount.activated" });
    expect(state.discounts.get(5)).toMatchObject({ active: true });

    expect(await setDiscountActive(5, false)).toMatchObject({ ok: true, code: "actions.discount.deactivated" });
    expect(state.discounts.get(5)).toMatchObject({ active: false });
  });

  it("says when an activated discount is only scheduled, or already over", async () => {
    state.discounts.set(5, stored({ startsAt: "2099-01-01T14:00:00.000Z" }));
    expect(await setDiscountActive(5, true)).toMatchObject({ ok: true, code: "actions.discount.savedScheduled" });
    state.discounts.set(5, stored({ endsAt: "2020-01-01T00:00:00.000Z" }));
    expect(await setDiscountActive(5, true)).toMatchObject({ ok: true, code: "actions.discount.savedExpired" });
  });
});

describe("what will change — the numbers for the confirmation", () => {
  it("previews a sale from the form, counting real products, and writes nothing", async () => {
    const preview = await previewDiscount("automatic", sale({ percentOff: "50" }));
    expect(preview).toMatchObject({
      ok: true,
      impact: {
        kind: "automatic",
        status: "active",
        productCount: 2,
        lowest: { name: "Peony Cloud", wasFils: 12000, nowFils: 6000 },
      },
    });
    expect(written()).toEqual([]);
  });

  it("does not count a product hidden from the shop", async () => {
    state.products = [product(), product({ id: 2, name: "Hidden", priceFils: 1000, available: false })];
    const preview = await previewDiscount("automatic", sale());
    expect(preview).toMatchObject({ ok: true, impact: { productCount: 1, lowest: { name: "Amber Hour" } } });
  });

  it("previews the same form errors a save would give", async () => {
    expect(await previewDiscount("automatic", sale({ percentOff: "95" }))).toMatchObject({
      ok: false,
      code: "actions.validation.percentRange",
    });
  });

  it("gives the impact of an existing discount for the Activate button", async () => {
    state.discounts.set(5, stored({ kind: "code", code: "EID10", percentOff: 10, usageLimit: 100 }));
    expect(await getDiscountImpact(5)).toMatchObject({
      ok: true,
      impact: { kind: "code", code: "EID10", percentOff: 10, usageLimit: 100, status: "active" },
    });
  });
});

describe("guards", () => {
  it("refuses a fixed sale deeper than 90% of a product it applies to, naming the product", async () => {
    /* 90% of AED 120 is AED 108. */
    const result = await createDiscount("automatic", sale({ valueType: "fixed", amountOffAed: "110" }));
    expect(result).toMatchObject({
      ok: false,
      code: "actions.validation.discountTooDeep",
      vars: { name: "Peony Cloud", price: "AED 120" },
    });
    expect(written()).toEqual([]);
  });

  it("is owner-only: a florist is refused by the collection, on every action", async () => {
    state.user = { id: 2, role: "staff", email: "florist@example.com" };
    state.discounts.set(5, stored());
    const refused = { ok: false, code: "actions.permission" };
    expect(await createDiscount("automatic", sale())).toMatchObject(refused);
    expect(await updateDiscount(5, sale())).toMatchObject(refused);
    expect(await setDiscountActive(5, false)).toMatchObject(refused);
    expect(await deleteDiscount(5)).toMatchObject(refused);
    expect(await previewDiscount("automatic", sale())).toMatchObject(refused);
    expect(await getDiscountImpact(5)).toMatchObject(refused);
    expect(state.discounts.get(5)).toEqual(stored());
  });

  it("never overrides access", () => {
    /* Asserted by the fake itself: `guard` throws on anything but
       overrideAccess: false. This test documents that it is on purpose. */
    expect(() => guard({ user: OWNER, overrideAccess: true })).toThrow(/must not override access/);
  });

  it("reports a code that is already taken in words", async () => {
    fakePayload.create.mockRejectedValueOnce(
      Object.assign(new Error("The following field is invalid: code"), {
        data: { errors: [{ message: "Value must be unique", path: "code" }] },
      }),
    );
    expect(await createDiscount("code", code())).toMatchObject({ ok: false, code: "actions.discount.codeTaken" });
  });
});

describe("deleting", () => {
  it("refuses once any order has used it, as a code or as a sale on a line", async () => {
    state.discounts.set(5, stored());
    state.orderUses = 3;
    expect(await deleteDiscount(5)).toMatchObject({ ok: false, code: "actions.discount.used", vars: { count: 3 } });
    expect(state.discounts.has(5)).toBe(true);
    const count = calls.find((c) => c.op === "count")!;
    expect(count.args.where).toEqual({
      or: [{ couponDiscount: { equals: 5 } }, { "items.sale": { equals: 5 } }],
    });
  });

  it("deletes an unused one, records who did it, and refreshes the store", async () => {
    state.discounts.set(5, stored());
    expect(await deleteDiscount(5)).toMatchObject({ ok: true, code: "actions.discount.deleted", vars: { name: "Eid 2026" } });
    expect(state.discounts.has(5)).toBe(false);
    expect(activity[0]).toMatchObject({ action: "delete", area: "other", collection: "discounts", actorEmail: "owner@example.com" });
    expect(revalidated).toContain("/:layout");
  });
});

describe("every save is logged and shown on the store at the next request", () => {
  it("records the change in the activity log, marked notable when it goes live", async () => {
    await createDiscount("automatic", sale({ active: "on", confirmActivation: "on" }));
    expect(activity[0]).toMatchObject({
      action: "create",
      area: "other",
      collection: "discounts",
      itemLabel: "Eid 2026",
      notable: true,
    });
    expect(revalidated).toEqual(["/admin/discounts", "/admin/discounts/5/edit", "/:layout"]);
  });
});
