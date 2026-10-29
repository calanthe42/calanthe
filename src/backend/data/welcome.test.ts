import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The welcome gift's reads: what the orders say about a person, whether the
 * gift is hers, and what the storefront layout offers her.
 *
 * The database is a stand-in that answers the one standing query with the
 * row a test sets, and records what it was asked. The SQL itself runs only
 * against Postgres; what is tested here is everything this module decides
 * around it.
 */

/* A `sql` tag that keeps the text and the bound values apart, as drizzle does. */
const sql = vi.hoisted(() => {
  const tag = (strings: TemplateStringsArray, ...values: unknown[]) => ({
    text: strings.map((s, i) => s + (i < values.length ? describeValue(values[i]) : "")).join(""),
    values: values.filter((v) => !(typeof v === "object" && v !== null && "raw" in v)),
  });
  const describeValue = (v: unknown) =>
    typeof v === "object" && v !== null && "raw" in v ? String((v as { raw: string }).raw) : "?";
  return Object.assign(tag, { raw: (raw: string) => ({ raw }) });
});
vi.mock("@payloadcms/db-postgres", () => ({ sql }));
vi.mock("@payload-config", () => ({ default: {} }));
vi.mock("next/cache", () => ({ unstable_cache: (fn: () => unknown) => fn }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ unstable_rethrow: () => undefined }));

type Row = { paid?: number | string; claims?: number | string; own_held?: number | string };
const state: { row: Row; gift: Record<string, unknown> | null; user: Record<string, unknown> | null } = {
  row: {},
  gift: null,
  user: null,
};
type Query = { text: string; values: unknown[] };
const execute = vi.fn<(query: Query) => Promise<{ rows: Row[] }>>(async () => ({ rows: [state.row] }));
const fakePayload = {
  find: vi.fn(async () => ({ docs: state.gift ? [state.gift] : [] })),
  auth: vi.fn(async () => ({ user: state.user })),
  db: { drizzle: { execute } },
};
vi.mock("payload", () => ({ getPayload: async () => fakePayload }));

const { getWelcomeVisitor, welcomeFor, welcomeStanding } = await import("./welcome");
type Payload = Parameters<typeof welcomeStanding>[0];
const payload = fakePayload as unknown as Payload;

const NOW = new Date("2026-10-30T10:00:00.000Z");

const GIFT_ROW = {
  id: 12,
  title: "Welcome gift (first order)",
  kind: "code",
  code: "WELCOME",
  valueType: "percentage",
  percentOff: 10,
  amountOffFils: 0,
  minSubtotalFils: 0,
  usageLimit: null,
  timesUsed: 0,
  oncePerCustomer: true,
  welcome: true,
  active: true,
};

const CUSTOMER = {
  id: 7,
  role: "customer",
  email: "layla@example.com",
  accountStatus: "active",
  emailConfirmedAt: "2026-10-30T09:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  state.row = { paid: 0, claims: 0, own_held: 0 };
  state.gift = { ...GIFT_ROW };
  state.user = { ...CUSTOMER };
});

describe("welcomeStanding", () => {
  it("reads paid orders, claims, and her own unpaid checkouts among them", async () => {
    state.row = { paid: "0", claims: "2", own_held: "1" };
    expect(await welcomeStanding(payload, CUSTOMER, "12")).toEqual({ paidOrders: 0, claims: 2, ownHeld: 1 });
  });

  it("asks about the inbox, not the spelling, and about this account for its own checkouts", async () => {
    await welcomeStanding(payload, { id: 7, email: "Ne.Ttt+3@googlemail.com" }, "12");
    const query = execute.mock.calls[0]![0];
    expect(query.values).toContain("nettt@gmail.com");
    expect(query.values).not.toContain("Ne.Ttt+3@googlemail.com");
    /* Her own unpaid web checkouts are the ones a new checkout releases. */
    expect(query.text).toContain("AS own_held");
    expect(query.text).toMatch(/customer_id = \?\s+AND coupon_redeemed_at IS NULL\s+AND payment_status = 'PENDING'\s+AND fulfilment_status = 'NEW'\s+AND source = 'web-checkout-card'/);
    expect(query.values.filter((v) => v === 7)).toHaveLength(2);
  });

  it("leaves the caller's own new order out for the second look", async () => {
    await welcomeStanding(payload, CUSTOMER, "12", 41);
    expect(execute.mock.calls[0]![0].values).toContain(41);
  });

  it("reads a missing row as nothing at all", async () => {
    execute.mockResolvedValueOnce({ rows: [] });
    expect(await welcomeStanding(payload, CUSTOMER, "12")).toEqual({ paidOrders: 0, claims: 0, ownHeld: 0 });
  });
});

