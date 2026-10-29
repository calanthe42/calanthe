"use client";

import { useState } from "react";
import { resendCustomerVerification } from "@backend/actions/account";
import { Button } from "@/components/ui/Button";
import { useT } from "@/lib/locale";
import { AuthField } from "./AuthField";

/**
 * Ask for a fresh verification email.
 *
 * Like the reset request, this reports success for every address — one
 * with no account and one that is already verified must look identical from
 * here. The only refusals the server gives (an address that is not one, or
 * too many requests for it) come before it looks anything up, so showing
 * them gives nothing away, and hiding them sent her off to wait for an email
 * that was never sent.
 */
export function ResendVerification() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (sent) {
    return (
      <p className="text-base leading-relaxed text-olive">
        {t.account.resendIfWaiting}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <AuthField
        id="rv-email"
        name="email"
        type="email"
        label={t.account.email}
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      {error && (
        <p role="alert" className="text-base leading-relaxed text-olive">
          {error}
        </p>
      )}
      <Button
        loading={pending}
        loadingText={t.account.sending}
        onClick={async () => {
          setPending(true);
          setError(null);
          const result = await resendCustomerVerification(email).catch(() => null);
          setPending(false);
          if (result?.ok) setSent(true);
          else setError(result?.message ?? t.account.resendFailed);
        }}
      >
        {t.account.sendNewLink}
      </Button>
    </div>
  );
}
