import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Cinzel, Cormorant_Garamond, Instrument_Sans } from "next/font/google";
import { AdminNav } from "@admin/components/AdminNav";
import { displayName, getAdminSession, roleLabel } from "@backend/data/admin-session";
import "../admin.css";

/**
 * The Calanthe business admin.
 *
 * A third root layout alongside (frontend) and (payload): the admin needs its
 * own HTML shell, its own stylesheet and none of the storefront's editorial
 * chrome — no announcement bar, no film grain, no smooth-scroll.
 *
 * THE GATE IS HERE, on the server, before anything renders. Every page under
 * /admin inherits it, so a new screen cannot be added without protection by
 * forgetting to add a check. Unauthenticated or customer sessions never see a
 * single byte of admin markup; they are redirected to the real Payload login,
 * because there is one authentication system and this is not a second one.
 */

export const metadata: Metadata = {
  title: { default: "Calanthe Admin", template: "%s · Calanthe Admin" },
  robots: { index: false, follow: false },
};

/* Session-dependent: never statically rendered or cached. */
export const dynamic = "force-dynamic";

const cinzel = Cinzel({ variable: "--font-cinzel", subsets: ["latin"], display: "swap" });
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});
const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
  display: "swap",
});

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();

  if (!session) {
    /* Payload owns login. A customer with a valid storefront session lands
       here too — getAdminSession refuses any role but admin/staff. */
    redirect("/cms/login");
  }

  const name = displayName(session.user);
  const role = roleLabel(session.user);

  return (
    <html lang="en">
      <body
        className={`${cinzel.variable} ${cormorant.variable} ${instrument.variable} antialiased`}
      >
        <div className="admin-shell flex">
          <AdminNav name={name} role={role} />

          <div className="flex min-w-0 flex-1 flex-col">
            {/* Top bar. Page titles live in each page's PageHeader, which
                keeps them next to the content they describe. */}
            <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-hairline/70 bg-white/95 px-4 py-3 backdrop-blur lg:px-8">
              <div className="lg:hidden">
                <AdminNav name={name} role={role} />
              </div>

              <form action="/admin/products" className="relative min-w-0 flex-1 max-w-sm">
                <label htmlFor="admin-search" className="sr-only">
                  Search products
                </label>
                <input
                  id="admin-search"
                  name="q"
                  type="search"
                  placeholder="Search products…"
                  className="h-10 w-full rounded-md border border-hairline bg-admin-sunken px-3 text-sm text-olive placeholder:text-sage/70"
                />
              </form>

              <div className="ml-auto flex items-center gap-3">
                <button
                  type="button"
                  aria-label="Notifications"
                  className="relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-hairline bg-white text-sage hover:text-olive"
                >
                  <span aria-hidden>◔</span>
                </button>
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-medium leading-tight text-olive">{name}</p>
                  <p className="text-xs leading-tight text-sage">{role}</p>
                </div>
                <span
                  aria-hidden
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-olive font-brand text-xs uppercase tracking-brand text-cream"
                >
                  {name.slice(0, 1)}
                </span>
              </div>
            </header>

            <main className="min-w-0 flex-1 px-4 py-8 lg:px-8 lg:py-10">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
