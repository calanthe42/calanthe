"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnnouncementBar } from "@/components/blocks/AnnouncementBar";
import { SearchOverlay } from "@/components/blocks/SearchOverlay";
import type { Occasion, Product } from "@/lib/data";
import { Monogram } from "@/components/ui/Monogram";
import { IconBag, IconHeart, IconUser } from "@/components/ui/icons";
import { StackedLogo } from "@/components/ui/StackedLogo";
import { cn } from "@/lib/cn";
import { useCart } from "@/lib/cart";
import { useT } from "@/lib/locale";
import { CONTACT, navTree } from "@/lib/data";
import { LanguageToggle } from "@/components/blocks/LanguageToggle";
import { useScrollLock } from "@/lib/useScrollLock";

/** Routes whose hero sits full-bleed behind a transparent header. */
const OVERLAY_ROUTES = new Set(["/"]);

/* The client's menu tree: headings with what sits under them. Split
   either side of the centred mark on desktop. */
const NAV_LEFT = navTree.slice(0, 2);
const NAV_RIGHT = navTree.slice(2);

/* The phone menu splits the same tree either side of OCCASIONS, which it
   promotes to a destination of its own — see the note at the insertion. */
const NAV_BEFORE_OCCASIONS = navTree.slice(0, 2);
const NAV_AFTER_OCCASIONS = navTree.slice(2);

