"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resetCustomerPassword } from "@backend/actions/account";
import { Button } from "@/components/ui/Button";
import { useT } from "@/lib/locale";
import { AuthField } from "./AuthField";

/** Choose a new password from a reset link. */
export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const t = useT();
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await resetCustomerPassword(formData);
    setPending(false);
    if (result.ok) setDone(true);
    else setError({ field: result.field, message: result.message });
  }

  if (done) {
    return (
      <div>
        <p className="text-base leading-relaxed text-olive">
          {t.account.passwordChanged}
        </p>
        <Button className="mt-8 w-full" onClick={() => router.push("/account/login")}>
          {t.account.signIn}
        </Button>
      </div>
    );
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-6" noValidate>
      <input type="hidden" name="token" value={token} />
      <AuthField
        id="rp-password"
        name="password"
        type="password"
        label={t.account.newPassword}
        autoComplete="new-password"
        required
        hint={t.account.passwordHint}
        error={error?.field === "password" ? error.message : undefined}
      />
      <AuthField
        id="rp-confirm"
        name="confirmPassword"
        type="password"
        label={t.account.confirmNewPassword}
        autoComplete="new-password"
        required
        error={error?.field === "confirmPassword" ? error.message : undefined}
      />
      {error && !error.field && (
        <p role="alert" className="text-sm leading-relaxed text-olive">
          {error.message}
        </p>
      )}
      <Button type="submit" loading={pending} loadingText={t.account.saving}>
        {t.account.saveNewPassword}
      </Button>
    </form>
  );
}
