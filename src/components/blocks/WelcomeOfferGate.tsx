"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { readConsent } from "@/lib/consent";
import {
  isTypingInto,
  readWelcomeSeen,
  WELCOME_DELAY_MS,
  WELCOME_SEEN_KEY,
  WELCOME_SETTLE_MS,
  welcomeMayOpen,
  type WelcomeGift,
} from "@/lib/welcome-offer";

/* The invitation itself — its images, form and motion — is fetched only for
   the visitor who is about to see it, so no page pays for it at first paint
   (CLAUDE.md: Lighthouse mobile ≥ 90). */
const WelcomeOffer = dynamic(() => import("./WelcomeOffer").then((m) => m.WelcomeOffer), {
  ssr: false,
});

/**
 * WHEN THE WELCOME INVITATION OPENS.
 *
 * Once per browser, for a visitor who is not signed in, ten seconds into a
 * browsing page — never on the basket, checkout, payment or account pages,
 * never over the opening animation, never over another overlay (the menu,
 * the cart, search) and never while she is typing into a field: it waits
 * until those are done.
 *
 * `gift` is null unless the layout found a live gift AND nobody is signed in
 * (backend/data/welcome.ts), so a customer is never invited to the account
 * she already has. A browser that cannot store "seen" is not invited at all:
 * an invitation it could not remember dismissing would return on every page.
 */
export function WelcomeOfferGate({ gift }: { gift: WelcomeGift | null }) {
  const pathname = usePathname();
  /* The gift as it was when the invitation opened. Signing up inside it
     refreshes the page, and the layout then has no gift to offer a
     signed-in visitor — the invitation must still finish its last step. */
  const [shown, setShown] = useState<{ gift: WelcomeGift; on: string } | null>(null);
  const open = shown !== null;

  useEffect(() => {
    if (!gift || open) return;
    if (!welcomeMayOpen(pathname, readWelcomeSeen())) return;

    /* Opens at the earliest WELCOME_DELAY_MS after she arrives, and only once
       the page has been calm for WELCOME_SETTLE_MS: a moment after she
       answers the cookie notice, closes the menu or comes back to the tab —
       never the instant one thing ends, and never at a random later time. */
    const arrived = Date.now();
    let lastBusy = arrived;
    const timer = window.setInterval(() => {
      /* Asked again on every tick, not only when the page loaded: with two
         tabs open, the one she is not looking at must not invite her after
         she has dismissed it, or signed up, in the other. */
      if (!welcomeMayOpen(pathname, readWelcomeSeen())) {
        window.clearInterval(timer);
        return;
      }
      /* The menu, search and the cart all hold the page still through
         lib/useScrollLock.ts, which is how an open overlay is recognised;
         the cookie notice is answered first: one question at a time. A
         field she is typing into counts too — the invitation would take
         its focus and, on a phone, the keyboard with it. */
      const busy =
        readConsent() === null ||
        document.documentElement.classList.contains("intro-playing") ||
        document.documentElement.style.overflow === "hidden" ||
        document.body.classList.contains("overlay-open") ||
        document.hidden ||
        isTypingInto(document.activeElement);
      const now = Date.now();
      if (busy) {
        lastBusy = now;
        return;
      }
      if (now - arrived < WELCOME_DELAY_MS || now - lastBusy < WELCOME_SETTLE_MS) return;
      window.clearInterval(timer);
      try {
        localStorage.setItem(WELCOME_SEEN_KEY, "shown");
      } catch {
        return;
      }
      setShown({ gift, on: pathname });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [gift, pathname, open]);

  if (!shown) return null;
  return <WelcomeOffer gift={shown.gift} openedOn={shown.on} onClose={() => setShown(null)} />;
}
