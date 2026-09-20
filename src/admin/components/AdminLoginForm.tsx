"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { adminLogin } from "@backend/actions/admin-auth";
import { useI18n } from "@admin/i18n/client";
import { Button } from "@admin/ui/Button";
import { Field, Input } from "@admin/ui/Field";
import { Icon } from "@admin/ui/icons";

/**
 * The sign-in form. The password goes to a server action and nowhere else;
 * the session cookie is set on the server as httpOnly, so no script on the
 * page can read it.
 *
 * THE PASSWORD MUST NEVER LEAVE THE BROWSER EXCEPT TO THE ACTION.
 *
 * This form previously used `onSubmit` with no `action` and no `method`,
 * which means that until React hydrates it is an ordinary HTML form — and an
 * ordinary form with no method submits as GET. Someone who typed their
 * password and pressed Enter a moment too early was navigated to
 *
 *     /admin/login?email=…&password=…
 *
 * putting the admin password in the address bar, in browser history, in the
 * server's access log and in any proxy in between. That was observed in a
 * browser, not theorised.
 *
 * Passing a FUNCTION to `action` is what the storefront's auth forms already
 * do, and React renders it as `action="javascript:throw …"` — so a submit
 * before hydration does nothing at all and the credentials never leave the
 * page. The button is disabled until hydration so that "nothing at all" is
 * visible as "not ready yet" rather than as a dead button.
 */
export function AdminLoginForm({ next }: { next: string }) {
  const { t, resolve } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  /* False during server render and the first client render, true immediately
     after — which is exactly "has this form been wired up yet". */
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  return (
    <form
      action={(data: FormData) => {
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

      <Button
        type="submit"
        variant="primary"
        block
        disabled={!ready}
        loading={pending}
        loadingText={t("auth.pending")}
      >
        {t("auth.submit")}
      </Button>
    </form>
  );
}
