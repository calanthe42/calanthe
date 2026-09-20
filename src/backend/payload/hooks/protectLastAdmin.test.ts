import { describe, expect, it, vi } from "vitest";
import { protectLastAdminOnChange, protectLastAdminOnDelete } from "./protectLastAdmin";

/**
 * The guard that keeps the owner from locking herself out of her own shop.
 *
 * Worth testing directly because every way of triggering it is a way of
 * destroying access to the business, and none of them can be safely
 * rehearsed against a real database.
 */

type Doc = Record<string, unknown>;

/** A payload stub whose `count` answers with however many usable admins remain. */
function req(otherUsableAdmins: number) {
  const count = vi.fn().mockResolvedValue({ totalDocs: otherUsableAdmins });
  return { req: { payload: { count } }, count };
}

function onChange(data: Doc, originalDoc: Doc | undefined, others: number, operation = "update") {
  const { req: request, count } = req(others);
  return {
    run: () =>
      protectLastAdminOnChange({ data, operation, originalDoc, req: request } as never),
    count,
  };
}

const LAST_ADMIN: Doc = { id: 1, role: "admin", accountStatus: "active", anonymisedAt: null };

describe("protectLastAdminOnChange", () => {
  it("refuses to demote the last admin", async () => {
    const { run } = onChange({ role: "staff" }, LAST_ADMIN, 0);
    await expect(run()).rejects.toThrow(/last admin account/i);
  });

  it("allows demoting an admin when another usable admin remains", async () => {
    const { run } = onChange({ role: "staff" }, LAST_ADMIN, 1);
    await expect(run()).resolves.toEqual({ role: "staff" });
  });

  /* The gap this test exists for: suspending was not guarded, and
     blockSuspendedLogin then refuses the account at sign-in — the same
     lockout by a quieter door. */
  it("refuses to suspend the last admin", async () => {
    const { run } = onChange({ accountStatus: "suspended" }, LAST_ADMIN, 0);
    await expect(run()).rejects.toThrow(/suspended or closed account cannot/i);
  });

  it("refuses to close the last admin", async () => {
    const { run } = onChange({ accountStatus: "closed" }, LAST_ADMIN, 0);
    await expect(run()).rejects.toThrow(/suspended or closed account cannot/i);
  });

  it("refuses to anonymise the last admin", async () => {
    const { run } = onChange({ anonymisedAt: "2026-01-01T00:00:00.000Z" }, LAST_ADMIN, 0);
    await expect(run()).rejects.toThrow(/suspended or closed account cannot/i);
  });

  it("allows suspending an admin when another usable admin remains", async () => {
    const { run } = onChange({ accountStatus: "suspended" }, LAST_ADMIN, 1);
    await expect(run()).resolves.toEqual({ accountStatus: "suspended" });
  });

  it("counts only admins who could actually sign in", async () => {
    const { run, count } = onChange({ role: "staff" }, LAST_ADMIN, 1);
    await run();

    const where = count.mock.calls[0]?.[0]?.where?.and ?? [];
    expect(where).toContainEqual({ accountStatus: { equals: "active" } });
    expect(where).toContainEqual({ anonymisedAt: { exists: false } });
    expect(where).toContainEqual({ role: { equals: "admin" } });
    expect(where).toContainEqual({ id: { not_equals: 1 } });
  });

  it("does not run on create", async () => {
    const { run, count } = onChange({ role: "staff" }, LAST_ADMIN, 0, "create");
    await expect(run()).resolves.toBeTruthy();
    expect(count).not.toHaveBeenCalled();
  });

  it("ignores an update to someone who is not an admin", async () => {
    const { run, count } = onChange(
      { accountStatus: "suspended" },
      { id: 2, role: "staff", accountStatus: "active" },
      0,
    );
    await expect(run()).resolves.toBeTruthy();
    expect(count).not.toHaveBeenCalled();
  });

  /* A partial update — changing a phone number, say — must not be refused
     merely because the row happens to be the last admin. */
  it("ignores fields it does not govern", async () => {
    const { run, count } = onChange({ phone: "+971500000000" }, LAST_ADMIN, 0);
    await expect(run()).resolves.toEqual({ phone: "+971500000000" });
    expect(count).not.toHaveBeenCalled();
  });

  it("treats setting the role to admin again as no change", async () => {
    const { run, count } = onChange({ role: "admin" }, LAST_ADMIN, 0);
    await expect(run()).resolves.toBeTruthy();
    expect(count).not.toHaveBeenCalled();
  });

  it("does not trap an admin who is already suspended", async () => {
    /* She cannot sign in either way, so refusing the edit would leave a row
       nobody can tidy up. */
    const suspended = { id: 1, role: "admin", accountStatus: "suspended", anonymisedAt: null };
    const { run, count } = onChange({ role: "staff" }, suspended, 0);
    await expect(run()).resolves.toBeTruthy();
    expect(count).not.toHaveBeenCalled();
  });
});

describe("protectLastAdminOnDelete", () => {
  function onDelete(doc: Doc, others: number) {
    const count = vi.fn().mockResolvedValue({ totalDocs: others });
    const findByID = vi.fn().mockResolvedValue(doc);
    return {
      run: () => protectLastAdminOnDelete({ id: doc.id, req: { payload: { count, findByID } } } as never),
      count,
    };
  }

  it("refuses to delete the last admin", async () => {
    const { run } = onDelete(LAST_ADMIN, 0);
    await expect(run()).rejects.toThrow(/last admin account/i);
  });

  it("allows deleting an admin when another usable admin remains", async () => {
    const { run } = onDelete(LAST_ADMIN, 1);
    await expect(run()).resolves.toBeUndefined();
  });

  it("allows deleting staff without counting anything", async () => {
    const { run, count } = onDelete({ id: 5, role: "staff", accountStatus: "active" }, 0);
    await expect(run()).resolves.toBeUndefined();
    expect(count).not.toHaveBeenCalled();
  });

  it("allows deleting an admin who is already suspended", async () => {
    const { run } = onDelete({ id: 1, role: "admin", accountStatus: "suspended" }, 0);
    await expect(run()).resolves.toBeUndefined();
  });
});
