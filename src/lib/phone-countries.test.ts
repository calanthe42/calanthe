import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  PHONE_COUNTRIES,
  flagSrc,
  foldForSearch,
  formatNational,
  fromE164,
  isPlausiblePhone,
  toE164,
} from "./phone-countries";

describe("toE164", () => {
  it("drops the trunk 0, spaces and dashes", () => {
    expect(toE164("AE", "050 123-4567")).toBe("+971501234567");
    expect(toE164("SA", "0501234567")).toBe("+966501234567");
    expect(toE164("AE", "")).toBe("");
  });

  it("keeps the 0 where it is part of the number", () => {
    expect(toE164("IT", "06 1234 5678")).toBe("+390612345678");
  });
});

describe("isPlausiblePhone", () => {
  it("accepts UAE mobiles and landlines", () => {
    expect(isPlausiblePhone("+971501234567")).toBe(true);
    expect(isPlausiblePhone("+97121234567")).toBe(true);
  });

  it("refuses a UAE number a digit short or long", () => {
    expect(isPlausiblePhone("+9715012345")).toBe(false);
    expect(isPlausiblePhone("+9715012345678")).toBe(false);
  });

  it("knows the Gulf's lengths", () => {
    expect(isPlausiblePhone("+966501234567")).toBe(true);
    expect(isPlausiblePhone("+96650123456")).toBe(false);
    expect(isPlausiblePhone("+96550123456")).toBe(true);
    expect(isPlausiblePhone("+974331234567")).toBe(false);
  });

  it("accepts any E.164 length where we do not know the country's rule", () => {
    expect(isPlausiblePhone("+33612345678")).toBe(true);
    expect(isPlausiblePhone("+4915123456789")).toBe(true);
  });

  it("refuses what is not international form", () => {
    expect(isPlausiblePhone("0501234567")).toBe(false);
    expect(isPlausiblePhone("")).toBe(false);
  });
});

describe("formatNational", () => {
  it("groups numbers the way they are said", () => {
    expect(formatNational("AE", "0501234567")).toBe("50 123 4567");
    expect(formatNational("AE", "21234567")).toBe("2 123 4567");
    expect(formatNational("KW", "50123456")).toBe("5012 3456");
    expect(formatNational("US", "2015550123")).toBe("201 555 0123");
  });

  it("leaves a half-typed or unknown number as typed", () => {
    expect(formatNational("AE", "050 12")).toBe("050 12");
    expect(formatNational("FR", "06 12 34 56 78")).toBe("06 12 34 56 78");
  });
});

describe("fromE164", () => {
  it("splits a saved number back into country and number", () => {
    expect(fromE164("+971501234567")).toEqual({ iso: "AE", national: "501234567" });
    expect(fromE164("+447400123456")).toEqual({ iso: "GB", national: "7400123456" });
    expect(fromE164("+12015550123")).toEqual({ iso: "US", national: "2015550123" });
  });
});

describe("foldForSearch", () => {
  it("ignores accents and the Arabic letter forms people type either way", () => {
    expect(foldForSearch("Curaçao")).toBe("curacao");
    expect(foldForSearch("الإمارات")).toBe(foldForSearch("الامارات"));
    expect(foldForSearch("السعودية")).toBe("السعوديه");
  });
});

describe("flags", () => {
  it("has a flag picture for every country in the list", () => {
    const missing = PHONE_COUNTRIES.filter(
      (c) => !fs.existsSync(path.join(process.cwd(), "public", flagSrc(c.iso))),
    ).map((c) => c.iso);
    expect(missing).toEqual([]);
  });
});
