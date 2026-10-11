import Link from "next/link";
import { redirect } from "next/navigation";
import { ChangePasswordForm } from "@admin/components/PasswordForms";
import { getAdminI18n } from "@admin/i18n/server";
import { AuthShell } from "@admin/shell/AuthShell";
import { getAdminSession } from "@backend/data/admin-session";

/**
 * Change my password — and, after a temporary password, the one screen the
 * admin allows until a real password is chosen (see the panel layout).
 */
export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("password.changeTitle") };
}

export const dynamic = "force-dynamic";

export default async function AdminPasswordPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login?next=/admin/password");
  const { t } = await getAdminI18n();
  const forced = Boolean((session.user as { mustChangePassword?: boolean }).mustChangePassword);

  return (
    <AuthShell
      title={forced ? t("password.chooseTitle") : t("password.changeTitle")}
      lead={forced ? t("password.chooseLead") : t("password.changeLead")}
      footnote={
        forced ? null : (
          <Link href="/admin" className="underline underline-offset-4 hover:text-ink">
            {t("password.backToAdmin")}
          </Link>
        )
      }
    >
      <ChangePasswordForm forced={forced} email={String(session.user.email ?? "")} />
    </AuthShell>
  );
}
