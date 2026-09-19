import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell, AuthLink } from "@/components/commerce/auth/AuthShell";
import { RegisterForm } from "@/components/commerce/auth/RegisterForm";
import { getCustomerSession } from "@backend/actions/account";
import { getDictionary } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Create an account" };
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const { t } = await getDictionary();
  if (await getCustomerSession()) redirect("/account");

  return (
    <AuthShell
      eyebrow={t.account.eyebrow}
      title={t.account.registerTitle}
      intro={t.account.registerIntro}
      footer={
        <p>
          {t.account.haveAccount}{" "}<AuthLink href="/account/login">{t.account.signIn}</AuthLink>
        </p>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
