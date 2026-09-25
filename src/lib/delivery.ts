import { SAME_DAY_CUTOFF_HOUR, timeSlots } from "@/lib/data";

/** Wall-clock time in the UAE regardless of the visitor's timezone. */
export function uaeNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Dubai" }));
}

export type DayOption = {
  key: string;
  label: string;
  sub: string;
  disabled: boolean;
};

export type SlotOption = {
  value: string;
  disabled: boolean;
  /** Shown beside a disabled window so it reads as a fact, not a fault. */
  reason?: string;
};

/**
 * How long the atelier needs between an order and a window opening.
 *
 * Every arrangement here is composed to order and photographed for approval
 * before it leaves, so a window starting in twenty minutes is not a delivery
 * slot, it is a promise that will be broken.
 */
export const WINDOW_LEAD_MINUTES = 90;

/** "10:00 – 13:00" -> 10:00. Returns null for anything unparseable. */
function slotStart(slot: string): { h: number; m: number } | null {
  const m = /(\d{1,2}):(\d{2})/.exec(slot);
  if (!m) return null;
  return { h: Number(m[1]), m: Number(m[2]) };
}

/**
 * Which delivery windows are really available on a given day.
 *
 * THE BUG THIS FIXES. The day picker refused today after the 17:00 cutoff,
 * and nothing ever looked at the windows. So at 14:00 a customer could
 * choose "Today" and "10:00 – 13:00" — a window that closed an hour ago —
 * and the order went through. The shop then owns a delivery it cannot make,
 * which is worse than a lost sale: someone is waiting for flowers.
 *
 * A future day has every window open. Today's are measured against the
 * clock, with the lead time above.
 */
export function buildSlots(now: Date, dayKey: string | null): SlotOption[] {
  const isToday = dayKey === null || dayKey === now.toDateString();
  return timeSlots.map((value) => {
    if (!isToday) return { value, disabled: false };
    const start = slotStart(value);
    if (!start) return { value, disabled: false };

    const opens = new Date(now);
    opens.setHours(start.h, start.m, 0, 0);
    const minutesAway = (opens.getTime() - now.getTime()) / 60_000;

    if (minutesAway <= 0) return { value, disabled: true, reason: "Passed" };
    if (minutesAway < WINDOW_LEAD_MINUTES) return { value, disabled: true, reason: "Too soon" };
    return { value, disabled: false };
  });
}

export function buildDays(now: Date): DayOption[] {
  const pastCutoff = now.getHours() >= SAME_DAY_CUTOFF_HOUR;
  /* Today is also gone once every one of its windows has gone — otherwise
     the day picker offers a day on which nothing can be chosen, and the
     customer finds out only after tapping it. */
  const noWindowsLeft = buildSlots(now, now.toDateString()).every((s) => s.disabled);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const label =
      i === 0
        ? "Today"
        : i === 1
          ? "Tomorrow"
          : d.toLocaleDateString("en-GB", { weekday: "short" });
    return {
      key: d.toDateString(),
      label,
      sub: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      disabled: i === 0 && (pastCutoff || noWindowsLeft),
    };
  });
}

/** "2h 15m" until today's cutoff, or null once it has passed. */
export function cutoffCountdown(now: Date): string | null {
  const cutoff = new Date(now);
  cutoff.setHours(SAME_DAY_CUTOFF_HOUR, 0, 0, 0);
  const ms = cutoff.getTime() - now.getTime();
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
