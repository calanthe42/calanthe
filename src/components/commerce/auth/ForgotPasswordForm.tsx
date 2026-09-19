"use client";

import { useState } from "react";
import { requestCustomerPasswordReset } from "@backend/actions/account";
import { Button } from "@/components/ui/Button";
import { useT } from "@/lib/locale";
import { AuthField } from "./AuthField";

/**
 * Request a reset link.
 *
 * ALWAYS reports success. An unknown address and a known one must be
 * indistinguishable from the outside, or this page becomes a way to test
 * which emails are registered. The wording says "if that address has an
 * account", which is both true and non-committal.
 */
export function ForgotPasswordForm() {
  const t = useT();
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await requestCustomerPasswordReset(formData);
    setPending(false);
    if (result.ok) setSent(true);
    else setError(result.message);
  }

  if (sent) {
    return (
      <p className="text-base leading-relaxed text-olive">{t.account.resetSentIfExists}</p>
    );
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-6" noValidate>
      <AuthField
        id="fp-email"
        name="email"
        type="email"
        label={t.account.email}
        autoComplete="email"
        required
      />
      {error && (
        <p role="alert" className="text-sm leading-relaxed text-olive">
          {error}
        </p>
      )}
      <Button type="submit" loading={pending} loadingText={t.account.sending}>
        {t.account.sendLink}
      </Button>
    </form>
  );
}
