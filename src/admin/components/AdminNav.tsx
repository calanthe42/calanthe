"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { adminLogout } from "@backend/actions/admin-auth";

/**
 * The admin's navigation: a fixed rail on desktop, a drawer on mobile.
 *
 * Grouped by what the owner is trying to do rather than by collection, which
 * is the whole difference between this and the CMS. "Shop", "Orders",
 * "Business", "System" are the four hats she wears; the database tables
 * underneath are not her problem.
 *
 * TWO COMPONENTS, NOT ONE. This used to be a single component mounted twice —
 * once in the page row, once in the top bar — and each mount rendered both the
 * drawer trigger and the rail. On a phone that left a second, stray menu
 * button pinned beside the content. The rail and the drawer are now separate,
 * and each is mounted exactly where it belongs.
 */

export type NavItem = { label: string; href: string };
export type NavGroup = { heading: string | null; items: NavItem[] };

export const NAV: NavGroup[] = [
  { heading: null, items: [{ label: "Dashboard", href: "/admin" }] },
  {
    heading: "Shop",
    items: [
      { label: "Products", href: "/admin/products" },
      { label: "Occasions", href: "/admin/occasions" },
      { label: "Media", href: "/admin/media" },
    ],
  },
  {
    heading: "Orders",
    items: [
      { label: "Orders", href: "/admin/orders" },
      { label: "Customers", href: "/admin/customers" },
      { label: "Enquiries", href: "/admin/enquiries" },
      { label: "Events", href: "/admin/events" },
    ],
  },
  {
    heading: "Business",
    items: [
      { label: "Memberships", href: "/admin/memberships" },
      { label: "Marketing", href: "/admin/marketing" },
      { label: "Delivery", href: "/admin/delivery" },
    ],
  },
  {
    heading: "System",
    items: [
      { label: "Staff", href: "/admin/staff" },
      { label: "Settings", href: "/admin/settings" },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Brand() {
  return (
    <div>
      <p className="font-brand text-base uppercase tracking-brand text-cream">Calanthe</p>
      <p className="mt-0.5 text-xs text-cream/55">Admin</p>
    </div>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin sections" className="flex flex-col gap-6 px-3">
      {NAV.map((group) => (
        <div key={group.heading ?? "root"}>
          {group.heading ? (
            <p className="px-3 pb-2 font-brand text-[10px] uppercase tracking-brand text-cream/45">
              {group.heading}
            </p>
          ) : null}
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-10 items-center rounded-md px-3 text-sm transition-colors duration-150",
                      active
                        ? "bg-cream/15 font-medium text-cream"
                        : "text-cream/70 hover:bg-cream/10 hover:text-cream",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/**
 * Who is signed in, sign-out, and — for the owner only — the way to the
 * developer CMS.
 *
 * The CMS link is deliberately small, labelled for what it is, and absent for
 * staff. Nothing a florist or the owner does day to day needs it; it exists so
 * a developer maintaining the site can reach the infrastructure without the
 * business screens having to pretend it is not there.
 */
function UserFooter({ name, role, isOwner }: { name: string; role: string; isOwner: boolean }) {
  return (
    <div className="mt-auto border-t border-cream/15 px-6 py-4">
      <p className="truncate text-sm font-medium text-cream">{name}</p>
      <p className="text-xs text-cream/55">{role}</p>
      <form action={adminLogout} className="mt-3">
        <button
          type="submit"
          className="min-h-9 text-xs text-cream/75 underline underline-offset-4 hover:text-cream"
        >
          Sign out
        </button>
      </form>
      {isOwner ? (
        <div className="mt-4 border-t border-cream/10 pt-3">
          <p className="font-brand text-[9px] uppercase tracking-brand text-cream/35">Developer</p>
          <a
            href="/cms"
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex min-h-9 items-center text-[11px] text-cream/45 hover:text-cream/80"
          >
            Developer CMS ↗
          </a>
        </div>
      ) : null}
    </div>
  );
}

type NavProps = { name: string; role: string; isOwner: boolean };

/** Desktop rail. Hidden below the `lg` breakpoint. */
export function AdminSidebar({ name, role, isOwner }: NavProps) {
  return (
    <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col bg-olive lg:flex">
      <div className="px-6 py-6">
        <Brand />
      </div>
      <div className="flex-1 overflow-y-auto pb-4">
        <NavLinks />
      </div>
      <UserFooter name={name} role={role} isOwner={isOwner} />
    </aside>
  );
}

/** Mobile trigger and drawer. Renders nothing at `lg` and above. */
export function AdminMobileNav({ name, role, isOwner }: NavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  /* A drawer that survives navigation traps the user on mobile. */
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    /* The page behind a modal drawer must not scroll under a thumb. */
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-hairline bg-white text-olive"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
          <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-olive/60"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Admin menu"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-olive"
          >
            <div className="flex items-start justify-between px-6 py-5">
              <Brand />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="-mr-3 inline-flex h-11 w-11 items-center justify-center text-cream/70 hover:text-cream"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto pb-4">
              <NavLinks onNavigate={() => setOpen(false)} />
            </div>
            <UserFooter name={name} role={role} isOwner={isOwner} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
