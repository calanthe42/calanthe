import { describe, expect, it } from "vitest";
import { addFils, aedToFils, assertFils, formatFils, percentOfFils } from "./money";

describe("money (integer fils)", () => {
  it("converts AED to fils as integers", () => {
    expect(aedToFils(480)).toBe(48000);
    expect(aedToFils(0.01)).toBe(1);
    expect(aedToFils(19.99)).toBe(1999);
  });

  it("rejects negative, fractional and unsafe amounts", () => {
    expect(() => assertFils(-1)).toThrow();
    expect(() => assertFils(1.5)).toThrow();
    expect(() => assertFils(Number.MAX_SAFE_INTEGER + 1)).toThrow();
    expect(() => assertFils(NaN)).toThrow();
  });

  it("formats whole and fractional amounts", () => {
    expect(formatFils(48000)).toBe("AED 480");
    expect(formatFils(123450)).toBe("AED 1,234.50");
    expect(formatFils(5)).toBe("AED 0.05");
    expect(formatFils(0)).toBe("AED 0");
  });

  it("adds safely and rejects bad inputs", () => {
    expect(addFils(100, 250, 0)).toBe(350);
    expect(() => addFils(100, -1)).toThrow();
    expect(() => addFils(100, 1.2)).toThrow();
  });

  it("computes percentages with half-up rounding, no floats leaking", () => {
    expect(percentOfFils(10000, 5)).toBe(500); // 5% VAT of AED 100
    expect(percentOfFils(1, 5)).toBe(0); // rounds to nearest fils
    expect(percentOfFils(30, 5)).toBe(2); // 1.5 rounds up
    expect(() => percentOfFils(100, -5)).toThrow();
    expect(() => percentOfFils(100, 101)).toThrow();
  });
});
