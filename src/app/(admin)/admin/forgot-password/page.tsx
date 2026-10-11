import { redirect } from "next/navigation";
import { ForgotPasswordForm } from "@admin/components/PasswordForms";
import { getAdminI18n } from "@admin/i18n/server";
import { AuthShell } from "@admin/shell/AuthShell";
import { getAdminSession } from "@backend/data/admin-session";

export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("password.forgotTitle") };
}

export const dynamic = "force-dynamic";

export default async function AdminForgotPasswordPage() {
  if (await getAdminSession()) redirect("/admin/password");
  const { t } = await getAdminI18n();
  return (
    <AuthShell title={t("password.forgotTitle")} lead={t("password.forgotLead")}>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