describe("welcomeFor", () => {
  it("is hers when nothing holds it", async () => {
    expect(await welcomeFor(payload, CUSTOMER, NOW)).toMatchObject({ id: "12", welcome: true });
  });

  it("is still hers when the only claim is her own unpaid checkout — she is starting again", async () => {
    state.row = { paid: 0, claims: 1, own_held: 1 };
    expect(await welcomeFor(payload, CUSTOMER, NOW)).toMatchObject({ id: "12" });
  });

  it("is not hers while somebody else's order holds it, or after a paid order", async () => {
    state.row = { paid: 0, claims: 2, own_held: 1 };
    expect(await welcomeFor(payload, CUSTOMER, NOW)).toBeNull();
    state.row = { paid: 1, claims: 0, own_held: 0 };
    expect(await welcomeFor(payload, CUSTOMER, NOW)).toBeNull();
  });

  it("asks no order at all for an account that may not have it", async () => {
    expect(await welcomeFor(payload, { ...CUSTOMER, emailConfirmedAt: null }, NOW)).toBeNull();
    expect(await welcomeFor(payload, null, NOW)).toBeNull();
    expect(execute).not.toHaveBeenCalled();
  });

  it("is nobody's when it is switched off, or used as often as its cap allows", async () => {
    state.gift = { ...GIFT_ROW, active: false };
    expect(await welcomeFor(payload, CUSTOMER, NOW)).toBeNull();
    state.gift = { ...GIFT_ROW, usageLimit: 50, timesUsed: 50 };
    expect(await welcomeFor(payload, CUSTOMER, NOW)).toBeNull();
    expect(execute).not.toHaveBeenCalled();
  });

  it("throws when the orders cannot be read, so checkout refuses rather than guesses", async () => {
    execute.mockRejectedValueOnce(new Error("connection terminated"));
    await expect(welcomeFor(payload, CUSTOMER, NOW)).rejects.toThrow("connection terminated");
  });
});

describe("getWelcomeVisitor — what the storefront layout offers", () => {
  const OFFER = { percentOff: 10, amountOffFils: null };

  it("invites a guest", async () => {
    state.user = null;
    expect(await getWelcomeVisitor()).toEqual({ offer: OFFER, account: "guest" });
  });

  it("gives it to a confirmed customer with no order — or only her own unpaid one", async () => {
    expect(await getWelcomeVisitor()).toEqual({ offer: OFFER, account: "eligible" });
    state.row = { paid: 0, claims: 1, own_held: 1 };
    expect(await getWelcomeVisitor()).toEqual({ offer: OFFER, account: "eligible" });
  });

  it("says a customer who has not confirmed yet is waiting for it, without asking the orders", async () => {
    state.user = { ...CUSTOMER, emailConfirmedAt: null };
    expect(await getWelcomeVisitor()).toEqual({ offer: OFFER, account: "unconfirmed" });
    expect(execute).not.toHaveBeenCalled();
  });

  it("is not hers after a paid order, nor the team's", async () => {
    state.row = { paid: 1, claims: 1, own_held: 0 };
    expect(await getWelcomeVisitor()).toEqual({ offer: OFFER, account: "other" });
    state.user = { ...CUSTOMER, role: "staff" };
    expect(await getWelcomeVisitor()).toEqual({ offer: OFFER, account: "other" });
  });

  it("offers nothing when the gift is used as often as its cap allows", async () => {
    state.gift = { ...GIFT_ROW, usageLimit: 50, timesUsed: 50 };
    expect(await getWelcomeVisitor()).toEqual({ offer: null, account: "guest" });
  });

  it("says it could not read the gift, rather than that it is not hers", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    execute.mockRejectedValueOnce(new Error("connection terminated"));
    expect(await getWelcomeVisitor()).toEqual({ offer: null, account: "unknown" });
    quiet.mockRestore();
  });
});
