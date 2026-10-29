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
 *
 * The button says "Sent again" only when the server says it sent. It used
 * to say so whatever came back, so a resend refused by the throttle left
 * her waiting for an email that was never going to come; now she reads the
 * server's own sentence, which says how long to wait.
 */
export function ConfirmEmailNotice({ email }: { email: string }) {
  const t = useT();
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          setError(null);
          const result = await resendCustomerVerification(email).catch(() => null);
          setPending(false);
          if (result?.ok) setSent(true);
          else setError(result?.message ?? t.account.resendFailed);
        }}
        className="mt-1 px-0 text-base"
      >
        {sent ? t.account.resent : t.account.resend}
      </Button>
      {/* No role of its own: the notice is already a status region, and a
          second live region inside it would read the sentence out twice. */}
      {error ? (
        <p className="mt-1 max-w-xl text-base leading-relaxed text-olive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
