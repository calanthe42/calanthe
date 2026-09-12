import type { ComponentPropsWithRef, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icons";

/**
 * Form fields.
 *
 * Every input has a visible label, and its hint and error are wired to it with
 * aria-describedby, so a screen reader reads "Price, required, What the
 * customer pays" rather than just "edit text".
 *
 * 16px text on phones: iOS zooms the whole page when a smaller input is
 * focused, which throws the layout sideways mid-edit. From `sm` up it drops to
 * the admin's 14px.
 *
 * Server-renderable (no hooks). Client forms use them the same way.
 */

export const fieldClasses =
  "block w-full min-h-11 rounded-md border border-line-strong bg-field px-3 text-base text-ink placeholder:text-ink-3/80 transition-colors duration-150 hover:border-ink-3 disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-3 aria-[invalid=true]:border-danger sm:text-sm";

function describedBy(id: string, withHint?: boolean, invalid?: boolean): string | undefined {
  return [withHint ? `${id}-hint` : "", invalid ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
}

export function Field({
  id,
  label,
  hint,
  error,
  required,
  aside,
  children,
  className,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  /** A note at the end of the label row, e.g. a character counter. */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
          {required ? (
            <span aria-hidden className="ms-0.5 text-accent">
              *
            </span>
          ) : null}
        </label>
        {aside ? <span className="shrink-0 text-xs text-ink-3 tabular">{aside}</span> : null}
      </div>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs leading-relaxed text-ink-3">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed text-danger">
          <Icon name="alert" className="mt-px h-3.5 w-3.5" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

type FieldWiring = { id: string; withHint?: boolean; invalid?: boolean };

export function Input({
  id,
  withHint,
  invalid,
  className,
  type = "text",
  ...rest
}: FieldWiring & ComponentPropsWithRef<"input">) {
  return (
    <input
      id={id}
      type={type}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy(id, withHint, invalid)}
      className={cn(fieldClasses, className)}
      {...rest}
    />
  );
}

export function Textarea({
  id,
  withHint,
  invalid,
  className,
  rows = 4,
  ...rest
}: FieldWiring & ComponentPropsWithRef<"textarea">) {
  return (
    <textarea
      id={id}
      rows={rows}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy(id, withHint, invalid)}
      className={cn(fieldClasses, "py-2.5 leading-relaxed", className)}
      {...rest}
    />
  );
}

export type SelectOption = { value: string; label: string };

export function Select({
  id,
  withHint,
  invalid,
  options,
  placeholder,
  className,
  ...rest
}: FieldWiring &
  Omit<ComponentPropsWithRef<"select">, "children"> & {
    options: readonly SelectOption[];
    /** An empty first option, e.g. "All categories". */
    placeholder?: string;
  }) {
  return (
    <div className="relative min-w-0">
      <select
        id={id}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy(id, withHint, invalid)}
        className={cn(fieldClasses, "cursor-pointer appearance-none pe-9", className)}
        {...rest}
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Icon
        name="chevronDown"
        className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
      />
    </div>
  );
}

export function SearchInput({
  id,
  className,
  ...rest
}: { id: string } & Omit<ComponentPropsWithRef<"input">, "type">) {
  return (
    <div className="relative min-w-0">
      <Icon
        name="search"
        className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
      />
      <input id={id} type="search" className={cn(fieldClasses, "ps-9", className)} {...rest} />
    </div>
  );
}

/** An input with a fixed prefix inside the border: "AED", "/product/". */
export function PrefixInput({
  id,
  prefix,
  withHint,
  invalid,
  ltr = false,
  className,
  ...rest
}: FieldWiring &
  ComponentPropsWithRef<"input"> & {
    prefix: string;
    /** Web addresses read left to right in every language. */
    ltr?: boolean;
  }) {
  return (
    <div
      dir={ltr ? "ltr" : undefined}
      className={cn(
        "flex min-h-11 min-w-0 overflow-hidden rounded-md border border-line-strong bg-field transition-colors duration-150 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus hover:border-ink-3 has-[:disabled]:bg-sunken",
        invalid && "border-danger",
      )}
    >
      <span aria-hidden className="flex shrink-0 items-center border-e border-line bg-sunken px-3 text-xs text-ink-3">
        {prefix}
      </span>
      <input
        id={id}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy(id, withHint, invalid)}
        className={cn(
          "min-w-0 flex-1 bg-transparent px-3 text-base text-ink placeholder:text-ink-3/80 focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed disabled:text-ink-3 sm:text-sm",
          className,
        )}
        {...rest}
      />
    </div>
  );
}

export function Checkbox({
  label,
  hint,
  className,
  ...rest
}: Omit<ComponentPropsWithRef<"input">, "type"> & { label: ReactNode; hint?: ReactNode }) {
  return (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-start gap-3 py-2.5 has-[:disabled]:cursor-not-allowed",
        className,
      )}
    >
      <input
        type="checkbox"
        className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer accent-accent disabled:cursor-not-allowed"
        {...rest}
      />
      <span className="min-w-0">
        <span className="block text-sm text-ink">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs leading-relaxed text-ink-3">{hint}</span> : null}
      </span>
    </label>
  );
}

/**
 * An on/off setting.
 *
 * A native checkbox underneath with role="switch": it posts with the form,
 * Space toggles it, and a screen reader announces "on" or "off". The track is
 * decoration drawn beside it.
 */
export function Switch({
  label,
  hint,
  hintTone = "muted",
  className,
  ...rest
}: Omit<ComponentPropsWithRef<"input">, "type" | "role"> & {
  label: ReactNode;
  hint?: ReactNode;
  hintTone?: "muted" | "warning";
}) {
  return (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-center justify-between gap-4 py-2 has-[:disabled]:cursor-not-allowed",
        className,
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {hint ? (
          <span
            className={cn("mt-0.5 block text-xs leading-relaxed", hintTone === "warning" ? "text-warning" : "text-ink-3")}
          >
            {hint}
          </span>
        ) : null}
      </span>
      <span className="relative inline-flex h-6 w-10 shrink-0">
        <input
          type="checkbox"
          role="switch"
          className="peer absolute inset-0 z-10 m-0 h-full w-full cursor-[inherit] opacity-0"
          {...rest}
        />
        <span
          aria-hidden
          className="absolute inset-0 rounded-full bg-line-strong transition-colors duration-150 peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus peer-disabled:opacity-50"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute start-0.5 top-0.5 h-5 w-5 rounded-full bg-knob shadow-card transition-transform duration-150 peer-checked:translate-x-4 peer-checked:bg-on-accent rtl:peer-checked:-translate-x-4"
        />
      </span>
    </label>
  );
}
