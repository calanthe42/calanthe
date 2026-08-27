"use client";

import { useEffect, useMemo, useState } from "react";
import { timeSlots } from "@/lib/data";
import { buildDays, cutoffCountdown, uaeNow, type DayOption } from "@/lib/delivery";

export type DeliverySchedule = {
  now: Date | null;
  days: DayOption[];
  /** The user's pick, or the first enabled day — never a disabled one. */
  selectedDay: string | null;
  setDay: (key: string) => void;
  slot: string;
  setSlot: (slot: string) => void;
  /** "2h 15m" until the same-day cutoff, or null once it has passed. */
  countdown: string | null;
};

/**
 * One source of truth for delivery-day state (PDP + checkout).
 * Refreshes UAE time every minute so the same-day cutoff can never go
 * stale while the page is open; the effective selection is derived, so
 * a pick that becomes disabled falls back to the next enabled day.
 */
export function useDeliverySchedule(initial?: {
  day?: string;
  slot?: string;
}): DeliverySchedule {
  const [now, setNow] = useState<Date | null>(null);
  const [pickedDay, setPickedDay] = useState<string | null>(initial?.day ?? null);
  const [slot, setSlot] = useState<string>(
    initial?.slot && (timeSlots as readonly string[]).includes(initial.slot)
      ? initial.slot
      : timeSlots[0],
  );

  useEffect(() => {
    setNow(uaeNow());
    const t = setInterval(() => setNow(uaeNow()), 60_000);
    return () => clearInterval(t);
  }, []);

  const days = useMemo(() => (now ? buildDays(now) : []), [now]);

  const selectedDay = useMemo(() => {
    const valid = days.find((d) => d.key === pickedDay && !d.disabled);
    if (valid) return valid.key;
    return days.find((d) => !d.disabled)?.key ?? null;
  }, [days, pickedDay]);

  return {
    now,
    days,
    selectedDay,
    setDay: setPickedDay,
    slot,
    setSlot,
    countdown: now ? cutoffCountdown(now) : null,
  };
}
