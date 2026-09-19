import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/server";
import { AuthShell, AuthLink } from "@/components/commerce/auth/AuthShell";
import { ResetPasswordForm } from "@/components/commerce/auth/ResetPasswordForm";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  const { t } = await getDictionary();

  if (!token) {
    return (
      <AuthShell
        eyebrow={t.account.eyebrow}
        title={t.account.incompleteTitle}
        intro={t.account.incompleteIntro}
        footer={
          <p>
            <AuthLink href="/account/forgot-password">{t.account.sendNewLink}</AuthLink>
          </p>
        }
      >
        <span />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow={t.account.eyebrow}
      title={t.account.resetTitle}
      intro={t.account.resetIntro}
      footer={
        <p>
          <AuthLink href="/account/login">{t.account.backToSignIn}</AuthLink>
        </p>
      }
    >
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
