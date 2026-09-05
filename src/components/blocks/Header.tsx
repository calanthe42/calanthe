"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SearchOverlay } from "@/components/blocks/SearchOverlay";
import { MonogramBloom } from "@/components/motion/MonogramBloom";
import { IconBag, IconHeart, IconUser } from "@/components/ui/icons";
import { StackedLogo } from "@/components/ui/StackedLogo";
import { cn } from "@/lib/cn";
import { useCart } from "@/lib/cart";
import { flowerTypes, occasions, priceBuckets } from "@/lib/data";
import { useReducedMotionPref } from "@/lib/useReducedMotionPref";
import { useScrollLock } from "@/lib/useScrollLock";

/** Routes whose hero sits full-bleed behind a transparent header. */
const OVERLAY_ROUTES = new Set(["/"]);

/** Always-visible top-level links either side of the centered mark. */
const NAV_LEFT = [
  { label: "Shop", href: "/shop" },
  { label: "Build Your Own", href: "/build-your-own" },
] as const;

const NAV_RIGHT = [
  { label: "Occasions", href: "/occasions" },
  { label: "Membership", href: "/membership" },
] as const;

/* Deeper discovery lives in the mobile menu only — the persistent bar
   stays to two links a side (see NAV_LEFT/NAV_RIGHT above). */
const MENU_GROUPS = [
  {
    label: "Shop by Occasion",
    links: occasions.map((o) => ({
      label: o.name,
      href: `/occasions/${o.slug}`,
    })),
  },
  {
    label: "Shop by Flower",
    links: flowerTypes.map((f) => ({
      label: f.name,
      href: `/shop?flower=${f.slug}`,
    })),
  },
  {
    label: "Shop by Price",
    links: priceBuckets.map((b) => ({
      label: b.label,
      href: `/shop?price=${b.id}`,
    })),
  },
] as const;

const MENU_FEATURED = [
  { label: "Build Your Own", href: "/build-your-own" },
  { label: "Membership", href: "/membership" },
  { label: "Account", href: "/account" },
] as const;

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

/**
 * One thin row, always. Transparent over the hero, a soft translucent
 * blur once scrolled — never a second row, never a solid block. The
 * centered mark is either this component's own static `Logotype`, or —
 * on the homepage, motion allowed — ceded entirely to `HeroLogoDock`,
 * which is the exact same mark travelling in from the hero's centre.
 */
export function Header() {
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
  const solid = scrolled && !menuOpen;

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-[background-color,border-color,backdrop-filter] duration-300 ease-bloom",
        solid
          ? "border-b border-hairline/60 bg-canvas/75 backdrop-blur-md"
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

          <nav aria-label="Shop" className="hidden items-center gap-8 lg:flex">
            {NAV_LEFT.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex h-11 items-center font-brand text-xs font-medium uppercase tracking-brand transition-opacity duration-200 ease-bloom hover:opacity-60",
                  onDark ? "text-cream" : "text-olive",
                )}
              >
                {link.label}
              </Link>
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
          <nav aria-label="More" className="mr-2 hidden items-center gap-8 lg:flex">
            {NAV_RIGHT.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex h-11 items-center font-brand text-xs font-medium uppercase tracking-brand transition-opacity duration-200 ease-bloom hover:opacity-60",
                  onDark ? "text-cream" : "text-olive",
                )}
              >
                {link.label}
              </Link>
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
            "fixed inset-0 z-40 flex flex-col overflow-y-auto bg-olive px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-[calc(env(safe-area-inset-top)+5rem)] lg:hidden",
            menuState === "closing" ? "menu-out" : "menu-in",
          )}
        >
          <MonogramBloom className="mx-auto w-14 shrink-0 text-cream" />

          <nav aria-label="Mobile" className="mt-8 flex-1">
            <ul className="menu-links flex flex-col">
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
              {MENU_GROUPS.map((group) => (
                <li key={group.label} className="border-b border-cream/10">
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
                      {group.links.map((link) => (
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
              ))}
              {MENU_FEATURED.map((link) => (
                <li key={link.href + link.label} className="border-b border-cream/10">
                  <Link
                    href={link.href}
                    onClick={closeMenu}
                    className="block py-4 font-brand text-xl font-medium uppercase tracking-brand text-cream transition-opacity duration-200 ease-bloom active:opacity-60"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <p className="menu-footnote mt-6 shrink-0 font-brand text-[0.625rem] uppercase tracking-brand text-sage">
            Flower Atelier — UAE
          </p>
        </div>
      )}

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}
