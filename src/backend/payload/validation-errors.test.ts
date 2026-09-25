import { describe, expect, it } from "vitest";
import { collidingFields, isUniqueCollision } from "./validation-errors";

/** Exactly what Payload threw on production, captured from the real error. */
function payloadError(message: string, errors: { path: string; message: string }[]) {
  const e = new Error(message) as Error & { data?: unknown; name: string };
  e.name = "ValidationError";
  e.data = { collection: "users", errors };
  return e;
}

describe("collidingFields", () => {
  it("reads the path out of a real duplicate-phone error", () => {
    const e = payloadError("The following field is invalid: phone", [
      { path: "phone", message: "Value must be unique" },
    ]);
    expect(collidingFields(e)).toContain("phone");
    expect(isUniqueCollision(e, "phone")).toBe(true);
    expect(isUniqueCollision(e, "email")).toBe(false);
  });

  it("reads a duplicate-email error, which is what broke production", () => {
    const e = payloadError("The following field is invalid: email", [
      { path: "email", message: "Value must be unique" },
    ]);
    expect(isUniqueCollision(e, "email")).toBe(true);
  });

  it("merges both sources when they disagree", () => {
    /* Observed: the message names email while data blames phone. Trusting
       either one alone gives the customer the wrong advice. */
    const e = payloadError("The following field is invalid: email", [
      { path: "phone", message: "Value must be unique" },
    ]);
    const fields = collidingFields(e);
    expect(fields).toContain("email");
    expect(fields).toContain("phone");
  });

  it("does NOT match the words the old check looked for", () => {
    /* The regression guard: /duplicate|unique|already/ never matched
       Payload's message, which is precisely why every collision fell through
       to a message that helped nobody. */
    const e = payloadError("The following field is invalid: email", [
      { path: "email", message: "Value must be unique" },
    ]);
    expect(/duplicate|unique|already/i.test(e.message)).toBe(false);
    expect(isUniqueCollision(e, "email")).toBe(true);
  });

  it("is quiet about errors that are not validation failures", () => {
    expect(collidingFields(new Error("connection terminated"))).toEqual([]);
    expect(collidingFields(null)).toEqual([]);
    expect(collidingFields(undefined)).toEqual([]);
    expect(collidingFields({})).toEqual([]);
    expect(isUniqueCollision(new Error("boom"), "email")).toBe(false);
  });

  it("handles several collisions at once", () => {
    const e = payloadError("The following field is invalid: email", [
      { path: "email", message: "Value must be unique" },
      { path: "phone", message: "Value must be unique" },
    ]);
    expect(collidingFields(e).sort()).toEqual(["email", "phone"]);
  });
});
