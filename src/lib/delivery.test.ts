import { describe, expect, it } from "vitest";
import { SAME_DAY_CUTOFF_HOUR, timeSlots } from "@/lib/data";
import { buildDays, buildSlots, cutoffCountdown, WINDOW_LEAD_MINUTES } from "@/lib/delivery";

/** A fixed local date, so these tests never depend on when they are run. */
function at(hour: number, minute = 0): Date {
  return new Date(2026, 8, 25, hour, minute, 0, 0); // 25 Sep 2026
}

const todayKey = at(12).toDateString();
const tomorrowKey = new Date(2026, 8, 26).toDateString();

describe("buildSlots", () => {
  it("offers every window on a future day, whatever the time now", () => {
    for (const hour of [0, 9, 12, 16, 20, 23]) {
      const slots = buildSlots(at(hour), tomorrowKey);
      expect(slots).toHaveLength(timeSlots.length);
      expect(slots.every((s) => !s.disabled)).toBe(true);
    }
  });

  it("refuses a window that has already started today", () => {
    /* 14:00 — the 10:00-13:00 window closed an hour ago. This is the bug:
       it used to be selectable, and the order went through. */
    const slots = buildSlots(at(14), todayKey);
    const past = slots.find((s) => s.value.startsWith("10:00"));
    expect(past?.disabled).toBe(true);
    expect(past?.reason).toBe("Passed");
  });

  it("refuses a window that opens sooner than the atelier can compose", () => {
    /* 16:00 — the 17:00 window is an hour away, inside the lead time. */
    const slots = buildSlots(at(16), todayKey);
    const soon = slots.find((s) => s.value.startsWith("17:00"));
    expect(soon?.disabled).toBe(true);
    expect(soon?.reason).toBe("Too soon");
  });

  it("allows a window exactly at the lead-time boundary, and not a minute later", () => {
    const opens = at(17, 0);
    const exactly = new Date(opens.getTime() - WINDOW_LEAD_MINUTES * 60_000);
    expect(
      buildSlots(exactly, todayKey).find((s) => s.value.startsWith("17:00"))?.disabled,
    ).toBe(false);

    const oneMinuteLate = new Date(exactly.getTime() + 60_000);
    expect(
      buildSlots(oneMinuteLate, todayKey).find((s) => s.value.startsWith("17:00"))?.disabled,
    ).toBe(true);
  });

  it("treats a null day as today, so nothing is offered by accident", () => {
    const slots = buildSlots(at(23), null);
    expect(slots.every((s) => s.disabled)).toBe(true);
  });

  it("leaves the morning open early in the day", () => {
    const slots = buildSlots(at(7), todayKey);
    expect(slots.every((s) => !s.disabled)).toBe(true);
  });
});

describe("buildDays", () => {
  it("offers seven days", () => {
    expect(buildDays(at(9))).toHaveLength(7);
  });

  it("labels the first two days by name and the rest by weekday", () => {
    const days = buildDays(at(9));
    expect(days[0].label).toBe("Today");
    expect(days[1].label).toBe("Tomorrow");
    expect(days[2].label).not.toBe("Tomorrow");
  });

  it("disables today after the same-day cutoff", () => {
    expect(buildDays(at(SAME_DAY_CUTOFF_HOUR)).at(0)?.disabled).toBe(true);
    expect(buildDays(at(SAME_DAY_CUTOFF_HOUR + 3)).at(0)?.disabled).toBe(true);
  });

  it("disables today once no window is left, even before the cutoff", () => {
    /* 16:00 is before the 17:00 cutoff, but the morning windows have passed
       and the evening one is inside the lead time — so there is nothing to
       choose. Offering the day anyway is a dead end the customer only finds
       after tapping it. */
    const slots = buildSlots(at(16), todayKey);
    expect(slots.every((s) => s.disabled)).toBe(true);
    expect(buildDays(at(16)).at(0)?.disabled).toBe(true);
  });

  it("keeps today open in the morning", () => {
    expect(buildDays(at(8)).at(0)?.disabled).toBe(false);
  });

  it("never disables a future day", () => {
    for (const hour of [8, 16, 20, 23]) {
      expect(buildDays(at(hour)).slice(1).every((d) => !d.disabled)).toBe(true);
    }
  });
});

describe("cutoffCountdown", () => {
  it("counts down to the cutoff", () => {
    expect(cutoffCountdown(at(SAME_DAY_CUTOFF_HOUR - 2, 45))).toBe("1h 15m");
  });

  it("is null once the cutoff has passed", () => {
    expect(cutoffCountdown(at(SAME_DAY_CUTOFF_HOUR))).toBeNull();
    expect(cutoffCountdown(at(SAME_DAY_CUTOFF_HOUR + 1))).toBeNull();
  });
});
