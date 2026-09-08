"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * The admin's navigation: a collapsible rail on desktop, a drawer on mobile.
 *
 * Grouped by what the owner is trying to do rather than by collection, which
 * is the whole difference between this and the CMS. "Shop", "Orders",
 * "Business", "System" are the four hats she wears; the database tables
 * underneath are not her problem.
 */

export type NavItem = { label: string; href: string; badge?: number };
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
                      "flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors duration-150",
                      active
                        ? "bg-cream/15 font-medium text-cream"
                        : "text-cream/70 hover:bg-cream/10 hover:text-cream",
                    )}
                  >
                    <span>{item.label}</span>
                    {item.badge ? (
                      <span className="rounded-sm bg-burnt-orange px-1.5 py-0.5 text-[11px] font-medium text-cream">
                        {item.badge}
                      </span>
                    ) : null}
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

function UserFooter({ name, role }: { name: string; role: string }) {
  return (
    <div className="mt-auto border-t border-cream/15 px-6 py-4">
      <p className="truncate text-sm font-medium text-cream">{name}</p>
      <p className="text-xs text-cream/55">{role}</p>
      <Link
        href="/cms/logout"
        className="mt-3 inline-block text-xs text-cream/70 underline underline-offset-4 hover:text-cream"
      >
        Sign out
      </Link>
    </div>
  );
}

export function AdminNav({ name, role }: { name: string; role: string }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  /* A drawer that survives navigation traps the user on mobile. */
  useEffect(() => setDrawerOpen(false), [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  return (
    <>
      {/* Mobile trigger. Lives in flow so it never covers content. */}
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        aria-label="Open navigation"
        aria-expanded={drawerOpen}
        className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-hairline bg-white text-olive lg:hidden"
      >
        <span aria-hidden className="text-lg leading-none">
          ≡
        </span>
      </button>

      {/* Desktop rail */}
      <aside className="hidden w-60 shrink-0 flex-col bg-olive lg:flex">
        <div className="px-6 py-6">
          <p className="font-brand text-base uppercase tracking-brand text-cream">Calanthe</p>
          <p className="mt-0.5 text-xs text-cream/55">Admin</p>
        </div>
        <div className="flex-1 overflow-y-auto pb-4">
          <NavLinks />
        </div>
        <UserFooter name={name} role={role} />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-olive/60"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Admin navigation"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-olive"
          >
            <div className="flex items-start justify-between px-6 py-6">
              <div>
                <p className="font-brand text-base uppercase tracking-brand text-cream">Calanthe</p>
                <p className="mt-0.5 text-xs text-cream/55">Admin</p>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close navigation"
                className="h-11 w-11 text-cream/70 hover:text-cream"
              >
                <span aria-hidden>×</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto pb-4">
              <NavLinks onNavigate={() => setDrawerOpen(false)} />
            </div>
            <UserFooter name={name} role={role} />
          </div>
        </div>
      ) : null}
    </>
  );
}
