"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import {
  changeOwnPassword,
  requestAdminPasswordReset,
  resetAdminPassword,
  type PasswordResult,
} from "@backend/actions/admin-password";
import { useI18n } from "@admin/i18n/client";
import { Button } from "@admin/ui/Button";
import { Field, Input } from "@admin/ui/Field";
import { Icon } from "@admin/ui/icons";

/**
 * The three password forms of the admin. Like the sign-in form, each posts
 * to a server action passed as a FUNCTION, so a submit before hydration does
 * nothing and a password can never end up in the address bar.
 */

/**
 * React resets a form after its action runs, which wiped every field after
 * an error ("too short") — including the temporary password, so the next
 * try failed with "current password is not right". Controlled fields keep
 * what was typed; they are cleared only on success.
 */
function useField() {
  const [value, setValue] = useState("");
  return { value, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value), clear: () => setValue("") };
}

function useReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready;
}

function Message({ result }: { result: PasswordResult | null }) {
  const { resolve } = useI18n();
  if (!result) return null;
  const text = resolve(result.code, undefined, result.message);
  return (
    <div
      role={result.ok ? "status" : "alert"}
      className={
        result.ok
          ? "flex items-start gap-2.5 rounded-md border border-success/30 bg-success/[0.08] px-3 py-2.5 text-sm leading-relaxed text-ink"
          : "flex items-start gap-2.5 rounded-md border border-danger/30 bg-danger/[0.08] px-3 py-2.5 text-sm leading-relaxed text-ink"
      }
    >
      <Icon name={result.ok ? "checkCircle" : "alert"} className={result.ok ? "mt-0.5 h-4 w-4 text-success" : "mt-0.5 h-4 w-4 text-danger"} />
      {text}
    </div>
  );
}

type FieldState = ReturnType<typeof useField>;

function NewPasswordFields({ next, confirm }: { next: FieldState; confirm: FieldState }) {
  const { t } = useI18n();
  return (
    <>
      <Field id="pw-new" label={t("password.new")} hint={t("password.rule")}>
        <Input id="pw-new" name="password" type="password" autoComplete="new-password" required minLength={12} dir="ltr" value={next.value} onChange={next.onChange} />
      </Field>
      <Field id="pw-confirm" label={t("password.confirm")}>
        <Input id="pw-confirm" name="confirm" type="password" autoComplete="new-password" required minLength={12} dir="ltr" value={confirm.value} onChange={confirm.onChange} />
      </Field>
    </>
  );
}

/** Signed in: change my password (or choose one, after a temporary one). */
export function ChangePasswordForm({ forced, email }: { forced: boolean; email: string }) {
  const { t } = useI18n();
  const ready = useReady();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<PasswordResult | null>(null);
  const current = useField();
  const next = useField();
  const confirm = useField();

  return (
    <form
      action={(data: FormData) => {
        setResult(null);
        start(async () => {
          const r = await changeOwnPassword(data);
          setResult(r);
          if (r.ok) {
            current.clear();
            next.clear();
            confirm.clear();
          }
          /* A full navigation, not a client-side one: the server has just
             issued a new session cookie, and the admin must be rendered
             with it (a soft refresh could re-render this page instead). */
          if (r.ok && forced) window.location.assign("/admin");
        });
      }}
      className="mt-6 space-y-5"
      noValidate
    >
      {/* For password managers: which account this new password belongs to. */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <Field id="pw-current" label={forced ? t("password.temporary") : t("password.current")}>
        <Input id="pw-current" name="current" type="password" autoComplete="current-password" required dir="ltr" value={current.value} onChange={current.onChange} />
      </Field>
      <NewPasswordFields next={next} confirm={confirm} />
      <Message result={result} />
      <Button type="submit" variant="primary" block disabled={!ready} loading={pending} loadingText={t("password.saving")}>
        {forced ? t("password.chooseSubmit") : t("password.changeSubmit")}
      </Button>
    </form>
  );
}

/** Signed out: send me a link. */
export function ForgotPasswordForm() {
  const { t } = useI18n();
  const ready = useReady();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<PasswordResult | null>(null);
  const email = useField();

  return (
    <form
      action={(data: FormData) => {
        setResult(null);
        start(async () => setResult(await requestAdminPasswordReset(data)));
      }}
      className="mt-6 space-y-5"
      noValidate
    >
      <Field id="pw-email" label={t("auth.email")}>
        <Input id="pw-email" name="email" type="email" autoComplete="username" required dir="ltr" value={email.value} onChange={email.onChange} />
      </Field>
      <Message result={result} />
      <Button type="submit" variant="primary" block disabled={!ready || result?.ok === true} loading={pending} loadingText={t("password.sending")}>
        {t("password.sendLink")}
      </Button>
      <p className="text-sm">
        <Link href="/admin/login" className="text-ink-2 underline underline-offset-4 hover:text-ink">
          {t("password.backToSignIn")}
        </Link>
      </p>
    </form>
  );
}

/** From the emailed link: choose a new password. */
export function ResetPasswordForm({ token }: { token: string }) {
  const { t } = useI18n();
  const ready = useReady();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<PasswordResult | null>(null);
  const next = useField();
  const confirm = useField();

  return (
    <form
      action={(data: FormData) => {
        setResult(null);
        start(async () => {
          const r = await resetAdminPassword(data);
          setResult(r);
          if (r.ok) window.location.assign("/admin");
        });
      }}
      className="mt-6 space-y-5"
      noValidate
    >
      <input type="hidden" name="token" value={token} />
      <NewPasswordFields next={next} confirm={confirm} />
      <Message result={result} />
      <Button type="submit" variant="primary" block disabled={!ready || !token} loading={pending} loadingText={t("password.saving")}>
        {t("password.resetSubmit")}
      </Button>
      {result && !result.ok && (result.code === "password.linkExpired" || result.code === "password.linkInvalid") ? (
        <p className="text-sm">
          <Link href="/admin/forgot-password" className="text-ink-2 underline underline-offset-4 hover:text-ink">
            {t("password.askAgain")}
          </Link>
        </p>
      ) : null}
    </form>
  );
}
