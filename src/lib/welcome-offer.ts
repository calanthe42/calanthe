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

/* Pages where an invitation would interrupt what she came to do. */
const QUIET_PREFIXES = ["/checkout", "/pay", "/cart", "/account", "/login", "/invoice"] as const;

/** May the invitation open on this page, for this browser? */
export function welcomeMayOpen(pathname: string, seen: string | null): boolean {
  if (seen) return false;
  return !QUIET_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** "10%", or an amount in AED — whichever the owner set. */
export function welcomeAmount(gift: WelcomeGift): string {
  if (gift.percentOff !== null && gift.percentOff > 0) return `${gift.percentOff}%`;
  return formatFilsInline(gift.amountOffFils ?? 0);
}
