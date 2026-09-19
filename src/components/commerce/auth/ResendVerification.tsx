"use client";

import { useState } from "react";
import { resendCustomerVerification } from "@backend/actions/account";
import { Button } from "@/components/ui/Button";
import { useT } from "@/lib/locale";
import { AuthField } from "./AuthField";

/**
 * Ask for a fresh verification email.
 *
 * Like the reset request, this always reports success — an address with no
 * account and one that is already verified must look identical from here.
 */
export function ResendVerification() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

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
      <Button
        loading={pending}
        loadingText={t.account.sending}
        onClick={async () => {
          setPending(true);
          await resendCustomerVerification(email);
          setPending(false);
          setSent(true);
        }}
      >
        {t.account.sendNewLink}
      </Button>
    </div>
  );
}
