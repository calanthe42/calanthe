import { redirect } from "next/navigation";
import { AdminLoginForm } from "@admin/components/AdminLoginForm";
import { getAdminSession } from "@backend/data/admin-session";

/**
 * The admin sign-in screen.
 *
 * This replaces the redirect to Payload's /cms/login. The owner's first
 * screen of her own business tool is now a Calanthe page, in Calanthe's
 * words — not a developer CMS she has no reason to know exists.
 */

export const metadata = { title: "Sign in" };

/* Reads the session to send an already-signed-in person straight through. */
export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; signedOut?: string }>;
}) {
  const { next = "", signedOut } = await searchParams;

  if (await getAdminSession()) redirect("/admin");

  return (
    <main className="admin-shell flex min-h-svh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-brand text-lg uppercase tracking-brand text-olive">Calanthe</p>
          <p className="mt-1 text-sm text-sage">Admin</p>
        </div>

        <div className="rounded-md border border-hairline/70 bg-white p-6 shadow-[0_1px_2px_rgba(43,47,27,0.04)]">
          <h1 className="font-display text-2xl font-light text-olive">Sign in</h1>
          <p className="mt-1 text-sm leading-relaxed text-sage">
            Products, orders, customers and enquiries.
          </p>

          {signedOut ? (
            <p
              role="status"
              className="mt-4 rounded-md border border-hairline bg-admin-sunken px-3 py-2 text-sm text-olive"
            >
              You have signed out.
            </p>
          ) : null}

          <AdminLoginForm next={next} />
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-sage">
          After five unsuccessful attempts an account is paused for ten minutes. Password
          resets are not available from this screen yet — contact your website developer.
        </p>
      </div>
    </main>
  );
}
