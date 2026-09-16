"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SearchOverlay } from "@/components/blocks/SearchOverlay";
import type { Occasion, Product } from "@/lib/data";
import { MonogramBloom } from "@/components/motion/MonogramBloom";
import { IconBag, IconHeart, IconUser } from "@/components/ui/icons";
import { StackedLogo } from "@/components/ui/StackedLogo";
import { cn } from "@/lib/cn";
import { useCart } from "@/lib/cart";
import { CONTACT, navTree } from "@/lib/data";
import { LanguageToggle } from "@/components/blocks/LanguageToggle";
import { useReducedMotionPref } from "@/lib/useReducedMotionPref";
import { useScrollLock } from "@/lib/useScrollLock";

/** Routes whose hero sits full-bleed behind a transparent header. */
const OVERLAY_ROUTES = new Set(["/"]);

/* The client's menu tree: headings with what sits under them. Split
   either side of the centred mark on desktop. */
const NAV_LEFT = navTree.slice(0, 2);
const NAV_RIGHT = navTree.slice(2);

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
        {group.label}
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
        {group.label}
        {/* A hairline under the open heading, drawing from the left. */}
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-2 h-px origin-left scale-x-0 bg-burnt-orange transition-transform duration-300 ease-bloom group-focus-within/nav:scale-x-100 group-hover/nav:scale-x-100"
        />
      </Link>

      {/* pt bridges the gap so the pointer can travel into the panel. */}
      <div
        className={cn(
          "invisible absolute left-1/2 top-full z-50 -translate-x-1/2 pt-3 opacity-0 transition-[opacity,visibility] duration-300 ease-bloom",
          !dismissed &&
            "group-focus-within/nav:visible group-focus-within/nav:opacity-100 group-hover/nav:visible group-hover/nav:opacity-100",
        )}
      >
        <div className="flex translate-y-1 gap-12 rounded-sm border border-hairline bg-canvas px-8 py-7 text-left shadow-[0_18px_40px_-24px_rgba(43,47,27,0.35)] transition-transform duration-300 ease-bloom group-focus-within/nav:translate-y-0 group-hover/nav:translate-y-0">
          <ul className="flex min-w-48 flex-col gap-1">
            {group.children.map((child) => (
              <li key={child.href}>
                <Link
                  href={child.href}
                  className="block whitespace-nowrap py-1.5 font-display text-xl font-light text-olive transition-colors duration-200 ease-bloom hover:text-burnt-orange focus-visible:text-burnt-orange"
                >
                  {child.label}
                </Link>
              </li>
            ))}
            <li className="mt-3 border-t border-hairline pt-3">
              <Link
                href={group.href}
                className="block whitespace-nowrap py-1 text-sm text-sage transition-colors duration-200 ease-bloom hover:text-olive"
              >
                {group.label} all
              </Link>
            </li>
          </ul>

          {showOccasions && (
            <div className="border-l border-hairline pl-12">
              <p className="mb-3 font-brand text-[0.625rem] font-medium uppercase tracking-brand text-sage">
                By occasion
              </p>
              <ul className="flex min-w-40 flex-col gap-1">
                {occasions.map((occasion) => (
                  <li key={occasion.slug}>
                    <Link
                      href={`/occasions/${occasion.slug}`}
                      className="block whitespace-nowrap py-1 text-base text-olive transition-colors duration-200 ease-bloom hover:text-burnt-orange focus-visible:text-burnt-orange"
                    >
                      {occasion.name}
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
 * One thin row, always. Transparent over the hero, a soft translucent
 * blur once scrolled — never a second row, never a solid block. The
 * centered mark is either this component's own static `Logotype`, or —
 * on the homepage, motion allowed — ceded entirely to `HeroLogoDock`,
 * which is the exact same mark travelling in from the hero's centre.
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
  const reducedMotion = useReducedMotionPref();
  const markOwnedByHero = overlay && !reducedMotion;
  const [scrolled, setScrolled] = useState(false);
  const [menuState, setMenuState] = useState<"closed" | "open" | "closing">("closed");
  const [searchOpen, setSearchOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { count, openCart } = useCart();

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setScrolled(window.scrollY > 40);
        ticking = false;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

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
        "sticky top-0 transition-[background-color,border-color,backdrop-filter] duration-300 ease-bloom",
        menuOpen || searchOpen ? "z-[70]" : "z-40",
        /* Blur is desktop-only: on a phone, backdrop-blur re-renders
           every frame as content moves under it, which is one of the
           most expensive things a mobile GPU can do while scrolling.
           Phones get a near-solid bar instead — same look, no cost. */
        solid
          ? "border-b border-hairline/60 bg-canvas lg:bg-canvas/75 lg:backdrop-blur-md"
          : "border-b border-transparent bg-transparent",
      )}
    >
      {/* `data-nav-row` is measured by HeroLogoDock so the traveling
          mark lands dead-centre on this exact line — no magic numbers. */}
      <div
        data-nav-row
        className="relative mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:h-20 lg:px-8"
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

        {/* Centre — the mark. Suppressed on the hero route (motion
            allowed): HeroLogoDock renders the same mark here once it
            finishes traveling in. */}
        {!markOwnedByHero && (
          <Link
            href="/"
            aria-label="Calanthe — home"
            /* top-1/2 + -translate-y-1/2: dead centre on this line,
               same as every other item in the row. */
            className="absolute left-1/2 top-1/2 block w-[var(--logo-nav-w)] -translate-x-1/2 -translate-y-1/2"
          >
            {/* Same lockup, same two colourways the hero mark lands on
                — so every route's navbar reads identically. */}
            <StackedLogo
              tone={onDark ? "cream" : "olive"}
              sizes="(min-width: 1024px) 78px, 64px"
            />
          </Link>
        )}

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
              aria-label="Wishlist"
              className="flex h-11 w-11 items-center justify-center transition-opacity duration-200 ease-bloom hover:opacity-60"
            >
              <IconHeart className="h-[22px] w-[22px]" />
            </Link>
            <Link
              href="/account"
              aria-label="Account"
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

      {/* Full-screen mobile menu — accordion groups in the olive overlay.
          Unchanged content; only the persistent bar above changed shape. */}
      {menuState !== "closed" && (
        <div
          className={cn(
            /* z-40 INSIDE the header's own stacking context, deliberately
               left alone: the close button above it is z-50, and raising this
               above that locks a visitor inside the menu. What lifts this
               clear of the rest of the page is the header's z-index (see
               below), because `sticky` + `z-40` on <header> makes this a
               child layer that can never outrank a body-level sibling on its
               own, however large a number is written here. */
            "fixed inset-0 z-40 flex flex-col overflow-y-auto bg-olive px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-[calc(env(safe-area-inset-top)+5rem)] lg:hidden",
            menuState === "closing" ? "menu-out" : "menu-in",
          )}
        >
          <MonogramBloom className="mx-auto w-14 shrink-0 text-cream" />

          <nav aria-label="Mobile" className="mt-8 flex-1">
            <ul className="menu-links flex flex-col">
              <li className="border-b border-cream/10">
                <Link
                  href="/"
                  onClick={closeMenu}
                  className="flex min-h-14 items-center py-3 font-brand text-xl font-medium uppercase tracking-brand text-cream transition-opacity duration-200 ease-bloom active:opacity-60"
                >
                  Home
                </Link>
              </li>
              <li className="border-b border-cream/10">
                <button
                  type="button"
                  onClick={() => {
                    closeMenu();
                    setSearchOpen(true);
                  }}
                  className="flex w-full items-center gap-3 py-4 font-brand text-xl font-medium uppercase tracking-brand text-cream transition-opacity duration-200 ease-bloom active:opacity-60"
                >
                  <IconSearch className="h-5 w-5" />
                  Search
                </button>
              </li>
              {navTree.map((group) =>
                group.children.length ? (
                  <li key={group.href} className="border-b border-cream/10">
                    <details className="group/acc">
                      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between py-3 font-brand text-xl font-medium uppercase tracking-brand text-cream [&::-webkit-details-marker]:hidden">
                        {group.label}
                        <span
                          aria-hidden
                          className="text-sage transition-transform duration-300 ease-bloom group-open/acc:rotate-45"
                        >
                          +
                        </span>
                      </summary>
                      <ul className="flex flex-col pb-4">
                        <li>
                          <Link
                            href={group.href}
                            onClick={closeMenu}
                            className="block min-h-11 py-2 pl-4 text-base text-cream/80 transition-opacity duration-200 ease-bloom active:opacity-60"
                          >
                            {group.label} all
                          </Link>
                        </li>
                        {group.children.map((link) => (
                          <li key={link.href}>
                            <Link
                              href={link.href}
                              onClick={closeMenu}
                              className="block min-h-11 py-2 pl-4 text-base text-cream/80 transition-opacity duration-200 ease-bloom active:opacity-60"
                            >
                              {link.label}
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
                      className="flex min-h-14 items-center py-3 font-brand text-xl font-medium uppercase tracking-brand text-cream transition-opacity duration-200 ease-bloom active:opacity-60"
                    >
                      {group.label}
                    </Link>
                  </li>
                ),
              )}
              <li className="border-b border-cream/10">
                <Link
                  href="/account"
                  onClick={closeMenu}
                  className="flex min-h-14 items-center py-3 font-brand text-xl font-medium uppercase tracking-brand text-cream transition-opacity duration-200 ease-bloom active:opacity-60"
                >
                  Account
                </Link>
              </li>
            </ul>
          </nav>

          {/* The foot of the menu owns its own WhatsApp link. The floating
              button is page chrome and is hidden while the menu is open (see
              globals.css `.overlay-open`), which is what used to sit on top
              of the language control here. Both controls are laid out in one
              row, so they cannot collide at any width. */}
          <div className="menu-footnote mt-6 flex shrink-0 flex-col gap-4 border-t border-cream/10 pt-5">
            <div className="flex items-center justify-between gap-3">
              <a
                href={CONTACT.whatsappHref}
                target="_blank"
                rel="noreferrer"
                onClick={closeMenu}
                className="inline-flex min-h-11 items-center gap-2.5 font-brand text-xs font-medium uppercase tracking-brand text-cream transition-opacity duration-200 ease-bloom active:opacity-60"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
                  <path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.33 4.95L2.05 22l5.3-1.39a9.87 9.87 0 0 0 4.69 1.19h.01c5.46 0 9.9-4.44 9.9-9.9a9.83 9.83 0 0 0-2.9-7A9.83 9.83 0 0 0 12.04 2Zm0 18.13h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.17-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.22-8.23 8.22Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.17.24-.64.8-.78.97-.14.16-.29.18-.54.06-.25-.12-1.05-.39-2-1.23-.73-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.16-.48-.29Z" />
                </svg>
                WhatsApp
              </a>
              <LanguageToggle tone="cream" />
            </div>
            <p className="font-brand text-[0.625rem] uppercase tracking-brand text-sage">
              Flower Atelier — UAE
            </p>
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
