import { describe, expect, it } from "vitest";
import { forgetConfirmationOnEmailChange } from "./customerAccount";

/**
 * A confirmation proves one inbox. These pin what happens to it when the
 * account's address changes, because the welcome gift trusts it as "one gift
 * per inbox" and nothing else would notice it going stale.
 */

type Doc = Record<string, unknown>;

const CONFIRMED: Doc = {
  id: 31,
  email: "layla@example.com",
  emailConfirmedAt: "2026-10-30T09:00:00.000Z",
  _verified: true,
};

/* Payload hands the hook every field: the ones not being changed are filled
   in from the stored row before collection hooks run. */
const run = (data: Doc, originalDoc: Doc | undefined = CONFIRMED, operation = "update") =>
  forgetConfirmationOnEmailChange({ data: { ...CONFIRMED, ...data }, operation, originalDoc } as never) as Doc;

describe("forgetConfirmationOnEmailChange", () => {
  it("clears the confirmation, and the link still waiting in the old inbox, when the address changes", () => {
    const data = run({ email: "someone-else@example.com" });
    expect(data.emailConfirmedAt).toBeNull();
    expect(data._verificationToken).toBeNull();
  });

  it("never touches _verified: she keeps signing in while the new address waits", () => {
    expect(run({ email: "someone-else@example.com" })._verified).toBe(true);
  });

  it("leaves an unchanged address alone, as on every other save of her row", () => {
    const data = run({ name: "Layla Ahmed" });
    expect(data.emailConfirmedAt).toBe("2026-10-30T09:00:00.000Z");
    expect(data).not.toHaveProperty("_verificationToken");
  });

  it("treats a difference of case or spaces as the same address", () => {
    const data = run({ email: "  Layla@Example.com " });
    expect(data.emailConfirmedAt).toBe("2026-10-30T09:00:00.000Z");
  });

  it("does nothing on create: a new account has nothing confirmed yet", () => {
    const data = run({ email: "new@example.com", emailConfirmedAt: undefined }, undefined, "create");
    expect(data).not.toHaveProperty("_verificationToken");
  });
});
