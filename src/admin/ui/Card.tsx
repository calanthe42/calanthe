import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./icons";

/**
 * Surfaces.
 *
 * One card style, used sparingly: a hairline border, the barest shadow, 4px
 * corners. Hierarchy comes from type and spacing, not from stacking boxes
 * inside boxes.
 */

export function Card({
  children,
  className,
  padded = true,
  as: Element = "div",
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  as?: "div" | "section" | "article";
}) {
  return (
    <Element
      className={cn(
        "min-w-0 rounded-md border border-line bg-surface shadow-card",
        padded && "p-4 sm:p-5",
        className,
      )}
    >
      {children}
    </Element>
  );
}

/** A card's heading row: title, optional description, optional action. */
export function CardHeader({
  title,
  description,
  action,
  id,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1", className)}>
      <div className="min-w-0">
        <h2 id={id} className="text-[15px] font-semibold leading-snug text-ink">
          {title}
        </h2>
        {description ? <p className="mt-0.5 text-sm leading-relaxed text-ink-3">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

export type Trend = { direction: "up" | "down" | "flat"; label: string };

/**
 * A headline number.
 *
 * `secondary` exists so a number can explain itself — "0" alone reads as
 * breakage; "0 · all time: 0" reads as a new business.
 */
export function StatCard({
  label,
  value,
  secondary,
  trend,
  href,
  icon,
}: {
  label: string;
  value: string;
  secondary?: ReactNode;
  trend?: Trend;
  href?: string;
  icon?: IconName;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-ink-2">{label}</p>
        {icon ? (
          <span aria-hidden className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-sunken text-ink-2">
            <Icon name={icon} className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-[1.75rem] font-semibold leading-tight tracking-tight text-ink tabular">{value}</p>
      {trend ? (
        <p
          className={cn(
            "mt-1.5 flex items-center gap-1 text-xs font-medium",
            trend.direction === "up" && "text-success",
            trend.direction === "down" && "text-warning",
            trend.direction === "flat" && "text-ink-3",
          )}
        >
          <Icon
            name={trend.direction === "up" ? "trendUp" : trend.direction === "down" ? "trendDown" : "minus"}
            className="h-3.5 w-3.5"
          />
          {trend.label}
        </p>
      ) : null}
      {secondary ? <p className="mt-1 text-xs leading-relaxed text-ink-3">{secondary}</p> : null}
    </>
  );

  const classes = "block min-w-0 rounded-md border border-line bg-surface p-4 shadow-card sm:p-5";
  return href ? (
    <Link href={href} className={cn(classes, "transition-colors duration-150 hover:border-line-strong hover:bg-hover")}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}
