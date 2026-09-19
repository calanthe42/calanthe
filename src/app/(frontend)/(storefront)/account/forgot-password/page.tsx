import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/server";
import { AuthShell, AuthLink } from "@/components/commerce/auth/AuthShell";
import { ForgotPasswordForm } from "@/components/commerce/auth/ForgotPasswordForm";

export const metadata: Metadata = { title: "Forgotten password" };

export default async function ForgotPasswordPage() {
  const { t } = await getDictionary();
  return (
    <AuthShell
      eyebrow={t.account.eyebrow}
      title={t.account.forgotTitle}
      intro={t.account.forgotIntro}
      footer={
        <p>
          {t.account.rememberedIt}{" "}<AuthLink href="/account/login">{t.account.signIn}</AuthLink>
        </p>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
