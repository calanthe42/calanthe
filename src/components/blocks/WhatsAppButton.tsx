"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { CONTACT } from "@/lib/data";

export function WhatsAppButton() {
  const pathname = usePathname();
  /* Pages with a sticky mobile action bar — float above it there. */
  const hasStickyBar =
    pathname.startsWith("/product/") ||
    pathname.startsWith("/build-your-own") ||
    pathname.startsWith("/checkout");

  /**
   * THE HERO KEEPS ITS OWN SCREEN.
   *
   * This button is `fixed` at `bottom-5 right-5`, and the homepage hero
   * puts its two calls to action in exactly that corner — the thumb
   * zone, deliberately. Measured at 320, 375, 390 and 414px, the button
   * covered a 48x29px slice of "Build Your Own" at every one of them,
   * and being z-40 against the hero's z-10 it also swallowed the taps
   * that landed there. The most important control on the most important
   * screen was partly dead on every phone.
   *
   * It could simply be nudged upward, but a floating badge parked on top
   * of a full-bleed photograph is the clutter this brand is built to
   * avoid, and it competes with the two actions already there. So on the
   * hero route it waits: hidden while the hero is on screen, blooming in
   * once the visitor has scrolled past it. WhatsApp is still one tap
   * away in the header, the menu and the footer throughout.
   *
   * Only the homepage has a full-bleed hero, so only the homepage starts
   * hidden — every other route renders the button immediately, with no
   * flash and no dependence on JavaScript having run.
   */
  const heroRoute = pathname === "/";
  const [visible, setVisible] = useState(!heroRoute);

  useEffect(() => {
    if (!heroRoute) {
      setVisible(true);
      return;
    }
    let io: IntersectionObserver | undefined;
    let raf = 0;
    let attempts = 0;
    let cancelled = false;

    /* The hero is streamed in as this layout-level component's sibling,
       so on a cold load it is not reliably in the DOM by the time this
       effect runs — measured: at some viewport widths it was, at others
       it was not, which showed up as the button appearing over the hero
       on exactly two of four test widths. A single querySelector plus a
       "not found, so show it" fallback therefore fails intermittently,
       which is worse than failing always. Look again for a few frames
       before concluding there is no hero on this page. */
    const attach = () => {
      if (cancelled) return;
      const hero = document.querySelector("[data-hero-root]");
      if (!hero) {
        /* ~20 frames is a third of a second — far longer than hydration
           needs, and still imperceptible. After that, a page genuinely
           has no hero and the button belongs on screen. */
        if (attempts++ < 20) {
          raf = requestAnimationFrame(attach);
          return;
        }
        setVisible(true);
        return;
      }
      io = new IntersectionObserver(
        ([entry]) => setVisible(!entry?.isIntersecting),
        /* A sliver still counts as "on screen": the button must not
           reappear over the last few pixels of the photograph. */
        { threshold: 0.01 },
      );
      io.observe(hero);
    };

    attach();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      io?.disconnect();
    };
  }, [heroRoute, pathname]);

  return (
    <a
      href={CONTACT.whatsappHref}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat with us on WhatsApp"
      /* aria-hidden and tabIndex track visibility together: a control
         faded to zero must also leave the tab order, or a keyboard
         visitor lands on something they cannot see.
         `undefined` rather than `false` when visible: React renders
         aria-hidden="false" for the boolean, which is a real attribute
         the server and client disagreed about during hydration. Absent
         is both the correct semantics and the stable one. */
      aria-hidden={visible ? undefined : true}
      tabIndex={visible ? undefined : -1}
      className={cn(
        "fixed right-5 z-40 flex h-12 w-12 items-center justify-center rounded-sm bg-olive text-cream shadow-[0_4px_20px_rgba(43,47,27,0.35)] transition-[opacity,transform] duration-500 ease-bloom hover:opacity-85",
        hasStickyBar
          ? "bottom-[calc(max(env(safe-area-inset-bottom),0.75rem)+5rem)] lg:bottom-[max(env(safe-area-inset-bottom),1.25rem)]"
          : "bottom-[max(env(safe-area-inset-bottom),1.25rem)]",
        visible
          ? "pointer-events-auto translate-y-0 opacity-100"
          : "pointer-events-none translate-y-3 opacity-0",
      )}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6" aria-hidden>
        <path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.33 4.95L2.05 22l5.3-1.39a9.87 9.87 0 0 0 4.69 1.19h.01c5.46 0 9.9-4.44 9.9-9.9a9.83 9.83 0 0 0-2.9-7A9.83 9.83 0 0 0 12.04 2Zm0 18.13h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.17-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.22-8.23 8.22Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.17.24-.64.8-.78.97-.14.16-.29.18-.54.06-.25-.12-1.05-.39-2-1.23-.73-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.16-.48-.29Z" />
      </svg>
    </a>
  );
}
