import { redirect } from "next/navigation";
import { AdminMobileNav, AdminSidebar } from "@admin/components/AdminNav";
import { displayName, getAdminSession, roleLabel } from "@backend/data/admin-session";

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

  const nav = {
    name: displayName(session.user),
    role: roleLabel(session.user),
    isOwner: session.isAdmin,
  };

  return (
    <div className="admin-shell flex">
      <AdminSidebar {...nav} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar. Page titles live in each page's PageHeader, next to the
            content they describe. The decorative "notifications" button that
            used to sit here did nothing when pressed and has been removed — a
            control that does nothing is a small lie. */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-hairline/70 bg-white/95 px-4 py-3 backdrop-blur lg:px-8">
          <AdminMobileNav {...nav} />

          <form action="/admin/products" role="search" className="min-w-0 max-w-sm flex-1">
            <label htmlFor="admin-search" className="sr-only">
              Search products
            </label>
            <input
              id="admin-search"
              name="q"
              type="search"
              placeholder="Search products…"
              className="h-11 w-full rounded-md border border-hairline bg-admin-sunken px-3 text-sm text-olive placeholder:text-sage/70"
            />
          </form>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight text-olive">{nav.name}</p>
              <p className="text-xs leading-tight text-sage">{nav.role}</p>
            </div>
            <span
              aria-hidden
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-olive font-brand text-xs uppercase tracking-brand text-cream"
            >
              {nav.name.slice(0, 1)}
            </span>
          </div>
        </header>

        <main id="admin-main" className="min-w-0 flex-1 px-4 pb-10 pt-6 lg:px-8 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
