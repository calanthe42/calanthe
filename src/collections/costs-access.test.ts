import { describe, expect, it } from "vitest";
import { CostItems } from "./CostItems";
import { ProductCosts } from "./ProductCosts";
import { CostSettings } from "@/globals/CostSettings";

/**
 * What the owner pays for her flowers is hers alone: every operation on the
 * costs collections and the global is the owner's, read included, and
 * nobody else sees them in /cms.
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

const collections = { "cost-items": CostItems, "product-costs": ProductCosts };

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

describe("cost-settings", () => {
  it("lets the owner read and change it", () => {
    expect(run(CostSettings.access?.read, owner)).toBe(true);
    expect(run(CostSettings.access?.update, owner)).toBe(true);
  });

  it.each(Object.entries(people))("refuses %s, read included", (_who, user) => {
    expect(run(CostSettings.access?.read, user)).toBe(false);
    expect(run(CostSettings.access?.update, user)).toBe(false);
  });

  it("is hidden in /cms from everyone but the owner", () => {
    const hidden = CostSettings.admin?.hidden as (args: { user: unknown }) => boolean;
    expect(hidden({ user: owner })).toBe(false);
    for (const user of Object.values(people)) expect(hidden({ user })).toBe(true);
  });
});
