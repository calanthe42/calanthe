import { describe, expect, it, vi } from "vitest";
import { sanitizeConfig, type FieldAccess } from "payload";

vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_SERVER_URL: "https://www.calanthe.ae" } }));

import { Users } from "./Users";
import { forgetConfirmationOnEmailChange } from "@backend/payload/hooks/customerAccount";

/**
 * Who may change the address an account signs in with.
 *
 * Users declares an `email` field only to add an access rule to Payload's
 * own. These run the collection through Payload's sanitizer, as the server
 * does at start-up, so a future edit that replaced Payload's field instead
 * of extending it (losing uniqueness, say) fails here rather than in
 * production.
 */

async function sanitizedEmailField() {
  const config = await sanitizeConfig({
    /* Users relates to products (the wishlist), so a stand-in is enough. */
    collections: [Users, { slug: "products", fields: [{ name: "title", type: "text" }] }],
    secret: "test",
    db: { defaultIDType: "number", init: () => ({}) },
  } as never);
  const users = config.collections.find((c) => c.slug === "users");
  const fields = (users?.fields ?? []).filter((f) => "name" in f && f.name === "email");
  return { fields, field: fields[0] as Record<string, unknown> & { access?: { update?: FieldAccess } } };
}

const asUser = (user: Record<string, unknown> | null) =>
  ({ req: { user } }) as unknown as Parameters<FieldAccess>[0];

describe("the email field", () => {
  it("stays Payload's own field: one of it, required, unique, lower-cased and validated", async () => {
    const { fields, field } = await sanitizedEmailField();
    expect(fields).toHaveLength(1);
    expect(field).toMatchObject({ type: "email", required: true, unique: true });
    expect(typeof field.validate).toBe("function");
    expect((field.hooks as { beforeChange?: unknown[] }).beforeChange).toHaveLength(1);
  });

  it("may be changed by the owner and by nobody else", async () => {
    const update = (await sanitizedEmailField()).field.access?.update;
    expect(update).toBeTypeOf("function");
    expect(update!(asUser({ id: 1, role: "admin", accountStatus: "active" }))).toBe(true);
    expect(update!(asUser({ id: 31, role: "customer", accountStatus: "active" }))).toBe(false);
    expect(update!(asUser({ id: 7, role: "staff", accountStatus: "active" }))).toBe(false);
    expect(update!(asUser({ id: 1, role: "admin", accountStatus: "suspended" }))).toBe(false);
    expect(update!(asUser(null))).toBe(false);
  });

  it("forgets the confirmation whenever the address does change", () => {
    expect(Users.hooks?.beforeChange).toContain(forgetConfirmationOnEmailChange);
  });
});
