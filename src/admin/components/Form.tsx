"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { ActionResult } from "@backend/actions/admin";

/**
 * The admin's form plumbing: submit, feedback, pending state.
 *
 * One component owns the whole cycle so that no screen can forget half of it.
 * A save that silently does nothing is the single most common way an admin
 * loses a business owner's trust — she cannot tell whether the change took,
 * so she does it again, or worse, assumes it worked.
 */

/* ---------------- Toast ---------------- */

export function Toast({
  result,
  onDismiss,
}: {
  result: ActionResult | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!result?.ok) return;
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [result, onDismiss]);

  if (!result) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed bottom-5 left-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 rounded-md border px-4 py-3 text-sm shadow-lg",
        result.ok
          ? "border-[#4a6741]/30 bg-white text-olive"
          : "border-burgundy/30 bg-white text-burgundy",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="leading-relaxed">{result.message}</p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-mr-1 -mt-1 h-8 w-8 shrink-0 text-sage hover:text-olive"
        >
          <span aria-hidden>×</span>
        </button>
      </div>
    </div>
  );
}

/* ---------------- Form ---------------- */

/**
 * A form bound to a server action.
 *
 * `redirectTo` covers the create case: after a new product is saved there is
 * nothing useful left on the page, so the person is moved to the list rather
 * than left staring at a form they have already submitted.
 */
export function ActionForm({
  action,
  children,
  submitLabel = "Save changes",
  redirectTo,
  onSuccess,
  destructive,
}: {
  action: (form: FormData) => Promise<ActionResult>;
  children: ReactNode;
  submitLabel?: string;
  redirectTo?: string;
  onSuccess?: () => void;
  destructive?: ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          startTransition(async () => {
            const res = await action(data);
            setResult(res);
            if (res.ok) {
              onSuccess?.();
              router.refresh();
              if (redirectTo) router.push(redirectTo);
            }
          });
        }}
        className="space-y-8"
      >
        {children}

        <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-hairline/70 bg-admin-bg/95 px-4 py-4 backdrop-blur lg:-mx-8 lg:px-8">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-burnt-orange px-5 text-sm font-medium text-cream transition-opacity disabled:opacity-60"
          >
            {pending ? "Saving…" : submitLabel}
          </button>
          {pending ? (
            <span aria-live="polite" className="text-xs text-sage">
              Saving your changes…
            </span>
          ) : null}
          <div className="ml-auto">{destructive}</div>
        </div>
      </form>

      <Toast result={result} onDismiss={() => setResult(null)} />
    </>
  );
}

/**
 * A button that performs a server action, with confirmation when destructive.
 *
 * Deletion asks first. Everything in this admin is a real business record;
 * an accidental click should not be able to remove one silently.
 */
export function ActionButton({
  action,
  label,
  pendingLabel = "Working…",
  confirm,
  variant = "secondary",
  className,
}: {
  action: () => Promise<ActionResult>;
  label: string;
  pendingLabel?: string;
  confirm?: string;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [asking, setAsking] = useState(false);
  const router = useRouter();

  function run() {
    setAsking(false);
    startTransition(async () => {
      const res = await action();
      setResult(res);
      if (res.ok) router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => (confirm ? setAsking(true) : run())}
        className={cn(
          "inline-flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors disabled:opacity-60",
          variant === "primary" && "bg-burnt-orange text-cream hover:bg-burnt-orange/90",
          variant === "secondary" && "border border-hairline bg-white text-olive hover:bg-admin-sunken",
          variant === "danger" && "border border-burgundy/30 bg-white text-burgundy hover:bg-burgundy/5",
          className,
        )}
      >
        {pending ? pendingLabel : label}
      </button>

      {asking ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Cancel"
            onClick={() => setAsking(false)}
            className="absolute inset-0 bg-olive/50"
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            className="relative w-full max-w-sm rounded-md border border-hairline bg-white p-6"
          >
            <p id="confirm-title" className="font-display text-lg font-light text-olive">
              Are you sure?
            </p>
            <p className="mt-2 text-sm leading-relaxed text-sage">{confirm}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAsking(false)}
                className="min-h-11 rounded-md border border-hairline px-4 text-sm text-olive"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={run}
                className="min-h-11 rounded-md bg-burgundy px-4 text-sm font-medium text-cream"
              >
                {label}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <Toast result={result} onDismiss={() => setResult(null)} />
    </>
  );
}

/* ---------------- Fields ---------------- */

export function Fieldset({
  legend,
  hint,
  children,
}: {
  legend: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="rounded-md border border-hairline/70 bg-white p-5">
      <legend className="px-1 font-brand text-[10px] uppercase tracking-brand text-sage">
        {legend}
      </legend>
      {hint ? <p className="mb-4 mt-1 text-xs leading-relaxed text-sage">{hint}</p> : null}
      <div className="mt-3 grid gap-4">{children}</div>
    </fieldset>
  );
}

const inputClass =
  "min-h-11 w-full rounded-md border border-hairline bg-white px-3 text-sm text-olive placeholder:text-sage/60";

export function Field({
  label,
  name,
  hint,
  children,
  required,
}: {
  label: string;
  name: string;
  hint?: string;
  children?: ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium text-olive">
        {label}
        {required ? <span className="ml-1 text-burnt-orange">*</span> : null}
      </label>
      {children}
      {hint ? <p className="mt-1 text-xs leading-relaxed text-sage">{hint}</p> : null}
    </div>
  );
}

export function TextInput({
  name,
  defaultValue,
  placeholder,
  required,
  type = "text",
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { name: string }) {
  return (
    <input
      id={name}
      name={name}
      type={type}
      defaultValue={defaultValue}
      placeholder={placeholder}
      required={required}
      className={inputClass}
      {...rest}
    />
  );
}

export function TextArea({
  name,
  defaultValue,
  rows = 4,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { name: string }) {
  return (
    <textarea
      id={name}
      name={name}
      rows={rows}
      defaultValue={defaultValue}
      className={cn(inputClass, "py-2")}
      {...rest}
    />
  );
}

export function Select({
  name,
  options,
  defaultValue,
  placeholder,
}: {
  name: string;
  options: readonly { label: string; value: string }[];
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <select id={name} name={name} defaultValue={defaultValue} className={inputClass}>
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Checkbox group that posts repeated values under one name. */
export function CheckboxGroup({
  name,
  options,
  defaultValues = [],
}: {
  name: string;
  options: readonly { label: string; value: string }[];
  defaultValues?: readonly string[];
}) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2">
      {options.map((o) => (
        <label key={o.value} className="flex items-center gap-2 text-sm text-olive">
          <input
            type="checkbox"
            name={name}
            value={o.value}
            defaultChecked={defaultValues.includes(o.value)}
            className="h-4 w-4 accent-[#b55b29]"
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}

export function Toggle({
  name,
  label,
  hint,
  defaultChecked,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-start gap-3">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 h-4 w-4 accent-[#b55b29]"
      />
      <span>
        <span className="block text-sm font-medium text-olive">{label}</span>
        {hint ? <span className="block text-xs leading-relaxed text-sage">{hint}</span> : null}
      </span>
    </label>
  );
}
