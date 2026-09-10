"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
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

export const secondaryButtonClass =
  "inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-md border border-hairline bg-white px-4 text-sm font-medium text-olive transition-colors hover:bg-admin-sunken";

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
    const t = setTimeout(onDismiss, 4500);
    return () => clearTimeout(t);
  }, [result, onDismiss]);

  if (!result || typeof document === "undefined") return null;

  /* Portalled to <body>: a toast raised from inside the sticky save bar
     would otherwise be positioned against that bar — its backdrop-filter
     makes it the containing block for every `fixed` element inside it. */
  return createPortal(
    <div
      role={result.ok ? "status" : "alert"}
      aria-live={result.ok ? "polite" : "assertive"}
      /* Top of the screen, below the header: the save bar lives at the
         bottom, and a toast on top of it hides the button just pressed. */
      className={cn(
        "admin-portal fixed left-1/2 top-20 z-[70] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 rounded-md border px-4 py-3 text-sm shadow-lg",
        result.ok
          ? "border-[#4a6741]/30 bg-white text-[#3d5636]"
          : "border-burgundy/30 bg-white text-burgundy",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="leading-relaxed">
          <span className="font-medium">{result.ok ? "Done. " : "Not saved. "}</span>
          {result.message}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss message"
          className="-mr-2 -mt-2 inline-flex h-10 w-10 shrink-0 items-center justify-center text-sage hover:text-olive"
        >
          <span aria-hidden>×</span>
        </button>
      </div>
    </div>,
    document.body,
  );
}

/* ---------------- Form ---------------- */

/**
 * A form bound to a server action.
 *
 * `onSuccess` receives the result, so a create can move to the new record's
 * page using the id the action returns. `disabled` renders the same fields
 * read-only for someone who may look but not change — the permission model
 * would refuse the save anyway; this just does not offer it.
 */
export function ActionForm({
  action,
  children,
  submitLabel = "Save changes",
  redirectTo,
  onSuccess,
  secondary,
  destructive,
  disabled = false,
  inline = false,
}: {
  action: (form: FormData) => Promise<ActionResult>;
  children: ReactNode;
  submitLabel?: string;
  redirectTo?: string;
  onSuccess?: (result: ActionResult) => void;
  secondary?: ReactNode;
  destructive?: ReactNode;
  disabled?: boolean;
  /** For forms inside a column rather than filling the page. */
  inline?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const router = useRouter();
  const dismiss = useRef(() => setResult(null)).current;

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (disabled) return;
          const data = new FormData(e.currentTarget);
          startTransition(async () => {
            const res = await action(data);
            setResult(res);
            if (res.ok) {
              onSuccess?.(res);
              router.refresh();
              if (redirectTo) router.push(redirectTo);
            }
          });
        }}
        className="space-y-6"
        aria-busy={pending}
      >
        {disabled ? (
          <fieldset disabled className="min-w-0 space-y-6">
            {children}
          </fieldset>
        ) : (
          children
        )}

        <div
          className={cn(
            "flex flex-wrap items-center gap-2",
            inline
              ? "rounded-md border border-hairline/70 bg-white px-4 py-3"
              : "sticky bottom-0 z-20 -mx-4 border-t border-hairline/70 bg-admin-bg/95 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur lg:-mx-8 lg:px-8",
          )}
        >
          {disabled ? null : (
            <button
              type="submit"
              disabled={pending}
              className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-md bg-burnt-orange px-5 text-sm font-medium text-cream transition-opacity disabled:opacity-60"
            >
              {pending ? "Saving…" : submitLabel}
            </button>
          )}
          {secondary}
          {destructive ? <div className="ml-auto">{destructive}</div> : null}
        </div>
      </form>

      <Toast result={result} onDismiss={dismiss} />
    </>
  );
}

