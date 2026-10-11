import { ResetPasswordForm } from "@admin/components/PasswordForms";
import { getAdminI18n } from "@admin/i18n/server";
import { AuthShell } from "@admin/shell/AuthShell";

/** Reached from the emailed link: /admin/reset-password?token=… */
export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("password.resetTitle") };
}

export const dynamic = "force-dynamic";

export default async function AdminResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  const { t } = await getAdminI18n();
  return (
    <AuthShell title={t("password.resetTitle")} lead={t("password.resetLead")}>
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
