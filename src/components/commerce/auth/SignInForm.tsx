"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { customerLogin } from "@backend/actions/account";
import { Button } from "@/components/ui/Button";
import { useT } from "@/lib/locale";
import { AuthField } from "./AuthField";

/**
 * Sign in.
 *
 * One message for every failure — wrong password, unknown address, locked,
 * unverified. Telling them apart tells a stranger which addresses have
 * accounts here (the server action is deliberately built the same way).
 *
 * On success the customer goes to /account. Never to /admin or /cms: the
 * action refuses any role but `customer`, and the admin layout's own gate
 * would refuse the session anyway.
 */
export function SignInForm({ next }: { next?: string }) {
  const router = useRouter();
  const t = useT();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await customerLogin(formData);
    if (!result.ok) {
      setPending(false);
      setError(result.message);
      return;
    }
    /* Kept pending across the navigation: the button must not flick back to
       its resting state while the next page is still loading. */
    router.push(next && next.startsWith("/") ? next : "/account");
    router.refresh();
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-6" noValidate>
      <AuthField
        id="in-email"
        name="email"
        type="email"
        label={t.account.email}
        autoComplete="email"
        required
      />
      <AuthField
        id="in-password"
        name="password"
        type="password"
        label={t.account.password}
        autoComplete="current-password"
        required
      />

      {error && (
        <p role="alert" className="text-sm leading-relaxed text-olive">
          {error}
        </p>
      )}

      <Button type="submit" loading={pending} loadingText={t.account.signingIn}>
        {t.account.signIn}
      </Button>
    </form>
  );
}
