import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { servedMediaPath } from "@backend/domain/media-option";

/**
 * The admin's small vocabulary of shared pieces.
 *
 * Kept deliberately short. Every component here earns its place by appearing
 * on three or more screens; anything used once stays inline where it is read.
 */

/* ---------------- Page furniture ---------------- */

export function PageHeader({
  title,
  breadcrumb,
  description,
  action,
}: {
  title: string;
  breadcrumb?: { label: string; href?: string }[];
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 lg:mb-8">
      {breadcrumb && breadcrumb.length > 0 ? (
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex flex-wrap items-center gap-1.5 text-xs text-sage">
            {breadcrumb.map((crumb, i) => (
              <li key={`${crumb.label}-${i}`} className="flex items-center gap-1.5">
                {i > 0 ? <span aria-hidden>/</span> : null}
                {crumb.href ? (
                  /* -my/py: a 44px-tall target that takes no extra room
                     in the row — breadcrumbs are small text, not small targets. */
                  <Link href={crumb.href} className="-my-3.5 inline-block py-3.5 hover:text-olive hover:underline">
                    {crumb.label}
                  </Link>
                ) : (
                  <span>{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="break-words font-display text-[1.75rem] font-light leading-tight text-olive sm:text-3xl lg:text-4xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-sage">{description}</p>
          ) : null}
        </div>
        {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
      </div>
    </header>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-md border border-hairline/70 bg-white p-4 shadow-[0_1px_2px_rgba(43,47,27,0.04)] sm:p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * A headline number.
 *
 * `hint` exists so a zero can explain itself. "0 orders" alone reads as
 * breakage; "0 — your first order will appear here" reads as a new business.
 */
export function StatCard({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  href?: string;
}) {
  const body = (
    <>
      <p className="font-brand text-[10px] uppercase tracking-brand text-sage">{label}</p>
      {/* Lining figures: Cormorant's old-style numerals make 1 read as I and 0 as o. */}
      <p className="mt-2 font-display text-3xl font-light tabular-nums lining-nums text-olive">{value}</p>
      {hint ? <p className="mt-1 text-xs leading-relaxed text-sage">{hint}</p> : null}
    </>
  );
  return href ? (
    <Link
      href={href}
      className="block min-w-0 rounded-md border border-hairline/70 bg-white p-4 shadow-[0_1px_2px_rgba(43,47,27,0.04)] transition-colors hover:border-sage sm:p-5"
    >
      {body}
    </Link>
  ) : (
    <Card>{body}</Card>
  );
}

/** A plain confirmation or note at the top of a screen. */
export function Banner({
  tone = "success",
  children,
}: {
  tone?: "success" | "info" | "warning";
  children: ReactNode;
}) {
  return (
    <div
      role="status"
      className={cn(
        "mb-6 rounded-md border px-4 py-3 text-sm leading-relaxed",
        tone === "success" && "border-[#4a6741]/30 bg-[#4a6741]/[0.06] text-[#3d5636]",
        tone === "info" && "border-hairline bg-admin-sunken text-olive",
        tone === "warning" && "border-burnt-orange/30 bg-burnt-orange/[0.06] text-olive",
      )}
    >
      {children}
    </div>
  );
}

/* ---------------- Empty states ---------------- */

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-hairline bg-white/60 px-6 py-12 text-center">
      <p className="font-display text-xl font-light text-olive">{title}</p>
      <p className="max-w-sm text-sm leading-relaxed text-sage">{message}</p>
      {action ? <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

/**
 * A screen that exists in the navigation but has no interface yet.
 *
 * Named honestly rather than dressed up as a finished page: a placeholder
 * pretending to be a feature is how a client discovers at launch that it was
 * never built.
 *
 * It used to offer "Manage it in the CMS meanwhile". It no longer does: the
 * business never needs to know the developer CMS exists, and a link to it
 * from a business screen is exactly how she would find out.
 */
export function ComingSoon({ area, note }: { area: string; note?: string }) {
  return (
    <EmptyState
      title={`${area} is coming soon`}
      message={
        note ??
        `This screen has not been built yet. Nothing is lost — anything recorded for ${area.toLowerCase()} is kept safely and will appear here when it is ready.`
      }
    />
  );
}

/* ---------------- Status ---------------- */

export type Tone = "neutral" | "progress" | "done" | "halt" | "attention";

const TONE: Record<Tone, string> = {
  neutral: "bg-olive/10 text-olive",
  progress: "bg-burnt-orange/12 text-burnt-orange",
  done: "bg-[#4a6741]/12 text-[#3d5636]",
  halt: "bg-burgundy/10 text-burgundy",
  attention: "bg-burnt-orange/12 text-[#8f4620]",
};

const FULFILMENT_TONE: Record<string, Tone> = {
  NEW: "neutral",
  CONFIRMED: "neutral",
  PREPARING: "progress",
  READY: "progress",
  OUT_FOR_DELIVERY: "progress",
  DELIVERED: "done",
  CANCELLED: "halt",
};

const PAYMENT_TONE: Record<string, Tone> = {
  PENDING: "attention",
  AUTHORIZED: "progress",
  PAID: "done",
  FAILED: "halt",
  REFUNDED: "halt",
  PARTIALLY_REFUNDED: "halt",
};

/* What a florist would say, not what the database stores. */
const FULFILMENT_LABEL: Record<string, string> = {
  NEW: "New",
  CONFIRMED: "Confirmed",
  PREPARING: "Being prepared",
  READY: "Ready to go",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

const PAYMENT_LABEL: Record<string, string> = {
  PENDING: "Awaiting payment",
  AUTHORIZED: "Authorised",
  PAID: "Paid",
  FAILED: "Payment failed",
  REFUNDED: "Refunded",
  PARTIALLY_REFUNDED: "Partly refunded",
};

/** SCREAMING_SNAKE is a database value, not something to show a florist. */
export function humanStatus(value: string): string {
  return value
    .toLowerCase()
    .split(/[_-]/)
    .join(" ")
    .replace(/^./, (c) => c.toUpperCase());
}

export function statusLabel(
  value: string,
  kind: "fulfilment" | "payment" | "plain" = "fulfilment",
): string {
  if (kind === "fulfilment") return FULFILMENT_LABEL[value] ?? humanStatus(value);
  if (kind === "payment") return PAYMENT_LABEL[value] ?? humanStatus(value);
  return humanStatus(value);
}

export function Pill({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-sm px-2 py-0.5 text-[11px] font-medium",
        TONE[tone],
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({
  value,
  kind = "fulfilment",
}: {
  value: string;
  kind?: "fulfilment" | "payment" | "plain";
}) {
  const tone: Tone =
    kind === "payment"
      ? (PAYMENT_TONE[value] ?? "neutral")
      : kind === "fulfilment"
        ? (FULFILMENT_TONE[value] ?? "neutral")
        : "neutral";

  return <Pill tone={tone}>{statusLabel(value, kind)}</Pill>;
}

/* ---------------- Business language ---------------- */

const EMIRATE: Record<string, string> = {
  "abu-dhabi": "Abu Dhabi",
  dubai: "Dubai",
  sharjah: "Sharjah",
  ajman: "Ajman",
  "umm-al-quwain": "Umm Al Quwain",
  "ras-al-khaimah": "Ras Al Khaimah",
  fujairah: "Fujairah",
};

export const emirateLabel = (value?: string | null): string =>
  value ? (EMIRATE[value] ?? humanStatus(value)) : "";

export function orderSourceLabel(source?: string | null): string {
  if (!source) return "Not recorded";
  if (/cod/i.test(source)) return "Cash on delivery";
  if (/checkout/i.test(source)) return "Website checkout";
  return humanStatus(source);
}

const EVENT_TYPE: Record<string, string> = {
  wedding: "Wedding",
  corporate: "Corporate event",
  birthday: "Birthday",
  engagement: "Engagement",
  private: "Private event",
  decoration: "Event decoration",
  "large-order": "Large or custom order",
  other: "Other",
};

export const eventTypeLabel = (value?: string | null): string =>
  value ? (EVENT_TYPE[value] ?? humanStatus(value)) : "";

/** A date as the business reads it: in the UAE, whatever the server's clock. */
export function uaeDate(
  iso: string | null | undefined,
  style: "short" | "long" | "weekday" | "datetime" = "short",
): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const options: Intl.DateTimeFormatOptions =
    style === "short"
      ? { day: "numeric", month: "short" }
      : style === "long"
        ? { day: "numeric", month: "long", year: "numeric" }
        : style === "weekday"
          ? { weekday: "short", day: "numeric", month: "short" }
          : { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" };
  return date.toLocaleString("en-AE", { ...options, timeZone: "Asia/Dubai" });
}

/* ---------------- Actions ---------------- */

export function ActionLink({
  href,
  children,
  variant = "secondary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-md px-4 text-sm font-medium transition-colors duration-150",
        variant === "primary"
          ? "bg-burnt-orange text-cream hover:bg-burnt-orange/90"
          : "border border-hairline bg-white text-olive hover:bg-admin-sunken",
      )}
    >
      {children}
    </Link>
  );
}

/**
 * The action on a list row — "Edit", "Open", "View".
 *
 * Always visible, always a real button-sized target, never hidden behind a
 * hover or an overflow menu. The most common complaint about an admin is not
 * knowing how to change something; the answer should be sitting on the row.
 */
export function RowAction({
  href,
  children,
  variant = "secondary",
  external = false,
  label,
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
  external?: boolean;
  /** Distinct accessible name, e.g. "Edit Amber Hour", when the visible text repeats. */
  label?: string;
}) {
  const className = cn(
    "inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-md px-4 text-sm font-medium transition-colors duration-150",
    variant === "primary"
      ? "bg-olive text-cream hover:bg-olive/90"
      : "border border-hairline bg-white text-olive hover:bg-admin-sunken",
  );
  return external ? (
    <a href={href} target="_blank" rel="noreferrer" aria-label={label} className={className}>
      {children}
    </a>
  ) : (
    <Link href={href} aria-label={label} className={className}>
      {children}
    </Link>
  );
}

/* ---------------- Lists ---------------- */

/**
 * Records as rows that reflow, rather than tables that scroll.
 *
 * A seven-column table on a 390px phone scrolls sideways, and the Edit button
 * at the far right is exactly the part that ends up off-screen. A row wraps
 * its details instead, and its actions are always on screen.
 */
export function DataList({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ul
      aria-label={label}
      className="divide-y divide-hairline/60 overflow-hidden rounded-md border border-hairline/70 bg-white"
    >
      {children}
    </ul>
  );
}

export function DataRow({
  leading,
  title,
  subtitle,
  meta,
  actions,
}: {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
      <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
        {leading}
        <div className="min-w-0 flex-1">
          {/* Vertical padding on the inline title link widens its target without
              moving the text; the row's own Edit/Open button remains the main one. */}
          <div className="break-words text-[15px] font-medium leading-snug text-olive [&_a]:py-3">{title}</div>
          {subtitle ? (
            <div className="mt-0.5 break-words text-xs leading-relaxed text-sage">{subtitle}</div>
          ) : null}
          {meta ? (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-sage">
              {meta}
            </div>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">{actions}</div> : null}
    </li>
  );
}

export function Thumb({
  src,
  alt,
  shape = "portrait",
}: {
  src?: string | null;
  alt?: string | null;
  shape?: "portrait" | "square";
}) {
  const path = servedMediaPath(src);
  return (
    <span
      className={cn(
        "relative block shrink-0 overflow-hidden rounded-md bg-admin-sunken",
        shape === "portrait" ? "h-16 w-[3.25rem]" : "h-14 w-14",
      )}
    >
      {path ? (
        <Image src={path} alt={alt ?? ""} fill sizes="56px" className="object-cover" />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center px-1 text-center text-[9px] leading-tight text-sage">
          No photo
        </span>
      )}
    </span>
  );
}

/** A definition list that simply leaves out what was never filled in. */
export function DetailList({ rows }: { rows: [string, ReactNode | null | undefined][] }) {
  const present = rows.filter(([, value]) => value !== null && value !== undefined && value !== "");
  if (present.length === 0) return <p className="text-sm text-sage">Nothing was provided.</p>;
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {present.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs text-sage">{label}</dt>
          <dd className="mt-0.5 whitespace-pre-line break-words text-sm text-olive">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ---------------- Filters ---------------- */

export const filterInputClass =
  "min-h-11 w-full rounded-md border border-hairline bg-white px-3 text-sm text-olive placeholder:text-sage/60";

/**
 * A filter bar that is a plain GET form: it works before JavaScript loads,
 * the URL can be bookmarked, and the back button undoes a filter.
 */
export function FilterBar({
  action,
  active,
  children,
}: {
  action: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <form
      action={action}
      role="search"
      className="mb-5 rounded-md border border-hairline/70 bg-white p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] lg:items-end">
        {children}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="submit"
          className="inline-flex min-h-11 items-center rounded-md bg-olive px-5 text-sm font-medium text-cream hover:bg-olive/90"
        >
          Apply filters
        </button>
        {active ? (
          <Link
            href={action}
            className="inline-flex min-h-11 items-center rounded-md px-3 text-sm text-sage underline underline-offset-4 hover:text-olive"
          >
            Clear filters
          </Link>
        ) : null}
      </div>
    </form>
  );
}

export function FilterField({
  label,
  name,
  children,
  wide = false,
}: {
  label: string;
  name: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={cn("min-w-0", wide && "sm:col-span-2")}>
      <label htmlFor={name} className="mb-1.5 block text-xs font-medium text-olive">
        {label}
      </label>
      {children}
    </div>
  );
}

export function FilterSelect({
  name,
  value,
  options,
  anyLabel = "Any",
}: {
  name: string;
  value: string;
  options: readonly { value: string; label: string }[];
  anyLabel?: string | null;
}) {
  return (
    <select id={name} name={name} defaultValue={value} className={filterInputClass}>
      {anyLabel !== null ? <option value="">{anyLabel}</option> : null}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/* ---------------- Tables ---------------- */

export function Table({
  head,
  children,
}: {
  head: readonly string[];
  children: ReactNode;
}) {
  return (
    <div className="admin-scroll-x rounded-md border border-hairline/70 bg-white">
      <table className="w-full min-w-[520px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-hairline/70">
            {head.map((cell) => (
              <th
                key={cell}
                scope="col"
                className="px-4 py-3 text-left font-brand text-[10px] uppercase tracking-brand text-sage"
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 align-middle text-olive", className)}>{children}</td>;
}
