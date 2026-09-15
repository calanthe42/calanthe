"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { adminLogout } from "@backend/actions/admin-auth";
import { useI18n } from "@admin/i18n/client";
import type { AdminLocale, AdminTheme } from "@admin/preferences";
import { Dialog } from "@admin/ui/Dialog";
import { IconButton, IconLink } from "@admin/ui/IconButton";
import { Icon } from "@admin/ui/icons";
import { NAV_GROUPS, isActive } from "./nav";
import { LanguageSwitcher, ThemeSwitcher } from "./Preferences";

/**
 * The admin's frame: a fixed sidebar on desktop, a top bar and a drawer on a
 * phone. Both render the same navigation and the same footer — View store,
 * language, theme, the account and sign-out — so nothing exists on one device
 * and not the other.
 *
 * The drawer is a native <dialog>: Escape closes it, focus is trapped inside
 * while it is open and returns to the menu button afterwards, and the page
 * behind cannot be tabbed into.
 */

export type NavUser = { name: string; role: string; isOwner: boolean };
type ShellProps = { user: NavUser; theme: AdminTheme; locale: AdminLocale };

function Wordmark() {
  const { t } = useI18n();
  return (
    <Link href="/admin" className="inline-flex min-h-11 flex-col justify-center rounded-sm">
      <span lang="en" className="font-brand text-[15px] uppercase leading-none tracking-brand text-nav-ink">
        Calanthe
      </span>
      <span className="mt-1 text-xs leading-none text-nav-ink-2">{t("nav.adminLabel")}</span>
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <nav aria-label={t("nav.primary")} className="px-3">
      {NAV_GROUPS.map((group, index) => (
        <div key={group.heading} className={index === 0 ? undefined : "mt-5"}>
          <p className="px-3 pb-1.5 font-brand text-[10px] uppercase tracking-brand text-nav-ink-2">
            {t(group.heading)}
          </p>
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
                      "relative flex min-h-11 items-center gap-3 rounded-md px-3 text-sm transition-colors duration-150 lg:min-h-10",
                      active
                        ? "bg-nav-active font-medium text-nav-ink"
                        : "text-nav-ink-2 hover:bg-nav-hover hover:text-nav-ink",
                    )}
                  >
                    {active ? (
                      <span aria-hidden className="absolute inset-y-2 start-0 w-0.5 rounded-full bg-accent" />
                    ) : null}
                    <Icon name={item.icon} className="h-[18px] w-[18px]" />
                    <span className="min-w-0 flex-1 truncate">{t(item.label)}</span>
                    {item.soon ? (
                      <span className="shrink-0 rounded-sm border border-nav-ink-2/35 px-1.5 text-[10px] leading-4 text-nav-ink-2">
                        {t("common.soon")}
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

function NavFooter({ user, theme, locale }: ShellProps) {
  const { t } = useI18n();
  const initial = user.name.trim().slice(0, 1).toLocaleUpperCase() || "·";

  return (
    <div className="space-y-3 border-t border-nav-hover px-3 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3">
      <a
        href="/"
        target="_blank"
        rel="noreferrer"
        className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm text-nav-ink-2 transition-colors duration-150 hover:bg-nav-hover hover:text-nav-ink lg:min-h-10"
      >
        <Icon name="store" className="h-[18px] w-[18px]" />
        <span className="min-w-0 flex-1 truncate">{t("nav.viewStore")}</span>
        <Icon name="external" className="h-3.5 w-3.5" />
        <span className="sr-only">{t("common.opensNewTab")}</span>
      </a>

      <LanguageSwitcher locale={locale} />
      <ThemeSwitcher theme={theme} />

      <div className="flex items-center gap-3 rounded-md px-3 pt-1">
        <span
          aria-hidden
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-nav-active text-sm font-medium text-nav-ink"
        >
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-nav-ink">{user.name}</p>
          <p className="truncate text-xs text-nav-ink-2">{user.role}</p>
        </div>
        <form action={adminLogout}>
          <IconButton type="submit" tone="nav" icon="logout" label={t("nav.signOut")} />
        </form>
      </div>

      {/* The way to the developer CMS: small, labelled for what it is, and
          absent for staff. Nothing a florist does day to day needs it. */}
      {user.isOwner ? (
        <a
          href="/cms"
          target="_blank"
          rel="noreferrer"
          className="flex min-h-9 items-center gap-1.5 px-3 text-xs text-nav-ink-2 hover:text-nav-ink"
        >
          {t("nav.developerCms")}
          <Icon name="external" className="h-3 w-3" />
          <span className="sr-only">{t("common.opensNewTab")}</span>
        </a>
      ) : null}
    </div>
  );
}

/** Desktop sidebar. Hidden below the `lg` breakpoint. */
export function AdminSidebar(props: ShellProps) {
  return (
    <aside className="admin-nav sticky top-0 hidden h-svh w-64 shrink-0 flex-col bg-nav text-nav-ink lg:flex">
      <div className="px-6 pb-3 pt-5">
        <Wordmark />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-4 [scrollbar-width:thin]">
        <NavLinks />
      </div>
      <NavFooter {...props} />
    </aside>
  );
}

/** Phone and tablet top bar with the navigation drawer. Hidden at `lg` and above. */
export function AdminMobileBar(props: ShellProps) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  /* A drawer that survives navigation traps the person on the old screen. */
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <div className="sticky top-0 z-30 flex h-14 items-center gap-1 border-b border-line bg-page/90 px-2 backdrop-blur-md lg:hidden">
        <IconButton icon="menu" label={t("nav.openMenu")} aria-expanded={open} onClick={() => setOpen(true)} />
        <Link href="/admin" className="inline-flex min-h-11 items-center px-1">
          <span lang="en" className="font-brand text-sm uppercase tracking-brand text-ink">
            Calanthe
          </span>
        </Link>
        <div className="ms-auto flex items-center">
          <IconLink icon="search" label={t("nav.searchLabel")} href="/admin/products" />
          <IconLink icon="store" label={t("nav.viewStore")} href="/" external />
        </div>
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("nav.menu")}
        variant="drawer"
        hideHeader
        className="admin-nav lg:hidden"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-5 pb-1 pt-3">
            <Wordmark />
            <IconButton icon="close" tone="nav" label={t("nav.closeMenu")} onClick={() => setOpen(false)} className="-me-2" />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pb-4">
            <NavLinks onNavigate={() => setOpen(false)} />
          </div>
          <NavFooter {...props} />
        </div>
      </Dialog>
    </>
  );
}
