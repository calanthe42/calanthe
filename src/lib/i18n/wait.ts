/**
 * "Try again in three minutes", in the reader's language.
 *
 * `waitHint` in backend/security/throttle decides the number and the unit;
 * this turns that into a sentence. It is separate from the throttle because
 * the admin has its own dictionary and its own wording, and the throttle is
 * shared by both.
 *
 * The minute and hour counts go through the plural helper for the same reason
 * everything countable does: Arabic has a dual, so two minutes is "دقيقتين",
 * not "2 دقائق".
 */
import type { WaitHint } from "@backend/security/throttle";
import type { Dictionary, Locale } from "@/lib/i18n/dictionary";
import { plural } from "@/lib/i18n/plural";

export function waitText(locale: Locale, t: Dictionary, hint: WaitHint): string {
  if (hint.unit === "moment") return t.server.wait.moment;
  return plural(locale, t.server.wait[hint.unit], hint.count);
}

/**
 * A message with `{wait}` in it, filled in. Every rate-limit message in the
 * dictionary is written as a sentence plus that token, so the two halves can
 * be translated independently of each other.
 */
export function withWait(
  locale: Locale,
  t: Dictionary,
  message: string,
  hint: WaitHint,
): string {
  return message.replace("{wait}", waitText(locale, t, hint));
}
