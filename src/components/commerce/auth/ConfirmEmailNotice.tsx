"use client";

import { useState } from "react";
import { resendCustomerVerification } from "@backend/actions/account";
import { Button } from "@/components/ui/Button";
import { useT } from "@/lib/locale";

/**
 * On a signed-in account whose address is not confirmed yet: what to do,
 * and the link again on request. The account already works; confirming is
 * what unlocks the welcome gift (Users.emailConfirmedAt). Resending is
 * throttled per address on the server.
 */
export function ConfirmEmailNotice({ email }: { email: string }) {
  const t = useT();
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  return (
    <div role="status" className="mb-10 border-s border-burnt-orange ps-4">
      <p className="max-w-xl text-base leading-relaxed text-olive">
        {t.account.confirmNotice.split("{email}").map((part, index) => (
          <span key={index}>
            {index > 0 ? (
              <span dir="ltr" className="font-medium">
                {email}
              </span>
            ) : null}
            {part}
          </span>
        ))}
      </p>
      <Button
        type="button"
        variant="text"
        disabled={pending || sent}
        onClick={async () => {
          setPending(true);
          await resendCustomerVerification(email).catch(() => undefined);
          setPending(false);
          setSent(true);
        }}
        className="mt-1 px-0 text-base"
      >
        {sent ? t.account.resent : t.account.resend}
      </Button>
    </div>
  );
}