function ConfirmDialog({
  message,
  label,
  onCancel,
  onConfirm,
}: {
  message: string;
  label: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const cancel = useRef(onCancel);
  cancel.current = onCancel;

  useEffect(() => {
    /* Focus the safe choice, not the destructive one. */
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancel.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* Portalled for the same reason as the toast. Rendered in place, the Delete
     button's confirmation was measured against the sticky save bar: on a
     phone it opened pinned to the bottom edge with its buttons off-screen,
     so a product could not be deleted — or the dialog dismissed — at all. */
  return createPortal(
    <div className="admin-portal fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cancel"
        tabIndex={-1}
        onClick={onCancel}
        className="absolute inset-0 bg-olive/50"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        className="relative w-full max-w-sm rounded-md border border-hairline bg-white p-6"
      >
        <p id="confirm-title" className="font-display text-xl font-light text-olive">
          Are you sure?
        </p>
        <p id="confirm-message" className="mt-2 text-sm leading-relaxed text-sage">
          {message}
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-md border border-hairline px-4 text-sm text-olive"
          >
            Keep it
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-11 rounded-md bg-burgundy px-4 text-sm font-medium text-cream"
          >
            {label}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * A button that performs a server action, with confirmation when destructive.
 *
 * Deletion asks first. Everything in this admin is a real business record;
 * an accidental click should not be able to remove one silently.
 *
 * `redirectTo` exists for deletes on a record's own page: refreshing a page
 * whose record has just been deleted shows "not found", which reads as though
 * something broke.
 */
export function ActionButton({
  action,
  label,
  pendingLabel = "Working…",
  confirm,
  variant = "secondary",
  className,
  redirectTo,
}: {
  action: () => Promise<ActionResult>;
  label: string;
  pendingLabel?: string;
  confirm?: string;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
  redirectTo?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [asking, setAsking] = useState(false);
  const router = useRouter();
  const dismiss = useRef(() => setResult(null)).current;

  function run() {
    setAsking(false);
    startTransition(async () => {
      const res = await action();
      setResult(res);
      if (res.ok) {
        if (redirectTo) router.push(redirectTo);
        else router.refresh();
      }
    });
  }

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => (confirm ? setAsking(true) : run())}
        className={cn(
          "inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-md px-4 text-sm font-medium transition-colors disabled:opacity-60",
          variant === "primary" && "bg-burnt-orange text-cream hover:bg-burnt-orange/90",
          variant === "secondary" && "border border-hairline bg-white text-olive hover:bg-admin-sunken",
          variant === "danger" && "border border-burgundy/30 bg-white text-burgundy hover:bg-burgundy/5",
          className,
        )}
      >
        {pending ? pendingLabel : label}
      </button>

      {asking && confirm ? (
        <ConfirmDialog
          message={confirm}
          label={label}
          onCancel={() => setAsking(false)}
          onConfirm={run}
        />
      ) : null}

      <Toast result={result} onDismiss={dismiss} />
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
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <fieldset className="min-w-0 rounded-md border border-hairline/70 bg-white p-4 sm:p-5">
      <legend className="px-1 font-brand text-[10px] uppercase tracking-brand text-sage">
        {legend}
      </legend>
      {hint ? <p className="mb-1 mt-1 text-xs leading-relaxed text-sage">{hint}</p> : null}
      <div className="mt-3 grid gap-4">{children}</div>
    </fieldset>
  );
}

/**
 * A collapsible group for what is optional. Closed groups still submit —
 * their inputs stay in the form — so nothing is lost by folding them away.
 */
export function OptionalSection({
  title,
  hint,
  defaultOpen = false,
  children,
}: {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group min-w-0 rounded-md border border-hairline/70 bg-white"
    >
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 sm:px-5 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="font-brand text-[10px] uppercase tracking-brand text-sage">{title}</span>
          {hint ? <span className="ml-2 text-xs text-sage/80">{hint}</span> : null}
        </span>
        <span
          aria-hidden
          className="text-lg leading-none text-sage transition-transform group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <div className="grid gap-4 border-t border-hairline/60 px-4 pb-5 pt-4 sm:px-5">{children}</div>
    </details>
  );
}

export const inputClass =
  "min-h-11 w-full rounded-md border border-hairline bg-white px-3 text-sm text-olive placeholder:text-sage/60 disabled:bg-admin-sunken disabled:text-sage";

export function Field({
  label,
  name,
  hint,
  children,
  required,
}: {
  label: string;
  name: string;
  hint?: ReactNode;
  children?: ReactNode;
  required?: boolean;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium text-olive">
        {label}
        {required ? (
          <>
            <span aria-hidden className="ml-1 text-burnt-orange">
              *
            </span>
            <span className="sr-only"> (required)</span>
          </>
        ) : null}
      </label>
      {children}
      {hint ? <p className="mt-1 text-xs leading-relaxed text-sage">{hint}</p> : null}
    </div>
  );
}

export function TextInput({
  name,
  type = "text",
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { name: string }) {
  return <input id={name} name={name} type={type} className={inputClass} {...rest} />;
}

export function TextArea({
  name,
  rows = 4,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { name: string }) {
  return (
    <textarea id={name} name={name} rows={rows} className={cn(inputClass, "py-2 leading-relaxed")} {...rest} />
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
      {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
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
    <div className="flex flex-wrap gap-x-5">
      {options.map((o) => (
        <label key={o.value} className="flex min-h-11 items-center gap-2 text-sm text-olive">
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
    <label className="flex min-h-11 items-start gap-3 py-1">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[#b55b29]"
      />
      <span>
        <span className="block text-sm font-medium text-olive">{label}</span>
        {hint ? <span className="block text-xs leading-relaxed text-sage">{hint}</span> : null}
      </span>
    </label>
  );
}
