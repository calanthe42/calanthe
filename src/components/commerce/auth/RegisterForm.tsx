"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { customerRegister, resendCustomerVerification } from "@backend/actions/account";
import { Button } from "@/components/ui/Button";
import { useT } from "@/lib/locale";
import { AuthField } from "./AuthField";
import { TermsCheckbox } from "./TermsCheckbox";
import { PhoneField } from "@/components/ui/PhoneField";
import {
  fieldClasses,
  fieldErrorClasses,
  labelClasses,
} from "@/components/ui/form-classes";

/**
 * Create account.
 *
 * The account works at once: customerRegister signs her in and she goes to
 * her account, where a line asks her to confirm the address from the email
 * we sent (that is what unlocks the welcome gift). An address that already
 * has an account is a field error pointing to sign-in. The "check your
 * inbox" screen remains only for the rare case the new session could not be
 * started.
 */
export function RegisterForm() {
  const router = useRouter();
  const t = useT();
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await customerRegister(formData);
    if (result.ok && result.signedIn) {
      /* Kept pending across the navigation, as SignInForm does. */
      router.push("/account");
      router.refresh();
      return;
    }
    setPending(false);
    if (result.ok) setSentTo(result.email);
    else setError({ field: result.field, message: result.message });
  }

  if (sentTo) {
    return (
      <div>
        {/*
          The address is a fragment inside the sentence, and it is always
          Latin script, so it keeps dir="ltr" wherever the sentence puts it.
          Splitting the sentence around it is what made this English: the
          dictionary owns the whole thing and names the slot.
        */}
        <p className="text-base leading-relaxed text-olive">
          {t.account.checkInbox.split("{email}").map((part, i) => (
            <span key={i}>
              {i > 0 && (
                <span dir="ltr" className="font-medium">
                  {sentTo}
                </span>
              )}
              {part}
            </span>
          ))}
        </p>
        <p className="mt-4 text-sm leading-relaxed text-ink-muted">
          {t.account.checkInboxNote}
        </p>
        <div className="mt-8 flex flex-col gap-3">
          {/* "Sent again" only when the server sent it; a throttled resend
              shows the server's own sentence, which says how long to wait. */}
          <Button
            variant="secondary"
            /* Held while it is sent: a second tap would mint a second link
               and leave the first email's link dead. */
            disabled={resent || resending}
            loading={resending}
            onClick={async () => {
              setResending(true);
              setResendError(null);
              const result = await resendCustomerVerification(sentTo).catch(() => null);
              setResending(false);
              if (result?.ok) setResent(true);
              else setResendError(result?.message ?? t.account.resendFailed);
            }}
          >
            {resent ? t.account.resent : t.account.resend}
          </Button>
          {resendError && (
            <p role="alert" className="text-base leading-relaxed text-olive">
              {resendError}
            </p>
          )}
          <Button variant="text" onClick={() => router.push("/account/login")}>
            {t.account.backToSignIn}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-6"
      noValidate
      onSubmit={(e) => {
        /* Not a form action: React empties a form after its action runs, so a
           rejected phone number used to clear everything else typed. */
        e.preventDefault();
        void onSubmit(new FormData(e.currentTarget));
      }}
    >
      <AuthField
        id="reg-name"
        name="name"
        label={t.account.name}
        autoComplete="name"
        required
        error={error?.field === "name" ? error.message : undefined}
      />
      <AuthField
        id="reg-email"
        name="email"
        type="email"
        label={t.account.email}
        autoComplete="email"
        required
        error={error?.field === "email" ? error.message : undefined}
      />
      <div>
        <label htmlFor="reg-phone" className={labelClasses}>
          {t.account.phoneOptional}
        </label>
        <PhoneField
          id="reg-phone"
          name="phone"
          fieldClassName={fieldClasses}
          aria-invalid={error?.field === "phone" ? true : undefined}
          aria-describedby={error?.field === "phone" ? "reg-phone-error" : undefined}
        />
        {/* A number already on an account, or one that is not complete. */}
        {error?.field === "phone" && (
          <p id="reg-phone-error" role="alert" className={fieldErrorClasses}>
            <span aria-hidden className="text-burnt-orange">
              ·
            </span>
            {error.message}
          </p>
        )}
      </div>
      <AuthField
        id="reg-password"
        name="password"
        type="password"
        label={t.account.password}
        autoComplete="new-password"
        required
        hint={t.account.passwordHint}
        error={error?.field === "password" ? error.message : undefined}
      />
      <AuthField
        id="reg-confirm"
        name="confirmPassword"
        type="password"
        label={t.account.confirmPassword}
        autoComplete="new-password"
        required
        error={error?.field === "confirmPassword" ? error.message : undefined}
      />
      <TermsCheckbox id="reg-terms" error={error?.field === "terms" ? error.message : undefined} />

      {error && !error.field && (
        <p role="alert" className="text-sm leading-relaxed text-olive">
          {error.message}
        </p>
      )}

      <Button type="submit" loading={pending} loadingText={t.account.creating}>
        {t.account.createAccount}
      </Button>
    </form>
  );
}
