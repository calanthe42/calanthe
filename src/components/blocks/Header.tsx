"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from "motion/react";
import { useLenis } from "lenis/react";
import { useCart } from "@/lib/cart";
import { EASE_BLOOM } from "@/components/motion/constants";
import { MonogramBloom } from "@/components/motion/MonogramBloom";
import { IconBag, IconHeart, IconUser } from "@/components/ui/icons";
import { Logotype } from "@/components/ui/Logotype";
import { cn } from "@/lib/cn";

const NAV_LINKS = [
  { label: "Shop", href: "/shop" },
  { label: "Occasions", href: "/occasions" },
  { label: "Build Your Own", href: "/build-your-own" },
  { label: "Membership", href: "/membership" },
] as const;

/** Routes whose hero sits dark and full-bleed behind the header. */
const OVERLAY_ROUTES = new Set(["/"]);

export function Header() {
  const pathname = usePathname();
  const overlay = OVERLAY_ROUTES.has(pathname);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { scrollY } = useScroll();
  const lenis = useLenis();
  const { count, openCart } = useCart();

  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 40));

  useEffect(() => {
    if (menuOpen) {
      lenis?.stop();
      document.documentElement.style.overflow = "hidden";
    } else {
      lenis?.start();
      document.documentElement.style.overflow = "";
    }
    return () => {
      lenis?.start();
      document.documentElement.style.overflow = "";
    };
  }, [menuOpen, lenis]);

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
          onClick={() => setMenuOpen((v) => !v)}
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

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </header>
  );
}

function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const reduced = useReducedMotion();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-40 flex flex-col bg-olive px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-[calc(env(safe-area-inset-top)+5rem)] lg:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.3, ease: EASE_BLOOM } }}
          transition={{ duration: 0.4, ease: EASE_BLOOM }}
        >
          <MonogramBloom className="mx-auto w-16 text-cream" />

          <nav aria-label="Mobile" className="mt-10 flex-1">
            <ul className="flex flex-col gap-2">
              {NAV_LINKS.map((link, i) => (
                <motion.li
                  key={link.href}
                  initial={reduced ? { opacity: 0 } : { opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{
                    opacity: 0,
                    transition: {
                      duration: 0.2,
                      ease: EASE_BLOOM,
                      delay: (NAV_LINKS.length - 1 - i) * 0.05,
                    },
                  }}
                  transition={{
                    duration: 0.6,
                    ease: EASE_BLOOM,
                    delay: 0.15 + i * 0.08,
                  }}
                >
                  <Link
                    href={link.href}
                    onClick={onClose}
                    className="block py-3 font-brand text-2xl font-medium uppercase tracking-brand text-cream transition-opacity duration-200 ease-bloom active:opacity-60"
                  >
                    {link.label}
                  </Link>
                </motion.li>
              ))}
            </ul>
          </nav>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: EASE_BLOOM, delay: 0.5 }}
            className="font-brand text-[0.625rem] uppercase tracking-brand text-sage"
          >
            Flower Atelier — UAE
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
