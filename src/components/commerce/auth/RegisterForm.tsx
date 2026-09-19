"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { customerRegister, resendCustomerVerification } from "@backend/actions/account";
import { Button } from "@/components/ui/Button";
import { useT } from "@/lib/locale";
import { AuthField } from "./AuthField";

/**
 * Create account.
 *
 * On success this does NOT sign anyone in. Users carries `auth.verify: true`,
 * so Payload has sent a verification email and the account cannot log in
 * until the link is followed — showing a session here would be a lie about
 * the account's state.
 *
 * A duplicate address returns success too (see customerRegister): the person
 * who already has an account sees the same screen and receives nothing new,
 * which is correct and tells a stranger nothing about who is registered.
 */
export function RegisterForm() {
  const router = useRouter();
  const t = useT();
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await customerRegister(formData);
    setPending(false);
    if (result.ok) setSentTo(result.email);
    else setError({ field: result.field, message: result.message });
  }

  if (sentTo) {
    return (
      <div>
        <p className="text-base leading-relaxed text-olive">
          Check <span dir="ltr" className="font-medium">{sentTo}</span> for a link to
          confirm your address. It expires in a few hours.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-ink-muted">
          {t.account.checkInboxNote}
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Button
            variant="secondary"
            disabled={resent}
            onClick={async () => {
              await resendCustomerVerification(sentTo);
              setResent(true);
            }}
          >
            {resent ? t.account.resent : t.account.resend}
          </Button>
          <Button variant="text" onClick={() => router.push("/account/login")}>
            {t.account.backToSignIn}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-6" noValidate>
      <AuthField
        id="reg-name"
        name="name"
        label={t.account.name}
        autoComplete="name"
        required
        error={error?.field === "name" ? error.message : undefined}
      />
      <AuthField
        id="reg-email"
        name="email"
        type="email"
        label={t.account.email}
        autoComplete="email"
        required
        error={error?.field === "email" ? error.message : undefined}
      />
      <AuthField
        id="reg-phone"
        name="phone"
        type="tel"
        label={t.account.phoneOptional}
        autoComplete="tel"
        placeholder="+9715…"
      />
      <AuthField
        id="reg-password"
        name="password"
        type="password"
        label={t.account.password}
        autoComplete="new-password"
        required
        hint={t.account.passwordHint}
        error={error?.field === "password" ? error.message : undefined}
      />
      <AuthField
        id="reg-confirm"
        name="confirmPassword"
        type="password"
        label={t.account.confirmPassword}
        autoComplete="new-password"
        required
        error={error?.field === "confirmPassword" ? error.message : undefined}
      />

      {error && !error.field && (
        <p role="alert" className="text-sm leading-relaxed text-olive">
          {error.message}
        </p>
      )}

      <Button type="submit" loading={pending} loadingText={t.account.creating}>
        {t.account.createAccount}
      </Button>
    </form>
  );
}
