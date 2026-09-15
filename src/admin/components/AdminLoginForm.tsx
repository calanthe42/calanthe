"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { adminLogin } from "@backend/actions/admin-auth";
import { useI18n } from "@admin/i18n/client";
import { Button } from "@admin/ui/Button";
import { Field, Input } from "@admin/ui/Field";
import { Icon } from "@admin/ui/icons";

/**
 * The sign-in form. The password goes to a server action and nowhere else;
 * the session cookie is set on the server as httpOnly, so no script on the
 * page can read it.
 */
export function AdminLoginForm({ next }: { next: string }) {
  const { t, resolve } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setError(null);
        startTransition(async () => {
          const result = await adminLogin(data);
          if (result.ok) {
            router.replace(result.redirectTo);
            router.refresh();
          } else {
            setError(resolve(result.code, undefined, result.message));
          }
        });
      }}
      className="mt-6 space-y-5"
      noValidate
    >
      <input type="hidden" name="next" value={next} />

      <Field id="admin-email" label={t("auth.email")}>
        <Input id="admin-email" name="email" type="email" autoComplete="username" required dir="ltr" />
      </Field>

      <Field id="admin-password" label={t("auth.password")}>
        <Input id="admin-password" name="password" type="password" autoComplete="current-password" required dir="ltr" />
      </Field>

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-md border border-danger/30 bg-danger/[0.08] px-3 py-2.5 text-sm leading-relaxed text-ink"
        >
          <Icon name="alert" className="mt-0.5 h-4 w-4 text-danger" />
          {error}
        </div>
      ) : null}

      <Button type="submit" variant="primary" block loading={pending} loadingText={t("auth.pending")}>
        {t("auth.submit")}
      </Button>
    </form>
  );
}
