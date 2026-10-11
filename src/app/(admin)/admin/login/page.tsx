import { redirect } from "next/navigation";
import { AdminLoginForm } from "@admin/components/AdminLoginForm";
import Link from "next/link";
import { getAdminI18n } from "@admin/i18n/server";
import { AuthShell } from "@admin/shell/AuthShell";
import { Notice } from "@admin/ui/States";
import { getAdminSession } from "@backend/data/admin-session";

/**
 * The admin sign-in screen.
 *
 * The owner's first screen of her own business tool is a Calanthe page, in
 * Calanthe's words and in her language — not a developer CMS she has no
 * reason to know exists. Language and theme can be chosen before signing in.
 */

export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("auth.title") };
}

/* Reads the session to send an already-signed-in person straight through. */
export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; signedOut?: string }>;
}) {
  const { next = "", signedOut } = await searchParams;

  if (await getAdminSession()) redirect("/admin");

  const { t } = await getAdminI18n();

  return (
    <AuthShell
      title={t("auth.title")}
      footnote={<p>{t("auth.note")}</p>}
    >
      <p className="mt-1.5 text-sm text-ink-3 lg:hidden">{t("auth.subtitle")}</p>
      {signedOut ? (
        <Notice tone="success" className="mb-0 mt-5">
          {t("auth.signedOut")}
        </Notice>
      ) : null}
      <AdminLoginForm next={next} />
      <p className="mt-4 text-sm">
        <Link href="/admin/forgot-password" className="text-ink-2 underline underline-offset-4 hover:text-ink">
          {t("auth.forgot")}
        </Link>
      </p>
    </AuthShell>
  );
}
