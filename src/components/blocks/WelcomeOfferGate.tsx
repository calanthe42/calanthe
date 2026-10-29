"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { WELCOME_DELAY_MS, WELCOME_SEEN_KEY, welcomeMayOpen, type WelcomeGift } from "@/lib/welcome-offer";

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
 * never over the opening animation and never over another overlay (the
 * menu, the cart, search): it waits until those are closed.
 *
 * `gift` is null unless the layout found a live gift AND nobody is signed in
 * (backend/data/welcome.ts), so a customer is never invited to the account
 * she already has. A browser that cannot store "seen" is not invited at all:
 * an invitation it could not remember dismissing would return on every page.
 */
export function WelcomeOfferGate({ gift }: { gift: WelcomeGift | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!gift || open) return;
    let seen: string | null;
    try {
      seen = localStorage.getItem(WELCOME_SEEN_KEY);
    } catch {
      return;
    }
    if (!welcomeMayOpen(pathname, seen)) return;

    let timer = 0;
    const wait = () => {
      timer = window.setTimeout(() => {
        /* The menu, search and the cart all hold the page still through
           lib/useScrollLock.ts, which is how an open overlay is recognised. */
        const busy =
          document.documentElement.classList.contains("intro-playing") ||
          document.documentElement.style.overflow === "hidden" ||
          document.body.classList.contains("overlay-open") ||
          document.hidden;
        if (busy) return wait();
        try {
          localStorage.setItem(WELCOME_SEEN_KEY, "shown");
        } catch {
          return;
        }
        setOpen(true);
      }, WELCOME_DELAY_MS);
    };
    wait();
    return () => window.clearTimeout(timer);
  }, [gift, pathname, open]);

  if (!gift || !open) return null;
  return <WelcomeOffer gift={gift} onClose={() => setOpen(false)} />;
}
