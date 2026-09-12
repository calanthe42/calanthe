"use client";

import { useI18n } from "@admin/i18n/client";
import { Button, ButtonLink } from "@admin/ui/Button";
import { ErrorState } from "@admin/ui/States";

/**
 * The admin's error boundary.
 *
 * States plainly that nothing was lost, because the first question a business
 * owner has when a screen breaks is whether her data survived. The digest is
 * shown so a failure can be found in the server logs without guesswork.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();
  return (
    <ErrorState
      title={t("errors.title")}
      body={t("errors.body")}
      reference={error.digest ? t("errors.reference", { digest: error.digest }) : undefined}
      actions={
        <>
          <Button variant="primary" onClick={reset}>
            {t("common.tryAgain")}
          </Button>
          <ButtonLink href="/admin">{t("errors.backToDashboard")}</ButtonLink>
        </>
      }
    />
  );
}