function IconSearch({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M15.8 15.8 20 20"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

type NavGroup = (typeof navTree)[number];

/** The dictionary key behind each navigation label and child link. */
const NAV_LABELS: Record<string, keyof ReturnType<typeof useT>["nav"]> = {
  "/about": "about",
  "/shop": "shop",
  "/membership": "memberships",
  "/events": "events",
  "/occasions": "shopByOccasion",
  "/shop?ready=today": "readyToday",
  "/build-your-own": "buildYourOwn",
  "/events#guest-favors": "guestFavors",
  "/events#arrangements": "eventArrangements",
};

/** Falls back to the English label in data.ts for anything unmapped. */
function navLabel(t: ReturnType<typeof useT>, href: string, fallback: string): string {
  const key = NAV_LABELS[href];
  return key ? t.nav[key] : fallback;
}

/**
 * A desktop heading from the client's menu tree, with what sits under it.
 *
 * The children used to exist only in the phone menu, so on a laptop there was
 * no way to reach Shop by Occasion or Build Your Own from the header at all.
 * The panel opens on hover and on keyboard focus (focus-within), so tabbing
 * through the header walks straight into it; Escape returns focus to the
 * heading. It is a plain list of links, not an ARIA menu — nothing about it
 * behaves like an application menu, and announcing one would mislead.
 */
function DesktopNavItem({
  group,
  onDark,
  occasions,
}: {
  group: NavGroup;
  onDark: boolean;
  occasions: readonly Occasion[];
}) {
  const t = useT();
  const triggerRef = useRef<HTMLAnchorElement>(null);
  /* Escape closes the panel while focus returns to the heading. Hover and
     focus-within would otherwise reopen it immediately, so it stays shut
     until the pointer or focus actually leaves the item. */
  const [dismissed, setDismissed] = useState(false);
  const showOccasions = group.href === "/shop" && occasions.length > 0;
  const linkClasses = cn(
    "relative flex h-11 items-center font-brand text-xs font-medium uppercase tracking-brand transition-opacity duration-200 ease-bloom",
    onDark ? "text-cream" : "text-olive",
  );

  if (group.children.length === 0) {
    return (
      <Link href={group.href} className={cn(linkClasses, "hover:opacity-60")}>
        {navLabel(t, group.href, group.label)}
      </Link>
    );
  }

  return (
    <div
      className="group/nav relative"
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        setDismissed(true);
        triggerRef.current?.focus();
      }}
      onMouseLeave={() => setDismissed(false)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null))
          setDismissed(false);
      }}
    >
      <Link ref={triggerRef} href={group.href} className={linkClasses}>
        {navLabel(t, group.href, group.label)}
        {/* A hairline under the open heading, drawing from the left. */}
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-2 h-px origin-left scale-x-0 bg-burnt-orange transition-transform duration-300 ease-bloom group-focus-within/nav:scale-x-100 group-hover/nav:scale-x-100"
        />
      </Link>

      {/* pt bridges the gap so the pointer can travel into the panel.
          `text-start` is explicit: the panel inherits an alignment from the
          bar above it, and in Arabic that left the whole dropdown ranged
          left inside an RTL document. */}
      <div
        className={cn(
          "invisible absolute left-1/2 top-full z-50 -translate-x-1/2 pt-3 text-start opacity-0 transition-[opacity,visibility] duration-300 ease-bloom",
          !dismissed &&
            "group-focus-within/nav:visible group-focus-within/nav:opacity-100 group-hover/nav:visible group-hover/nav:opacity-100",
        )}
      >
        <div className="flex translate-y-1 gap-12 rounded-sm border border-hairline bg-canvas px-8 py-7 text-start shadow-[0_18px_40px_-24px_rgba(43,47,27,0.35)] transition-transform duration-300 ease-bloom group-focus-within/nav:translate-y-0 group-hover/nav:translate-y-0">
          <ul className="flex min-w-48 flex-col">
            {group.children.map((child) => (
              <li key={child.href}>
                <Link
                  href={child.href}
                  className="flex min-h-11 items-center whitespace-nowrap font-display text-xl font-light text-olive transition-colors duration-200 ease-bloom hover:text-burnt-orange focus-visible:text-burnt-orange"
                >
                  {navLabel(t, child.href, child.label)}
                </Link>
              </li>
            ))}
            <li className="mt-2 border-t border-hairline pt-2">
              <Link
                href={group.href}
                className="flex min-h-11 items-center whitespace-nowrap text-sm text-ink-muted transition-colors duration-200 ease-bloom hover:text-olive"
              >
                {group.href === "/shop" ? t.nav.shopAll : t.nav.viewAll}
              </Link>
            </li>
          </ul>

          {showOccasions && (
            /* Logical properties, not physical: `border-l`/`pl-12` kept the
               rule and the indent on the visual LEFT in Arabic, so the column
               divider landed on the wrong side of an RTL panel. */
            <div className="border-s border-hairline ps-12">
              <p className="mb-2 font-brand text-[0.625rem] font-medium uppercase tracking-brand text-ink-muted">
                {t.nav.byOccasion}
              </p>
              <ul className="flex min-w-40 flex-col">
                {occasions.map((occasion) => (
                  <li key={occasion.slug}>
                    <Link
                      href={`/occasions/${occasion.slug}`}
                      className="flex min-h-11 items-center whitespace-nowrap text-base text-olive transition-colors duration-200 ease-bloom hover:text-burnt-orange focus-visible:text-burnt-orange"
                    >
                      {/* The stored name is the fallback, so an occasion added
                          later still shows rather than disappearing. */}
                      {t.occasionNames[occasion.slug] ?? occasion.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The whole top of the page, as one element: the service strip and the
 * navigation row on a single surface.
 *
 * Transparent over the hero — where a soft fade, not a coloured band, is
 * what the type sits on — and a solid bar everywhere else. The mark is
 * centred on the row on every route, homepage included.
 */
export function Header({
  products = [],
  occasions = [],
}: {
  products?: readonly Product[];
  occasions?: readonly Occasion[];
} = {}) {
  const pathname = usePathname();
  const overlay = OVERLAY_ROUTES.has(pathname);
  const [scrolled, setScrolled] = useState(false);
  const [menuState, setMenuState] = useState<"closed" | "open" | "closing">("closed");
  const [searchOpen, setSearchOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { count, openCart } = useCart();
  const t = useT();

  /**
   * THE HEADER PUBLISHES ITS OWN HEIGHT.
   *
   * The hero slides up underneath this bar with a negative top margin, and
   * that margin used to be a hardcoded 6.25rem — a guess that has to equal
   * the real header height exactly. It does not, on a real iPhone: the
   * safe-area inset adds to it on a notched device, and the service strip
   * above the nav row wraps to two lines at narrow widths. When the guess is
   * short, the top of the hero — its headline included — is left exposed
   * above the bar, which is precisely the Safari fault reported.
   *
   * Measured and written to `--header-h`, the hero's offset is always the
   * real height, whatever the chrome, the inset or the wrapping do. The
   * ResizeObserver keeps it true through rotation, toolbar collapse and a
   * language switch that changes the strip's line count.
   */
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const publish = () => {
      document.documentElement.style.setProperty(
        "--header-h",
        `${Math.round(el.getBoundingClientRect().height)}px`,
      );
    };
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    window.addEventListener("orientationchange", publish);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", publish);
    };
  }, []);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        /* ON THE HERO ROUTE THE BAR RESOLVES WITH THE MARK, NOT BEFORE IT.
           At a flat 40px the bar turned solid cream while the travelling
           lockup was still out over the photograph, so for most of the
           journey the navigation was a finished-looking bar with an empty
           middle and a logo floating below it. Matching the threshold to
           the travel distance (HeroMarkTravel's 42% of the hero) makes the
           two land as one movement. */
        const threshold = overlay ? window.innerHeight * 0.34 : 40;
        setScrolled(window.scrollY > threshold);
        ticking = false;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [overlay]);

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  /**
   * THE FROZEN PAGE.
   *
   * Closing is animated, so the overlay lingers for 320ms in a `closing`
   * state before it unmounts — and that state was only ever left by a
   * timer. A route change mid-animation, a second tap, or any unmount that
   * cleared the timer left `menuState` stuck at `closing`: the overlay is
   * `fixed inset-0`, so it stayed over the page, invisible, swallowing every
   * tap and scroll until the visitor found the X. Navigating always ends the
   * menu here, and `animationend` below retires it without depending on a
   * timer at all.
   */
  useEffect(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setMenuState("closed");
    setSearchOpen(false);
  }, [pathname]);

  /* Both full-screen overlays (mobile menu, search) already show their
     own brand mark — hide the traveling hero mark underneath them
     rather than letting it show through at a mismatched size. */
  useEffect(() => {
    const open = menuState !== "closed" || searchOpen;
    document.body.classList.toggle("overlay-open", open);
    return () => {
      document.body.classList.remove("overlay-open");
    };
  }, [menuState, searchOpen]);

  const menuOpen = menuState === "open";
  useScrollLock(menuOpen);

  function toggleMenu() {
    if (menuOpen) {
      setMenuState("closing");
      closeTimer.current = setTimeout(() => setMenuState("closed"), 320);
    } else {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      setMenuState("open");
    }
  }

  function closeMenu() {
    if (menuState !== "open") return;
    setMenuState("closing");
    closeTimer.current = setTimeout(() => setMenuState("closed"), 320);
  }

  const onDark = (overlay && !scrolled) || menuOpen;
  /* Only a route with a full-bleed hero behind the bar may be transparent,
     and only until the page moves. Everywhere else the bar is opaque from
     the first pixel — a transparent bar over ordinary page content let
     photographs and headings slide visibly through it while scrolling. */
  const solid = (!overlay || scrolled) && !menuOpen;

  return (
    <header
      ref={headerRef}
      className={cn(
        /* THE STACKING CONTEXT IS THE BUG, NOT THE NUMBER.
           `sticky` + a z-index makes this element a stacking context, so the
           mobile menu and the search overlay inside it are sealed at the
           header's level no matter what z-index they carry. At z-40 the header
           tied with the floating WhatsApp button and lost to the hero's brand
           mark at z-45 — both body-level siblings later in the DOM — which is
           exactly the bleed-through: page chrome painted over a full-screen
           overlay. While an overlay is open the whole header is promoted above
           them; the layers inside it keep working unchanged. */
        "site-header sticky top-0 transition-[background-color,border-color,backdrop-filter] duration-300 ease-bloom",
        menuOpen || searchOpen ? "z-[70]" : "z-40",
        /* Blur is desktop-only: on a phone, backdrop-blur re-renders
           every frame as content moves under it, which is one of the
           most expensive things a mobile GPU can do while scrolling.
           Phones get a near-solid bar instead — same look, no cost. */
        solid
          ? "border-b border-hairline/60 bg-canvas lg:bg-canvas/85 lg:backdrop-blur-md"
          : "border-b border-transparent bg-transparent",
      )}
    >
      {/* Over the hero the whole header is one soft fade into the
          photograph, so the service strip and the navigation row read as a
          single pane of air rather than two stacked bands with an edge
          between them. Nothing paints a rectangle; the gradient ends at
          nothing. */}
      {!solid && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[190%] bg-gradient-to-b from-olive/70 via-olive/35 to-transparent"
        />
      )}

      <AnnouncementBar onDark={onDark} />

      {/* A hairline between the strip and the navigation — but only on a
          solid bar, where it divides two areas of one surface. Over the
          photograph there is nothing to divide. */}
      <div
        className={cn(
          "mx-auto h-px max-w-7xl transition-colors duration-300 ease-bloom",
          solid ? "bg-hairline/50" : "bg-transparent",
        )}
      />

      <div
        data-nav-row
        className="relative mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:h-[4.5rem] lg:px-8"
      >
        {/* Left — hamburger (mobile) / Shop + Build Your Own (desktop) */}
        <div className="flex items-center">
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={toggleMenu}
            className={cn(
              "relative z-50 -ml-2 flex h-11 w-11 items-center justify-center lg:hidden",
              onDark ? "text-cream" : "text-olive",
            )}
          >
            <span className="relative block h-3 w-6">
              <span
                className={cn(
                  "absolute left-0 top-0 h-px w-6 bg-current transition-transform duration-300 ease-bloom",
                  menuOpen && "top-1/2 rotate-45",
                )}
              />
              <span
                className={cn(
                  "absolute bottom-0 left-0 h-px w-6 bg-current transition-transform duration-300 ease-bloom",
                  menuOpen && "bottom-auto top-1/2 -rotate-45",
                )}
              />
            </span>
          </button>

          <nav aria-label="Main" className="hidden items-center gap-8 lg:flex">
            {NAV_LEFT.map((group) => (
              <DesktopNavItem
                key={group.href}
                group={group}
                onDark={onDark}
                occasions={occasions}
              />
            ))}
          </nav>
        </div>

        {/*
          THE MARK, ON EVERY ROUTE, INCLUDING HOME.

          This used to be suppressed on the homepage and handed to
          `HeroLogoDock` — a `position: fixed` copy of the lockup that a
          scrubbed GSAP timeline flew up into the bar as you scrolled. One
          decision caused four separate faults:

            · the header's middle was genuinely EMPTY at rest, which is what
              read as "the logo is not centred" — there was no logo to centre;
            · being fixed at z-45 it painted OVER the sticky header (z-40),
              which is the bleed-through;
            · its offset from this row ran 223 → 231 → 178 → 18 → 0 as you
              scrolled, moving DOWN before it moved up, because the service
              strip leaves the sticky flow at ~32px and the scrubbed timeline
              had not accounted for it. That non-monotonic step is the jump;
            · and it put a large cream wordmark directly over the brightest,
              busiest part of the bouquet.

          A mark that simply lives in the bar has none of those problems, and
          the top of the page becomes one composition. The hero keeps its own
          brand presence on its own axis (see Hero.tsx).
        */}
        <Link
          href="/"
          aria-label="Calanthe — home"
          data-travel-mark
          /* PENDING, NOT TRAVELLING.
             This used to be `data-travelling="true"` from the server, meant
             to stop the mark popping from navbar size to hero size once JS
             ran. It did that — and replaced it with something worse: until
             hydration the CSS had the travelling attribute but none of the
             driver's numbers, which is the artwork at hero size centred on
             the navbar, cropped behind the header. On Safari hydration can
             take several seconds, so that was the first thing an iPhone
             showed. Now the hero carries its own copy of the mark, laid out
             by CSS (Hero.tsx), and this one is hidden until the driver is
             ready to put it exactly there. Nothing is ever half-set. */
          data-pending={overlay ? "" : undefined}
          /* Centred on the ROW, and the row is centred on the viewport, so
             the mark is centred on the viewport at every width — which is
             also why the travelling animation never needs a horizontal
             calculation (see HeroMarkTravel.tsx). */
          /* `block`, NOT flex: StackedLogo stacks two absolutely-positioned
             images inside this box, so a flex container collapses both to
             0x0 and the wordmark disappears entirely. The 44px tap target
             comes from an invisible overlay instead, which expands the hit
             area without touching the logo's own geometry. */
          /* `aspect-[1081/719]` IS LOAD-BEARING, not decoration.
             The artwork inside is `position: absolute` (so a hero-sized box
             cannot push the page sideways), which leaves this link with no
             in-flow child — and it collapsed to ZERO HEIGHT. Everything
             vertical is measured from this box: with height 0 the docked
             centre resolved to the link's top edge, `--travel-y` computed to
             0, and the lockup centred on that point — putting its top 32px
             above the viewport, behind the header. That is the crop.
             The ratio restores the real navbar footprint. */
          className="travel-mark absolute left-1/2 top-1/2 block aspect-[1081/719] w-[var(--logo-nav-w)] after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-['']"
        >
          {/* Both colourways render; the travel animation crossfades them
              so the mark turns olive exactly as it lands on the bar. On
              every other route the tone prop decides outright. */}
          {/* No `sizes` or `priority` any more: the lockup is vector, so
              there is no resolution to pick and nothing to preload — it
              arrives with the markup and is crisp at every size it is
              scaled to between the bar and the hero. */}
          <StackedLogo tone={onDark ? "cream" : "olive"} />
        </Link>

        {/* Right — Occasions + Membership (desktop), icons (always) */}
        <div className="flex items-center gap-1">
          <nav
            aria-label="Membership and events"
            className="mr-2 hidden items-center gap-8 lg:flex"
          >
            {NAV_RIGHT.map((group) => (
              <DesktopNavItem
                key={group.href}
                group={group}
                onDark={onDark}
                occasions={occasions}
              />
            ))}
          </nav>

          <div
            className={cn(
              "flex items-center gap-1",
              onDark ? "text-cream" : "text-olive",
            )}
          >
            <button
              type="button"
              aria-label="Search"
              onClick={() => setSearchOpen(true)}
              className="hidden h-11 w-11 items-center justify-center transition-opacity duration-200 ease-bloom hover:opacity-60 lg:flex"
            >
              <IconSearch className="h-[20px] w-[20px]" />
            </button>
            {/* Mobile: heart + bag only, per the mobile composition —
                search lives inside the full-screen menu instead. */}
            <Link
              href="/wishlist"
              aria-label={t.nav.wishlist}
              className="flex h-11 w-11 items-center justify-center transition-opacity duration-200 ease-bloom hover:opacity-60"
            >
              <IconHeart className="h-[22px] w-[22px]" />
            </Link>
            <Link
              href="/account"
              aria-label={t.nav.account}
              className="hidden h-11 w-11 items-center justify-center transition-opacity duration-200 ease-bloom hover:opacity-60 lg:flex"
            >
              <IconUser className="h-[22px] w-[22px]" />
            </Link>
            <LanguageToggle
              tone={onDark ? "cream" : "olive"}
              className="ml-1 hidden lg:inline-flex"
            />
            <button
              type="button"
              id="header-cart"
              aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}
              onClick={openCart}
              className="relative flex h-11 w-11 items-center justify-center transition-opacity duration-200 ease-bloom hover:opacity-60"
            >
              <IconBag className="h-[22px] w-[22px]" />
              {count > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-sm bg-burnt-orange px-0.5 text-[0.625rem] font-medium text-cream">
                  {count}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Full-screen mobile menu — accordion groups in the olive overlay. */}
      {menuState !== "closed" && (
        <div
          /* The animation's own end retires the overlay: no timer to lose,
             and while it plays out it stops taking taps. */
          onAnimationEnd={() => {
            if (menuState === "closing") setMenuState("closed");
          }}
          /* THE MENU MUST SCROLL WHILE THE PAGE MAY NOT.
             `useScrollLock` stops Lenis so the page holds still behind
             this panel — and a stopped Lenis cancels EVERY touch and wheel
             gesture on the document (lenis.mjs, `isStopped` →
             `preventDefault`). Open the SHOP accordion and the list grows
             past the screen; without this, the finger that tries to reach
             the rest is swallowed, and the visitor concludes the menu is
             stuck until the X. This attribute is Lenis's own opt-out: a
             gesture whose path crosses it is left to the browser. */
          data-lenis-prevent
          className={cn(
            menuState === "closing" && "pointer-events-none",
            /* SAFARI PAINTS THE PAGE THROUGH ITS OWN CHROME. On an iPhone the
               status bar and the toolbar are translucent bands OUTSIDE the
               layout viewport this `inset-0` covers, and what shows through
               them is whatever the page has underneath — product photographs
               above the open menu, a headline below it. A spread shadow in
               the panel's own colour paints out past every edge, so the bands
               show olive. Unblurred, so it costs nothing to composite. */
            "shadow-[0_0_0_100vmax_var(--color-olive)]",
            /* z-40 INSIDE the header's own stacking context, deliberately
               left alone: the close button above it is z-50, and raising this
               above that locks a visitor inside the menu. What lifts this
               clear of the rest of the page is the header's z-index (see
               below), because `sticky` + `z-40` on <header> makes this a
               child layer that can never outrank a body-level sibling on its
               own, however large a number is written here. */
            /* Top padding clears the header's own row, which sits ABOVE this
               overlay (the close button is the burger, at z-50). At 4.25rem
               the brand mark started underneath the X and the two collided. */
            "fixed inset-0 z-40 flex flex-col overflow-y-auto overflow-x-hidden bg-olive px-6 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-[calc(env(safe-area-inset-top)+6.75rem)] lg:hidden",
            menuState === "closing" ? "menu-out" : "menu-in",
          )}
        >
          {/*
            THE ATELIER WATERMARK.

            The previous attempt was 165% wide at 13% opacity under a 34px
            blur, and it was invisible — 34px of blur on a fine line mark
            dissolves every stroke into a flat wash, so the panel read as a
            plain olive rectangle. Scale does the work instead: the mark is
            twice the screen's width, cropped hard by two edges, with only
            enough blur to take the edge off the linework. It is legible as
            a monogram without ever competing with the navigation, because
            it is enormous and dim rather than small and smudged.
          */}
          <span
            aria-hidden
            className="pointer-events-none absolute -end-[72%] top-[2%] -z-10 w-[260%] select-none opacity-[0.12] blur-[2px]"
          >
            <Monogram className="w-full text-cream" />
          </span>
          {/* A second, much softer pass at a different scale and offset.
              One flat silhouette reads as a sticker; two at different blurs
              read as depth — the mark seen through the olive rather than
              printed on it. */}
          <span
            aria-hidden
            className="pointer-events-none absolute -start-[45%] bottom-[-18%] -z-10 w-[150%] select-none opacity-[0.06] blur-[10px]"
          >
            <Monogram className="w-full text-cream" />
          </span>
          {/* A single soft pool of light behind the head of the menu, so the
              olive has depth rather than being one flat fill. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(90% 55% at 50% 0%, rgba(228,220,197,0.10) 0%, rgba(228,220,197,0) 70%)",
            }}
          />

          {/* Branding first, and it is the lockup rather than a lone
              monogram — the menu is a place the visitor has arrived at, so
              it says whose house this is. */}
          <div className="shrink-0">
            <Monogram className="w-11 text-cream" />
            <p className="mt-3 font-brand text-[0.625rem] uppercase tracking-brand text-cream/55">
              {t.nav.atelier}
            </p>
          </div>

          {/*
            SEARCH — a function, so it sits in its own zone directly under
            the branding, ABOVE the list of destinations, where a luxury
            retailer puts it. Previously it sat between HOME and ABOUT,
            inside the list, which is exactly what made it read as one more
            page. Nothing about it now resembles the links below: sentence
            case, not Cinzel caps; a bordered field, not a row; the icon
            trailing the way a submit affordance does.
          */}
          <button
            type="button"
            onClick={() => {
              closeMenu();
              setSearchOpen(true);
            }}
            className="mt-7 flex min-h-12 w-full shrink-0 items-center justify-between gap-3 rounded-sm border border-cream/25 bg-cream/[0.06] px-4 text-start text-base text-cream/70 transition-colors duration-200 ease-bloom active:border-cream/50 active:text-cream"
          >
            {t.nav.search}
            <IconSearch className="h-[18px] w-[18px] shrink-0 text-cream/70" />
          </button>

          <nav aria-label="Mobile" className="mt-7">
            <ul className="menu-links flex flex-col">
              <li className="border-b border-cream/10">
                <Link
                  href="/"
                  onClick={closeMenu}
                  className="flex min-h-14 items-center py-2.5 font-brand text-xl font-medium uppercase tracking-brand text-cream transition-opacity duration-200 ease-bloom active:opacity-60"
                >
                  {t.nav.home}
                </Link>
              </li>
              {NAV_BEFORE_OCCASIONS.map((group) =>
                group.children.length ? (
                  <li key={group.href} className="border-b border-cream/10">
                    <details className="group/acc">
                      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between py-2.5 font-brand text-xl font-medium uppercase tracking-brand text-cream [&::-webkit-details-marker]:hidden">
                        {navLabel(t, group.href, group.label)}
                        <span
                          aria-hidden
                          className="text-cream-muted transition-transform duration-300 ease-bloom group-open/acc:rotate-45"
                        >
                          +
                        </span>
                      </summary>
                      <ul className="flex flex-col pb-4">
                        <li>
                          <Link
                            href={group.href}
                            onClick={closeMenu}
                            className="flex min-h-11 items-center py-2 ps-5 text-base text-cream/80 transition-opacity duration-200 ease-bloom active:opacity-60"
                          >
                            {group.href === "/shop" ? t.nav.shopAll : t.nav.viewAll}
                          </Link>
                        </li>
                        {group.children.map((link) => (
                          <li key={link.href}>
                            <Link
                              href={link.href}
                              onClick={closeMenu}
                              className="flex min-h-11 items-center py-2 ps-5 text-base text-cream/80 transition-opacity duration-200 ease-bloom active:opacity-60"
                            >
                              {navLabel(t, link.href, link.label)}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </details>
                  </li>
                ) : (
                  <li key={group.href} className="border-b border-cream/10">
                    <Link
                      href={group.href}
                      onClick={closeMenu}
                      className="flex min-h-14 items-center py-2.5 font-brand text-xl font-medium uppercase tracking-brand text-cream transition-opacity duration-200 ease-bloom active:opacity-60"
                    >
                      {navLabel(t, group.href, group.label)}
                    </Link>
                  </li>
                ),
              )}

              {/* OCCASIONS, directly after SHOP where it belongs in the
                  reading order. In the client's nav tree it is a child of
                  SHOP, which is right for the desktop hover panel — but on a
                  phone that buries one of the two ways people actually shop
                  behind an extra tap. It stays inside the SHOP accordion as
                  well; one destination can have two routes to it. */}
              <li className="border-b border-cream/10">
                <Link
                  href="/occasions"
                  onClick={closeMenu}
                  className="flex min-h-14 items-center py-2.5 font-brand text-xl font-medium uppercase tracking-brand text-cream transition-opacity duration-200 ease-bloom active:opacity-60"
                >
                  {t.nav.shopByOccasion}
                </Link>
              </li>

              {NAV_AFTER_OCCASIONS.map((group) =>
                group.children.length ? (
                  <li key={group.href} className="border-b border-cream/10">
                    <details className="group/acc">
                      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between py-2.5 font-brand text-xl font-medium uppercase tracking-brand text-cream [&::-webkit-details-marker]:hidden">
                        {navLabel(t, group.href, group.label)}
                        <span
                          aria-hidden
                          className="text-cream-muted transition-transform duration-300 ease-bloom group-open/acc:rotate-45"
                        >
                          +
                        </span>
                      </summary>
                      <ul className="flex flex-col pb-4">
                        <li>
                          <Link
                            href={group.href}
                            onClick={closeMenu}
                            className="flex min-h-11 items-center py-2 ps-5 text-base text-cream/80 transition-opacity duration-200 ease-bloom active:opacity-60"
                          >
                            {group.href === "/shop" ? t.nav.shopAll : t.nav.viewAll}
                          </Link>
                        </li>
                        {group.children.map((link) => (
                          <li key={link.href}>
                            <Link
                              href={link.href}
                              onClick={closeMenu}
                              className="flex min-h-11 items-center py-2 ps-5 text-base text-cream/80 transition-opacity duration-200 ease-bloom active:opacity-60"
                            >
                              {navLabel(t, link.href, link.label)}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </details>
                  </li>
                ) : (
                  <li key={group.href} className="border-b border-cream/10">
                    <Link
                      href={group.href}
                      onClick={closeMenu}
                      className="flex min-h-14 items-center py-2.5 font-brand text-xl font-medium uppercase tracking-brand text-cream transition-opacity duration-200 ease-bloom active:opacity-60"
                    >
                      {navLabel(t, group.href, group.label)}
                    </Link>
                  </li>
                ),
              )}
              <li className="border-b border-cream/10">
                <Link
                  href="/account"
                  onClick={closeMenu}
                  className="flex min-h-14 items-center py-2.5 font-brand text-xl font-medium uppercase tracking-brand text-cream transition-opacity duration-200 ease-bloom active:opacity-60"
                >
                  {t.nav.account}
                </Link>
              </li>
            </ul>
          </nav>

          {/* The foot of the menu owns its own WhatsApp link. The floating
              button is page chrome and is hidden while the menu is open (see
              globals.css `.overlay-open`), which is what used to sit on top
              of the language control here. Both controls are laid out in one
              row, so they cannot collide at any width. */}
          {/* `mt-auto` rather than a flex-1 nav above it: the nav used to be
              stretched, which pushed this row to the floor and opened ~250px
              of empty olive in the middle of the menu. Now the list keeps its
              natural height and only the leftover space — if any — falls
              here, so the menu is spacious on a tall phone and simply scrolls
              on a short one, with nothing stranded below the fold. */}
          <div className="menu-footnote mt-auto flex shrink-0 flex-col gap-4 border-t border-cream/10 pb-1 pt-5">
            <div className="flex items-center justify-between gap-3">
              <a
                href={CONTACT.whatsappHref}
                target="_blank"
                rel="noreferrer"
                onClick={closeMenu}
                className="inline-flex min-h-11 items-center gap-2.5 font-brand text-xs font-medium uppercase tracking-brand text-cream transition-opacity duration-200 ease-bloom active:opacity-60"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-4 w-4"
                  aria-hidden
                >
                  <path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.33 4.95L2.05 22l5.3-1.39a9.87 9.87 0 0 0 4.69 1.19h.01c5.46 0 9.9-4.44 9.9-9.9a9.83 9.83 0 0 0-2.9-7A9.83 9.83 0 0 0 12.04 2Zm0 18.13h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.17-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.22-8.23 8.22Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.17.24-.64.8-.78.97-.14.16-.29.18-.54.06-.25-.12-1.05-.39-2-1.23-.73-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.16-.48-.29Z" />
                </svg>
                WhatsApp
              </a>
              <LanguageToggle tone="cream" size="full" />
            </div>
          </div>
        </div>
      )}

      <SearchOverlay
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        products={products}
        occasions={occasions}
      />
    </header>
  );
}
