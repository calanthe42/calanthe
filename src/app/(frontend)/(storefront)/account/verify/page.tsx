import type { Metadata } from "next";
import { AuthShell, AuthLink } from "@/components/commerce/auth/AuthShell";
import { ResendVerification } from "@/components/commerce/auth/ResendVerification";
import { verifyCustomerEmail } from "@backend/actions/account";
import { getDictionary } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Confirm your email" };

/* The token is single-use and is spent by rendering, so this must never be
   cached or prerendered. */
export const dynamic = "force-dynamic";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  const { t } = await getDictionary();
  const result = token
    ? await verifyCustomerEmail(token)
    : ({ ok: false, message: "That verification link is not valid." } as const);

  if (result.ok) {
    return (
      <AuthShell
        eyebrow={t.account.eyebrow}
        title={t.account.verifiedTitle}
        intro={t.account.verifiedIntro}
        footer={
          <p>
            <AuthLink href="/account/login">{t.account.signIn}</AuthLink>
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
      title={t.account.expiredTitle}
      intro={result.message}
      footer={
        <p>
          <AuthLink href="/account/login">{t.account.backToSignIn}</AuthLink>
        </p>
      }
    >
      <ResendVerification />
    </AuthShell>
  );
}
