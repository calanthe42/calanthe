import { describe, expect, it } from "vitest";
import { ADMIN_MIN_PASSWORD, passwordProblem } from "./password-policy";

describe("staff and owner passwords", () => {
  it("accepts a long phrase", () => {
    expect(passwordProblem("orchids in the morning", { email: "layla@calanthe.ae" })).toBeNull();
  });

  it("needs at least 12 characters", () => {
    expect(ADMIN_MIN_PASSWORD).toBe(12);
    expect(passwordProblem("short-pass1", {})?.code).toBe("password.tooShort");
  });

  it("refuses the email, or its name part", () => {
    expect(passwordProblem("layla@calanthe.ae", { email: "layla@calanthe.ae" })?.code).toBe("password.containsEmail");
    expect(passwordProblem("my-layla-garden-2026", { email: "layla@calanthe.ae" })?.code).toBe("password.containsEmail");
  });

  it("refuses the password it replaces", () => {
    expect(passwordProblem("3P98-DA3A-FP8X-CZRJ", { previous: "3P98-DA3A-FP8X-CZRJ" })?.code).toBe("password.same");
  });

  it("refuses the passwords every attacker tries first", () => {
    expect(passwordProblem("Calanthe2026", {})?.code).toBe("password.common");
    expect(passwordProblem("aaaaaaaaaaaaaa", {})?.code).toBe("password.common");
  });
});
