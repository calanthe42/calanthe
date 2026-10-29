import { formatFilsInline } from "@/lib/money";

/**
 * The welcome invitation — what the browser may know about the gift.
 *
 * Words only: what the gift is worth, for the sentence that offers it. The
 * gift itself is decided on the server, from the session's own account, when
 * a basket is quoted and again when it is paid (backend/data/welcome.ts). A
 * visitor who clears this browser's storage sees the invitation again; she
 * does not get the gift again — the orders decide that.
 */

/** What the gift is worth. Exactly one of the two is set. */
export type WelcomeGift = { percentOff: number | null; amountOffFils: number | null };

/** This browser's memory of the invitation: shown, dismissed or accepted. */
export const WELCOME_SEEN_KEY = "calanthe-welcome-v1";

/** How long a first visit runs before she is invited. */
export const WELCOME_DELAY_MS = 10_000;

/** How long the page must have been calm (no intro, cookie notice, menu, cart or typing) first. */
export const WELCOME_SETTLE_MS = 4_000;

/* Pages where an invitation would interrupt what she came to do. */
const QUIET_PREFIXES = ["/checkout", "/pay", "/cart", "/account", "/login", "/invoice"] as const;

/** May the invitation open on this page, for this browser? */
export function welcomeMayOpen(pathname: string, seen: string | null): boolean {
  if (seen) return false;
  return !QUIET_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * This browser's memory of the invitation, read afresh each time it is
 * asked: another tab may have shown it, or she may have answered it there,
 * since this page loaded. Storage that cannot be read counts as seen — an
 * invitation it could not remember dismissing would return on every page.
 */
export function readWelcomeSeen(): string | null {
  try {
    return localStorage.getItem(WELCOME_SEEN_KEY);
  } catch {
    return "unavailable";
  }
}

/* Inputs that are pressed rather than typed into: focus rests on them only
   for the moment they are used. */
const PRESSED_INPUTS = new Set(["button", "checkbox", "color", "file", "hidden", "image", "radio", "range", "reset", "submit"]);

/**
 * Is she typing into this element? The invitation takes focus when it opens,
 * which on a phone drops the keyboard, so it waits while a field has it: the
 * card message on a product, the notes on Build Your Own, an enquiry.
 */
export function isTypingInto(
  element: { tagName: string; type?: string; isContentEditable?: boolean } | null,
): boolean {
  if (!element) return false;
  if (element.isContentEditable) return true;
  const tag = element.tagName.toLowerCase();
  if (tag === "textarea" || tag === "select") return true;
  return tag === "input" && !PRESSED_INPUTS.has((element.type ?? "text").toLowerCase());
}

/** "10%", or an amount in AED — whichever the owner set. */
export function welcomeAmount(gift: WelcomeGift): string {
  if (gift.percentOff !== null && gift.percentOff > 0) return `${gift.percentOff}%`;
  return formatFilsInline(gift.amountOffFils ?? 0);
}
