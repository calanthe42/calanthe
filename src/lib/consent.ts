/**
 * The visitor's answer to the cookie notice (components/blocks/
 * CookieNotice.tsx), kept in this browser.
 *
 * The shop keeps only what it needs to work — the bag, the language, the
 * sign-in — and runs no advertising or tracking. "Declined" therefore turns
 * nothing off today; it is recorded so that anything optional added later
 * (analytics, a pixel) asks `consentGiven()` first and stays off for her.
 */
export type ConsentChoice = "accepted" | "declined";

export const CONSENT_KEY = "calanthe-consent-v1";

/** Her answer, or null when she has not answered (or storage is blocked). */
export function readConsent(): ConsentChoice | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const choice = (JSON.parse(raw) as { choice?: unknown }).choice;
    return choice === "accepted" || choice === "declined" ? choice : null;
  } catch {
    return null;
  }
}

/** Saves her answer with the moment she gave it. False when storage is blocked. */
export function writeConsent(choice: ConsentChoice): boolean {
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ choice, at: new Date().toISOString() }));
    return true;
  } catch {
    return false;
  }
}

/** For anything optional added later: may it run for this visitor? */
export const consentGiven = (): boolean => readConsent() === "accepted";
