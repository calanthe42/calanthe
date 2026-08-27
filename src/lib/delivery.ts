import { SAME_DAY_CUTOFF_HOUR } from "@/lib/data";

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

export function buildDays(now: Date): DayOption[] {
  const pastCutoff = now.getHours() >= SAME_DAY_CUTOFF_HOUR;
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
      disabled: i === 0 && pastCutoff,
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
