import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell, AuthLink } from "@/components/commerce/auth/AuthShell";
import { SignInForm } from "@/components/commerce/auth/SignInForm";
import { getCustomerSession } from "@backend/actions/account";
import { getDictionary } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { t } = await getDictionary();
  if (await getCustomerSession()) redirect("/account");
  const { next } = await searchParams;

  return (
    <AuthShell
      eyebrow={t.account.eyebrow}
      title={t.account.signInTitle}
      intro={t.account.signInIntro}
      footer={
        <div className="flex flex-col gap-2">
          <p>
            {t.account.newHere}{" "}<AuthLink href="/account/register">{t.account.createAccount}</AuthLink>
          </p>
          <p>
            <AuthLink href="/account/forgot-password">{t.account.forgotLink}</AuthLink>
          </p>
        </div>
      }
    >
      <SignInForm next={next} />
    </AuthShell>
  );
}
