import { describe, expect, it } from "vitest";
import { Settings } from "./Settings";

/**
 * The store settings — today the add-ons — are read by the storefront on
 * every request, so anyone may read them; only the owner may change them.
 * And the one rule a row edited by hand in /cms must still keep: one key,
 * one add-on.
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

describe("settings", () => {
  it("lets anyone read it, the owner included", () => {
    for (const user of [owner, ...Object.values(people)]) expect(run(Settings.access?.read, user)).toBe(true);
  });

  it("lets only the owner change it", () => {
    expect(run(Settings.access?.update, owner)).toBe(true);
  });

  it.each(Object.entries(people))("refuses %s a change", (_who, user) => {
    expect(run(Settings.access?.update, user)).toBe(false);
  });

  describe("the add-ons array", () => {
    const field = Settings.fields.find((f) => "name" in f && f.name === "addons") as unknown as {
      validate: (rows: unknown) => true | string;
      maxRows: number;
    };
    const row = (key: unknown) => ({ key, nameEn: "Vase", nameAr: "مزهرية", priceFils: 15_000, active: true });

    it("holds at most 12", () => {
      expect(field.maxRows).toBe(12);
      expect(field.validate(Array.from({ length: 13 }, (_, i) => row(`a-${i}`)))).toMatch(/12/);
    });

    it("refuses two rows with one key, and a key that is not a lower-case slug", () => {
      expect(field.validate([row("vase"), row("balloon")])).toBe(true);
      expect(field.validate([row("vase"), row("vase")])).toMatch(/same key/);
      expect(field.validate([row("Vase")])).toMatch(/lower-case/);
      expect(field.validate([])).toBe(true);
    });
  });
});
