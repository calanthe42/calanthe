import { redirect } from "next/navigation";
import { AdminMobileBar, AdminSidebar } from "@admin/shell/AdminNav";
import { getAdminI18n, getAdminPreferences } from "@admin/i18n/server";
import { SearchInput } from "@admin/ui/Field";
import { displayName, getAdminSession } from "@backend/data/admin-session";

/**
 * Every business screen in the Calanthe admin, behind the gate.
 *
 * THE GATE IS HERE, on the server, before anything renders. Every page in this
 * route group inherits it, so a new screen cannot be added without protection
 * by forgetting to add a check. Unauthenticated or customer sessions never see
 * a single byte of admin markup.
 *
 * They are sent to /admin/login — a Calanthe page — and no longer to Payload's
 * /cms/login. It is still Payload's authentication underneath (see
 * backend/actions/admin-auth.ts): one login system, presented in the business's
 * own interface instead of the developer's.
 */

/* Session-dependent: never statically rendered or cached. */
export const dynamic = "force-dynamic";

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();

  if (!session) {
    /* A customer with a valid storefront session lands here too —
       getAdminSession refuses any role but admin/staff. */
    redirect("/admin/login");
  }

  const [i18n, preferences] = await Promise.all([getAdminI18n(), getAdminPreferences()]);
  const { t } = i18n;

  const shell = {
    user: {
      name: displayName(session.user),
      role: i18n.label("role", session.user.role),
      isOwner: session.isAdmin,
    },
    theme: preferences.theme,
    locale: preferences.locale,
  };

  return (
    <div className="flex min-h-svh">
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-[90] focus:rounded-md focus:bg-raised focus:px-4 focus:py-3 focus:text-sm focus:text-ink focus:shadow-raised"
      >
        {t("nav.skip")}
      </a>

      <AdminSidebar {...shell} />

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminMobileBar {...shell} />

        {/* Desktop top bar: search, and who is signed in. */}
        <header className="sticky top-0 z-30 hidden h-16 items-center gap-4 border-b border-line bg-page/85 px-8 backdrop-blur-md lg:flex">
          <form action="/admin/products" role="search" className="w-full max-w-md">
            <label htmlFor="admin-search" className="sr-only">
              {t("nav.searchLabel")}
            </label>
            <SearchInput id="admin-search" name="q" placeholder={t("nav.searchPlaceholder")} className="bg-surface" />
          </form>
          <div className="ms-auto flex min-w-0 items-center gap-3">
            <div className="min-w-0 text-end">
              <p className="truncate text-sm font-medium leading-tight text-ink">{shell.user.name}</p>
              <p className="truncate text-xs leading-tight text-ink-3">{shell.user.role}</p>
            </div>
            <span
              aria-hidden
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-nav text-sm font-medium text-nav-ink"
            >
              {shell.user.name.trim().slice(0, 1).toLocaleUpperCase()}
            </span>
          </div>
        </header>

        <main
          id="admin-main"
          tabIndex={-1}
          className="mx-auto w-full min-w-0 max-w-[88rem] flex-1 px-4 pb-12 pt-6 focus:outline-none sm:px-6 lg:px-8 lg:pt-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
