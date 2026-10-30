import { describe, expect, it } from "vitest";
import { CostItems } from "./CostItems";
import { Invoices } from "./Invoices";
import { ProductCosts } from "./ProductCosts";
import { Suppliers } from "./Suppliers";

/**
 * What the owner pays for her flowers, and who she buys them from, is hers
 * alone: every operation on every costs collection is the owner's, read
 * included, and nobody else sees them in /cms.
 */

const owner = { id: 1, role: "admin", accountStatus: "active" };
const people = {
  staff: { id: 2, role: "staff", accountStatus: "active" },
  customer: { id: 3, role: "customer", accountStatus: "active" },
  "a suspended owner": { id: 4, role: "admin", accountStatus: "suspended" },
  anonymous: null,
} as const;

type AccessFn = (args: { req: { user: unknown } }) => unknown;
const run = (fn: unknown, user: unknown) => (fn as AccessFn)({ req: { user } });

const collections = {
  suppliers: Suppliers,
  "cost-items": CostItems,
  invoices: Invoices,
  "product-costs": ProductCosts,
};

describe.each(Object.entries(collections))("%s", (_slug, collection) => {
  const ops = ["read", "create", "update", "delete"] as const;

  it("lets the owner do everything", () => {
    for (const op of ops) expect(run(collection.access?.[op], owner)).toBe(true);
  });

  it.each(Object.entries(people))("refuses %s every operation", (_who, user) => {
    for (const op of ops) expect(run(collection.access?.[op], user)).toBe(false);
  });

  it("is hidden in /cms from everyone but the owner", () => {
    const hidden = collection.admin?.hidden as (args: { user: unknown }) => boolean;
    expect(hidden({ user: owner })).toBe(false);
    for (const user of Object.values(people)) expect(hidden({ user })).toBe(true);
  });
});
