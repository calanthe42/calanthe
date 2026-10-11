import { getAdminI18n, getAdminPreferences } from "@admin/i18n/server";
import { LanguageSwitcher, ThemeSwitcher } from "@admin/shell/Preferences";

/**
 * The frame every signed-out admin screen shares — sign in, forgot password,
 * reset password, choose your password: the olive column with the wordmark,
 * the task on the right, language and theme reachable before signing in.
 *
 * On a phone the preferences sit below the task, so the form is the first
 * thing under the wordmark rather than 700px down the screen.
 */
export async function AuthShell({
  title,
  lead,
  children,
  footnote,
}: {
  title: string;
  lead?: string;
  children: React.ReactNode;
  footnote?: React.ReactNode;
}) {
  const [{ t }, preferences] = await Promise.all([getAdminI18n(), getAdminPreferences()]);

  return (
    <main className="relative flex min-h-svh flex-col lg:flex-row">
      <section className="admin-nav flex flex-col gap-6 bg-nav px-5 py-6 text-nav-ink sm:px-10 lg:w-[26rem] lg:justify-between lg:py-10 lg:pb-56">
        <div>
          <p lang="en" className="font-brand text-lg uppercase tracking-brand">
            Calanthe
          </p>
          <p className="mt-1 text-sm text-nav-ink-2">{t("nav.adminLabel")}</p>
        </div>
        <p className="hidden font-display text-3xl font-light leading-snug lg:block">{t("auth.subtitle")}</p>
      </section>

      <section className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-3xl font-light text-ink">{title}</h1>
          {lead ? <p className="mt-2 text-sm leading-relaxed text-ink-2">{lead}</p> : null}
          {children}
          {footnote ? <div className="mt-8 text-xs leading-relaxed text-ink-3">{footnote}</div> : null}
        </div>
      </section>

      <div className="admin-nav order-last bg-nav px-5 py-6 text-nav-ink sm:px-10 lg:absolute lg:bottom-0 lg:start-0 lg:w-[26rem] lg:px-10 lg:py-10">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 [&_fieldset]:px-0">
          <LanguageSwitcher locale={preferences.locale} />
          <ThemeSwitcher theme={preferences.theme} />
        </div>
      </div>
    </main>
  );
}
