"use client";

import { useEffect, useMemo, useState } from "react";
import { timeSlots } from "@/lib/data";
import { useLocale } from "@/lib/locale";
import {
  buildDays,
  buildSlots,
  cutoffCountdown,
  uaeNow,
  type DayOption,
  type SlotOption,
} from "@/lib/delivery";

/** A day with its words chosen: what the chip actually shows. */
export type DayChoice = DayOption & {
  /** "Today", "Tomorrow", or the weekday in the reader's language. */
  label: string;
  /** The date beneath it, e.g. "12 Oct" / "12 أكتوبر". */
  sub: string;
};

/** A window with its reason translated, when it has one. */
export type SlotChoice = Omit<SlotOption, "reason"> & { reason?: string };

export type DeliverySchedule = {
  now: Date | null;
  days: DayChoice[];
  /** The user's pick, or the first enabled day — never a disabled one. */
  selectedDay: string | null;
  setDay: (key: string) => void;
  /** Windows for the selected day, each knowing whether it can be chosen. */
  slots: SlotChoice[];
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
  const { locale, t } = useLocale();
  const [now, setNow] = useState<Date | null>(null);
  const [pickedDay, setPickedDay] = useState<string | null>(initial?.day ?? null);
  const [pickedSlot, setPickedSlot] = useState<string>(
    initial?.slot && (timeSlots as readonly string[]).includes(initial.slot)
      ? initial.slot
      : timeSlots[0],
  );

  useEffect(() => {
    setNow(uaeNow());
    const t = setInterval(() => setNow(uaeNow()), 60_000);
    return () => clearInterval(t);
  }, []);

  /*
   * THE DAY PICKER SPEAKS THE READER'S LANGUAGE HERE.
   *
   * `buildDays` returns a date and a relation, never a word, so this is the
   * one place that turns a day into something to read. Intl does the weekday
   * and the month, which is the only way to get them right in Arabic without
   * shipping a table of month names.
   *
   * The numbering system is pinned to Latin digits even in Arabic, because
   * `formatAed` renders every price with them ("AED 480"). Arabic-Indic
   * digits on the dates beside Latin digits on the totals would look like
   * two different sites rather than one considered choice.
   */
  const intlLocale = locale === "ar" ? "ar-AE-u-nu-latn" : "en-GB";
  const weekdayFmt = useMemo(
    () => new Intl.DateTimeFormat(intlLocale, { weekday: "short" }),
    [intlLocale],
  );
  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(intlLocale, { day: "numeric", month: "short" }),
    [intlLocale],
  );

  const days = useMemo<DayChoice[]>(
    () =>
      (now ? buildDays(now) : []).map((day) => ({
        ...day,
        label:
          day.relative === "today"
            ? t.schedule.today
            : day.relative === "tomorrow"
              ? t.schedule.tomorrow
              : weekdayFmt.format(day.date),
        sub: dateFmt.format(day.date),
      })),
    [now, t.schedule.today, t.schedule.tomorrow, weekdayFmt, dateFmt],
  );

  const selectedDay = useMemo(() => {
    const valid = days.find((d) => d.key === pickedDay && !d.disabled);
    if (valid) return valid.key;
    return days.find((d) => !d.disabled)?.key ?? null;
  }, [days, pickedDay]);

  const slots = useMemo<SlotChoice[]>(() => {
    const built = now
      ? buildSlots(now, selectedDay)
      : timeSlots.map((value) => ({ value, disabled: false }) as SlotOption);
    return built.map(({ reason, ...rest }) => ({
      ...rest,
      reason: reason ? t.schedule[reason] : undefined,
    }));
  }, [now, selectedDay, t.schedule]);

  /* Derived the same way the day is: a window that has since passed, or that
     belonged to a different day, is never the effective choice. Moving from
     tomorrow back to today must not leave a window selected that today
     cannot serve. */
  const slot = useMemo(() => {
    const valid = slots.find((s) => s.value === pickedSlot && !s.disabled);
    if (valid) return valid.value;
    return slots.find((s) => !s.disabled)?.value ?? pickedSlot;
  }, [slots, pickedSlot]);

  return {
    now,
    days,
    selectedDay,
    setDay: setPickedDay,
    slots,
    slot,
    setSlot: setPickedSlot,
    countdown: now ? cutoffCountdown(now) : null,
  };
}
