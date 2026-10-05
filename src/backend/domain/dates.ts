import { FormInputError } from "@backend/domain/form-error";

/**
 * Dates as the business experiences them: in the UAE.
 *
 * The old follow-up field was a `datetime-local` input whose value was parsed
 * with `new Date()` ON THE SERVER. Vercel runs in UTC, so "10:00" typed in
 * Dubai was stored as 10:00 UTC — 14:00 in Dubai — every time. And because the
 * form re-sent the stored value on every save, an enquiry whose follow-up time
 * had passed could no longer be saved at all: the "no past dates" rule refused
 * the unchanged field.
 *
 * Now the field is a calendar day, read and written in Asia/Dubai explicitly,
 * and only sent when it changes.
 */

const UAE = "Asia/Dubai";
/* The UAE has no daylight saving; +04:00 is correct all year. */
const UAE_OFFSET = "+04:00";

/** An ISO timestamp as the YYYY-MM-DD a date input shows, in UAE time. */
export function dubaiDateInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  /* en-CA formats as YYYY-MM-DD. */
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: UAE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Midnight in the UAE at the start of the given YYYY-MM-DD day. */
export function uaeMidnight(day: string): Date {
  return new Date(`${day}T00:00:00${UAE_OFFSET}`);
}

/**
 * A chosen follow-up day as a timestamp: 09:00 UAE on that day.
 *
 * Choosing today after 09:00 is allowed and means "now" — a minute ahead, so
 * the collection's no-past-dates rule, which exists to catch mistakes, does
 * not refuse a perfectly sensible choice.
 */
export function followUpIsoFromDateInput(value: string, now: Date): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new FormInputError("Choose a follow-up date from the calendar.", "followUpFormat");
  }
  const at = new Date(`${value}T09:00:00${UAE_OFFSET}`);
  if (Number.isNaN(at.getTime()) || dubaiDateInputValue(at.toISOString()) !== value) {
    throw new FormInputError("That follow-up date is not a real date.", "followUpInvalid");
  }
  if (value < dubaiDateInputValue(now.toISOString())) {
    throw new FormInputError(
      "The follow-up date is in the past. Choose today or a later day.",
      "followUpPast",
    );
  }
  return at.getTime() > now.getTime()
    ? at.toISOString()
    : new Date(now.getTime() + 60_000).toISOString();
}

/**
 * A date and a time typed in the UAE, as the instant they mean.
 *
 * The discount form has a date input and a time input, both read as Abu
 * Dhabi wall time: "10 October, 18:00" is 14:00 UTC, whichever timezone the
 * server happens to run in. An empty time means the start of that day.
 */
export function dubaiDateTimeToIso(day: string, time: string): string {
  const clock = time === "" ? "00:00" : time;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(clock)) {
    throw new FormInputError("Choose the date and time from the pickers.", "dateTimeFormat");
  }
  const at = new Date(`${day}T${clock}:00${UAE_OFFSET}`);
  /* 31 February parses to early March; refuse it rather than move the date. */
  if (Number.isNaN(at.getTime()) || dubaiDateInputValue(at.toISOString()) !== day) {
    throw new FormInputError("That is not a real date.", "dateTimeFormat");
  }
  return at.toISOString();
}

/** An ISO timestamp as the HH:MM a time input shows, in UAE time. */
export function dubaiTimeInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  /* en-GB with hourCycle h23 formats as 00:00–23:59. */
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: UAE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}
