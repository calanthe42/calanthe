import { redirect } from "next/navigation";
import { AdminLoginForm } from "@admin/components/AdminLoginForm";
import { getAdminI18n, getAdminPreferences } from "@admin/i18n/server";
import { LanguageSwitcher, ThemeSwitcher } from "@admin/shell/Preferences";
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

  const [{ t }, preferences] = await Promise.all([getAdminI18n(), getAdminPreferences()]);

  return (
    <main className="flex min-h-svh flex-col lg:flex-row">
      <section className="admin-nav flex flex-col gap-6 bg-nav px-5 py-6 text-nav-ink sm:px-10 lg:w-[26rem] lg:justify-between lg:py-10">
        <div>
          <p lang="en" className="font-brand text-lg uppercase tracking-brand">
            Calanthe
          </p>
          <p className="mt-1 text-sm text-nav-ink-2">{t("nav.adminLabel")}</p>
        </div>
        <p className="hidden font-display text-3xl font-light leading-snug lg:block">{t("auth.subtitle")}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 [&_fieldset]:px-0">
          <LanguageSwitcher locale={preferences.locale} />
          <ThemeSwitcher theme={preferences.theme} />
        </div>
      </section>

      <section className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-3xl font-light text-ink">{t("auth.title")}</h1>
          <p className="mt-1.5 text-sm text-ink-3 lg:hidden">{t("auth.subtitle")}</p>
          {signedOut ? (
            <Notice tone="success" className="mb-0 mt-5">
              {t("auth.signedOut")}
            </Notice>
          ) : null}
          <AdminLoginForm next={next} />
          <p className="mt-8 text-xs leading-relaxed text-ink-3">{t("auth.note")}</p>
        </div>
      </section>
    </main>
  );
}
