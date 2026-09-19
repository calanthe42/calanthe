"use client";

import { cn } from "@/lib/cn";
import { fieldClasses, fieldErrorClasses, labelClasses } from "@/components/ui/form-classes";

/**
 * One field, all five states.
 *
 * The brief asked for normal / focus / error / disabled / loading on every
 * input. Focus and disabled come from `fieldClasses`; error is driven by
 * `aria-invalid` so the same attribute that styles it is the one a screen
 * reader announces; loading is `disabled` plus the form's own pending flag,
 * because a field you may not type in and a field that is waiting look the
 * same to the person using it.
 *
 * `dir="ltr"` on email, phone and password inside an Arabic page: an address
 * or a +971 number is a Latin string and reads backwards if the RTL
 * paragraph direction is allowed to reorder it. The LABEL stays RTL; only
 * the value is forced.
 */
export function AuthField({
  id,
  label,
  error,
  hint,
  className,
  type = "text",
  ...rest
}: React.ComponentPropsWithoutRef<"input"> & {
  id: string;
  label: string;
  error?: string;
  hint?: string;
}) {
  const latin = type === "email" || type === "password" || type === "tel";
  return (
    <div className={className}>
      <label htmlFor={id} className={labelClasses}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        dir={latin ? "ltr" : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={cn(fieldClasses, latin && "text-start")}
        {...rest}
      />
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-2 text-xs leading-relaxed text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className={fieldErrorClasses}>
          <span aria-hidden className="text-burnt-orange">
            ·
          </span>
          {error}
        </p>
      )}
    </div>
  );
}
