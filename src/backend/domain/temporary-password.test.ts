import { describe, expect, it } from "vitest";
import { TEMPORARY_PASSWORD_ALPHABET, temporaryPassword } from "./temporary-password";

describe("temporaryPassword", () => {
  it("is grouped in fours so it can be read aloud", () => {
    expect(temporaryPassword()).toMatch(/^[A-Z0-9]{4}(-[A-Z0-9]{4}){3}$/);
  });

  it("contains no character that can be misheard or misread", () => {
    /* 0/O, 1/I/L and 5/S are the pairs that turn a spoken password into a
       locked account. None may appear in the alphabet. */
    for (const forbidden of ["0", "1", "5", "I", "L", "O", "S"]) {
      expect(TEMPORARY_PASSWORD_ALPHABET).not.toContain(forbidden);
    }
  });

  it("has no repeated symbols in its alphabet", () => {
    expect(new Set(TEMPORARY_PASSWORD_ALPHABET).size).toBe(TEMPORARY_PASSWORD_ALPHABET.length);
  });

  it("clears the account's own minimum password length", () => {
    /* backend/actions/account.ts requires 10 characters of a customer; an
       issued password must not be weaker than one a customer may choose. */
    expect(temporaryPassword().length).toBeGreaterThanOrEqual(10);
  });

  it("does not repeat", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i += 1) seen.add(temporaryPassword());
    expect(seen.size).toBe(500);
  });

  it("draws on the whole alphabet rather than a corner of it", () => {
    /* A modulo-biased or poorly seeded generator shows up here: across 400
       passwords every symbol should appear at least once. */
    const used = new Set<string>();
    for (let i = 0; i < 400; i += 1) {
      for (const c of temporaryPassword().replace(/-/g, "")) used.add(c);
    }
    expect(used.size).toBe(TEMPORARY_PASSWORD_ALPHABET.length);
  });
});
