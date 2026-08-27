"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SearchOverlay } from "@/components/blocks/SearchOverlay";
import { MonogramBloom } from "@/components/motion/MonogramBloom";
import { IconBag, IconHeart, IconUser } from "@/components/ui/icons";
import { Logotype } from "@/components/ui/Logotype";
import { cn } from "@/lib/cn";
import { useCart } from "@/lib/cart";
import { flowerTypes, occasions, priceBuckets } from "@/lib/data";
import { useScrollLock } from "@/lib/useScrollLock";

/** Routes whose hero sits dark and full-bleed behind the header. */
const OVERLAY_ROUTES = new Set(["/"]);

/* Layered shop nav — flowers.ae discoverability, Calanthe voice. */
const NAV_GROUPS = [
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

const FEATURED_LINKS = [
  { label: "Same-Day", href: "/shop" },
  { label: "Luxury", href: "/shop?price=over-600" },
  { label: "Build Your Own", href: "/build-your-own" },
  { label: "Membership", href: "/membership" },
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

export function Header() {
  const pathname = usePathname();
  const overlay = OVERLAY_ROUTES.has(pathname);
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
        "sticky top-0 z-40 transition-colors duration-300 ease-bloom",
        solid
          ? "border-b border-hairline bg-cream"
          : "border-b border-transparent bg-transparent",
      )}
    >
      {/* Row 2 — logo, search, account, cart */}
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-8">
        {/* Hamburger — mobile only */}
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

        {/* Search — desktop left */}
        <div className="hidden flex-1 lg:block">
          <button
            type="button"
            aria-label="Search"
            onClick={() => setSearchOpen(true)}
            className={cn(
              "flex h-11 items-center gap-2 font-brand text-xs font-medium uppercase tracking-brand transition-opacity duration-200 ease-bloom hover:opacity-60",
              onDark ? "text-cream" : "text-olive",
            )}
          >
            <IconSearch className="h-[20px] w-[20px]" />
            Search
          </button>
        </div>

        {/* Logotype — centered */}
        <Link
          href="/"
          aria-label="Calanthe — home"
          className="absolute left-1/2 -translate-x-1/2"
        >
          <Logotype
            className={cn(
              "text-lg transition-colors duration-300 ease-bloom lg:text-xl",
              onDark ? "text-cream" : "text-olive",
            )}
          />
        </Link>

        {/* Icons — right */}
        <div
          className={cn(
            "flex flex-1 items-center justify-end gap-1",
            onDark ? "text-cream" : "text-olive",
          )}
        >
          <button
            type="button"
            aria-label="Search"
            onClick={() => setSearchOpen(true)}
            className="flex h-11 w-11 items-center justify-center transition-opacity duration-200 ease-bloom hover:opacity-60 lg:hidden"
          >
            <IconSearch className="h-[22px] w-[22px]" />
          </button>
          <Link
            href="/wishlist"
            aria-label="Wishlist"
            className="hidden h-11 w-11 items-center justify-center transition-opacity duration-200 ease-bloom hover:opacity-60 sm:flex"
          >
            <IconHeart className="h-[22px] w-[22px]" />
          </Link>
          <Link
            href="/account"
            aria-label="Account"
            className="hidden h-11 w-11 items-center justify-center transition-opacity duration-200 ease-bloom hover:opacity-60 sm:flex"
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

      {/* Row 3 — layered nav with mega-menus (desktop) */}
      <nav
        aria-label="Shop"
        className={cn(
          "hidden justify-center lg:flex",
          solid ? "border-t border-hairline/60" : "",
        )}
      >
        <ul className="flex items-center gap-9">
          {NAV_GROUPS.map((group) => (
            <li key={group.label} className="group/nav relative">
              <button
                type="button"
                className={cn(
                  "flex h-11 items-center font-brand text-xs font-medium uppercase tracking-brand transition-opacity duration-200 ease-bloom hover:opacity-60",
                  onDark ? "text-cream" : "text-olive",
                )}
              >
                {group.label}
              </button>
              {/* Mega panel — CSS hover/focus, no JS */}
              <div className="invisible absolute left-1/2 top-full z-40 -translate-x-1/2 pt-2 opacity-0 transition-[opacity,visibility] duration-200 ease-bloom group-focus-within/nav:visible group-focus-within/nav:opacity-100 group-hover/nav:visible group-hover/nav:opacity-100">
                <ul className="flex min-w-52 flex-col gap-1 rounded-media-sm border border-hairline bg-cream p-5 shadow-soft">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="block min-h-9 py-1.5 text-sm text-olive transition-opacity duration-200 ease-bloom hover:opacity-60"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
          {FEATURED_LINKS.map((link) => (
            <li key={link.href + link.label}>
              <Link
                href={link.href}
                className={cn(
                  "flex h-11 items-center font-brand text-xs font-medium uppercase tracking-brand transition-opacity duration-200 ease-bloom hover:opacity-60",
                  onDark ? "text-cream" : "text-olive",
                )}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Full-screen mobile menu — accordion groups in the olive overlay */}
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
              {NAV_GROUPS.map((group) => (
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
              {FEATURED_LINKS.map((link) => (
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
