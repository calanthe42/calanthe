"use client";

import Link from "next/link";
import { fieldErrorClasses } from "@/components/ui/form-classes";
import { useT } from "@/lib/locale";

const LINK =
  "underline decoration-hairline underline-offset-4 transition-colors duration-200 ease-bloom hover:decoration-burnt-orange";

/**
 * "I agree to the Terms and the Privacy Policy" — required to create an
 * account, and the moment it is ticked is kept (Users.termsAcceptedAt).
 *
 * The two documents open in a new tab: reading them must not throw away a
 * half-filled form. The sentence is the dictionary's; {terms} and {privacy}
 * mark where the links sit, so Arabic word order is its own.
 */
export function TermsCheckbox({ id, error, disabled }: { id: string; error?: string; disabled?: boolean }) {
  const t = useT();
  const [before, rest = ""] = t.account.termsAgree.split("{terms}");
  const [middle, after = ""] = rest.split("{privacy}");

  return (
    <div>
      <label htmlFor={id} className="flex min-h-11 cursor-pointer items-start gap-3 text-base leading-relaxed text-olive">
        <input
          id={id}
          name="terms"
          type="checkbox"
          required
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-olive"
        />
        <span>
          {before}
          <Link href="/terms" target="_blank" rel="noopener" className={LINK}>
            {t.account.termsLink}
          </Link>
          {middle}
          <Link href="/privacy" target="_blank" rel="noopener" className={LINK}>
            {t.account.privacyLink}
          </Link>
          {after}
        </span>
      </label>
      {error ? (
        <p id={`${id}-error`} role="alert" className={fieldErrorClasses}>
          <span aria-hidden className="text-burnt-orange">
            ·
          </span>
          {error}
        </p>
      ) : null}
    </div>
  );
}
