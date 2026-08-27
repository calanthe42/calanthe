"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/cart";
import { primaryNavLinks } from "@/lib/data";
import { useScrollLock } from "@/lib/useScrollLock";
import { MonogramBloom } from "@/components/motion/MonogramBloom";
import { IconBag, IconHeart, IconUser } from "@/components/ui/icons";
import { Logotype } from "@/components/ui/Logotype";
import { cn } from "@/lib/cn";

const NAV_LINKS = primaryNavLinks;

/** Routes whose hero sits dark and full-bleed behind the header. */
const OVERLAY_ROUTES = new Set(["/"]);

export function Header() {
  const pathname = usePathname();
  const overlay = OVERLAY_ROUTES.has(pathname);
  const [scrolled, setScrolled] = useState(false);
  const [menuState, setMenuState] = useState<"closed" | "open" | "closing">("closed");
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

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-colors duration-300 ease-bloom",
        scrolled && !menuOpen
          ? "border-b border-hairline bg-cream"
          : "border-b border-transparent bg-transparent",
      )}
    >
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

        {/* Desktop nav — left */}
        <nav className="hidden flex-1 lg:block" aria-label="Primary">
          <ul className="flex items-center gap-8">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={cn(
                    "font-brand text-xs font-medium uppercase tracking-brand transition-opacity duration-200 ease-bloom hover:opacity-60",
                    onDark ? "text-cream" : "text-olive",
                  )}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

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

      {/* Full-screen mobile menu — CSS-animated in and out */}
      {menuState !== "closed" && (
        <div
          className={cn(
            "fixed inset-0 z-40 flex flex-col bg-olive px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-[calc(env(safe-area-inset-top)+5rem)] lg:hidden",
            menuState === "closing" ? "menu-out" : "menu-in",
          )}
        >
          <MonogramBloom className="mx-auto w-16 text-cream" />

          <nav aria-label="Mobile" className="mt-10 flex-1">
            <ul className="menu-links flex flex-col gap-2">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={closeMenu}
                    className="block py-3 font-brand text-2xl font-medium uppercase tracking-brand text-cream transition-opacity duration-200 ease-bloom active:opacity-60"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <p className="menu-footnote font-brand text-[0.625rem] uppercase tracking-brand text-sage">
            Flower Atelier — UAE
          </p>
        </div>
      )}
    </header>
  );
}
