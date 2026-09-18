import { describe, expect, it } from "vitest";
import { FormInputError } from "./form-error";
import { dubaiDateInputValue, followUpIsoFromDateInput } from "./dates";

describe("UAE dates for follow-ups", () => {
  it("shows a stored timestamp as the UAE calendar day", () => {
    expect(dubaiDateInputValue("2026-09-12T05:00:00.000Z")).toBe("2026-09-12");
    /* 21:00 UTC on the 11th is already 01:00 on the 12th in Dubai. */
    expect(dubaiDateInputValue("2026-09-11T21:00:00.000Z")).toBe("2026-09-12");
    expect(dubaiDateInputValue(null)).toBe("");
    expect(dubaiDateInputValue("not a date")).toBe("");
  });

  it("stores a chosen day as 09:00 UAE, not 09:00 wherever the server runs", () => {
    const now = new Date("2026-09-10T00:00:00.000Z");
    expect(followUpIsoFromDateInput("2026-09-12", now)).toBe("2026-09-12T05:00:00.000Z");
  });

  it("round-trips: the day saved is the day shown", () => {
    const now = new Date("2026-09-10T00:00:00.000Z");
    const iso = followUpIsoFromDateInput("2026-12-31", now);
    expect(dubaiDateInputValue(iso)).toBe("2026-12-31");
  });

  it("accepts today after 09:00 UAE as 'now', a minute ahead", () => {
    const now = new Date("2026-09-10T08:00:00.000Z"); // 12:00 in Dubai
    expect(followUpIsoFromDateInput("2026-09-10", now)).toBe("2026-09-10T08:01:00.000Z");
  });

  it("refuses past days and impossible dates", () => {
    const now = new Date("2026-09-10T08:00:00.000Z");
    expect(() => followUpIsoFromDateInput("2026-09-09", now)).toThrow(FormInputError);
    expect(() => followUpIsoFromDateInput("2027-02-30", now)).toThrow(FormInputError);
    expect(() => followUpIsoFromDateInput("next tuesday", now)).toThrow(FormInputError);
  });
});
