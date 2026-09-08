import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

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
    <header className="mb-8">
      {breadcrumb && breadcrumb.length > 0 ? (
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex flex-wrap items-center gap-1.5 text-xs text-sage">
            {breadcrumb.map((crumb, i) => (
              <li key={crumb.label} className="flex items-center gap-1.5">
                {i > 0 ? <span aria-hidden>/</span> : null}
                {crumb.href ? (
                  <Link href={crumb.href} className="hover:text-olive hover:underline">
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
        <div>
          <h1 className="font-display text-3xl font-light text-olive lg:text-4xl">{title}</h1>
          {description ? (
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-sage">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
    </header>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-md border border-hairline/70 bg-white p-5 shadow-[0_1px_2px_rgba(43,47,27,0.04)]",
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
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <p className="font-brand text-[10px] uppercase tracking-brand text-sage">{label}</p>
      <p className="mt-2 font-display text-3xl font-light text-olive tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs leading-relaxed text-sage">{hint}</p> : null}
    </Card>
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
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-hairline bg-white/60 px-6 py-14 text-center">
      <p className="font-display text-xl font-light text-olive">{title}</p>
      <p className="max-w-sm text-sm leading-relaxed text-sage">{message}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/**
 * A screen that exists in the navigation but has no interface yet.
 *
 * Named honestly rather than dressed up as a finished page: a placeholder
 * pretending to be a feature is how a client discovers at launch that it was
 * never built.
 */
export function ComingSoon({ area, note }: { area: string; note?: string }) {
  return (
    <EmptyState
      title={`${area} is not built yet`}
      message={
        note ??
        `The data behind ${area.toLowerCase()} already exists in the system. This screen is the next piece of work — nothing here is lost or hidden.`
      }
      action={
        <Link
          href="/cms"
          className="text-xs text-sage underline underline-offset-4 hover:text-olive"
        >
          Manage it in the CMS meanwhile
        </Link>
      }
    />
  );
}

/* ---------------- Status ---------------- */

type Tone = "neutral" | "progress" | "done" | "halt";

const TONE: Record<Tone, string> = {
  neutral: "bg-olive/10 text-olive",
  progress: "bg-burnt-orange/12 text-burnt-orange",
  done: "bg-[#4a6741]/12 text-[#3d5636]",
  halt: "bg-burgundy/10 text-burgundy",
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
  PENDING: "neutral",
  AUTHORIZED: "progress",
  PAID: "done",
  FAILED: "halt",
  REFUNDED: "halt",
  PARTIALLY_REFUNDED: "halt",
};

/** SCREAMING_SNAKE is a database value, not something to show a florist. */
export function humanStatus(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .join(" ")
    .replace(/^./, (c) => c.toUpperCase());
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

  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-sm px-2 py-0.5 text-[11px] font-medium",
        TONE[tone],
      )}
    >
      {humanStatus(value)}
    </span>
  );
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
        "inline-flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors duration-150",
        variant === "primary"
          ? "bg-burnt-orange text-cream hover:bg-burnt-orange/90"
          : "border border-hairline bg-white text-olive hover:bg-admin-sunken",
      )}
    >
      {children}
    </Link>
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
      <table className="w-full min-w-[640px] border-collapse text-sm">
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
