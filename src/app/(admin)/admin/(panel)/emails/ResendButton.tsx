"use client";

import { useState, useTransition } from "react";
import { resendLoggedEmail } from "@backend/actions/emails";
import { Button } from "@admin/ui/Button";
import { useI18n } from "@admin/i18n/client";

/**
 * Sends a logged email again.
 *
 * The result is shown beside the button rather than as a toast: the answer
 * to "did it go this time?" belongs on the row it concerns, and a florist
 * scanning a list of failures needs to see which ones she has already
 * retried without holding it in her head.
 */
export function ResendButton({
  id,
  disabled,
  reason,
}: {
  id: string;
  disabled?: boolean;
  reason?: string;
}) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  if (disabled) {
    return (
      <span className="text-xs text-ink-muted" title={reason}>
        {reason ?? "—"}
      </span>
    );
  }

  return (
    <span className="flex flex-col items-start gap-1">
      <Button
        variant="secondary"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await resendLoggedEmail(id);
            setResult(
              r.ok
                ? { ok: true, message: t("emailLog.resent") }
                : { ok: false, message: r.message },
            );
          })
        }
      >
        {pending ? t("emailLog.resending") : t("emailLog.resend")}
      </Button>
      {result && (
        <span
          role="status"
          className={result.ok ? "text-xs text-olive" : "text-xs text-burnt-orange"}
        >
          {result.message}
        </span>
      )}
    </span>
  );
}
