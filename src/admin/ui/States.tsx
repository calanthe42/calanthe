import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./Button";
import { Icon, type IconName } from "./icons";

/**
 * Empty, loading and error states — the three moments an admin most often
 * looks broken when it is not.
 *
 * An empty state always says why it is empty and what to do next. A loading
 * state has the shape of what is coming, so nothing jumps when it lands. An
 * error state says plainly that nothing was lost.
 */

export function EmptyState({
  icon = "box",
  title,
  body,
  action,
  variant = "card",
  className,
}: {
  icon?: IconName;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  /** "card" stands alone on a page; "plain" sits inside an existing card. */
  variant?: "card" | "plain";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center text-center",
        variant === "card"
          ? "rounded-md border border-dashed border-line-strong bg-surface/70 px-6 py-12"
          : "px-4 py-8",
        className,
      )}
    >
      <span aria-hidden className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-sunken text-ink-3">
        <Icon name={icon} />
      </span>
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {body ? <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-3">{body}</p> : null}
      {action ? <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-sunken", className)} />;
}

/**
 * A screen-shaped placeholder while data is read.
 *
 * `label` is announced once to assistive technology; the shapes are hidden
 * from it.
 */
export function LoadingState({
  label,
  shape = "list",
}: {
  label: string;
  shape?: "list" | "form" | "dashboard" | "inline";
}) {
  if (shape === "inline") {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-ink-3">
        <Spinner />
        {label}
      </p>
    );
  }

  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      <Skeleton className="mb-2 h-3 w-32" />
      <Skeleton className="mb-8 h-9 w-64 max-w-full" />
      {shape === "dashboard" ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <Skeleton className="h-72 lg:col-span-2" />
            <Skeleton className="h-72" />
          </div>
        </>
      ) : shape === "form" ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-48" />
          </div>
          <Skeleton className="h-80" />
        </div>
      ) : (
        <>
          <Skeleton className="mb-4 h-16" />
          <div className="overflow-hidden rounded-md border border-line bg-surface">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4 border-t border-line px-4 py-4 first:border-t-0">
                <Skeleton className="h-12 w-12 shrink-0" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-1/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function ErrorState({
  title,
  body,
  reference,
  actions,
}: {
  title: string;
  body: string;
  reference?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-md border border-danger/25 bg-surface px-6 py-14 text-center shadow-card">
      <span aria-hidden className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-danger/10 text-danger">
        <Icon name="alert" />
      </span>
      <p className="text-lg font-semibold text-ink">{title}</p>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-3">{body}</p>
      {actions ? <div className="mt-6 flex flex-wrap justify-center gap-2">{actions}</div> : null}
      {reference ? <p className="mt-5 text-xs text-ink-3 tabular">{reference}</p> : null}
    </div>
  );
}

/** A note at the top of a screen: success after a redirect, or context. */
export function Notice({
  tone = "info",
  children,
  className,
}: {
  tone?: "info" | "success" | "warning" | "danger";
  children: ReactNode;
  className?: string;
}) {
  const icon: IconName = tone === "success" ? "checkCircle" : tone === "info" ? "info" : "alert";
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "mb-5 flex items-start gap-3 rounded-md border px-4 py-3 text-sm leading-relaxed",
        tone === "info" && "border-line bg-surface text-ink-2",
        tone === "success" && "border-success/30 bg-success/[0.08] text-ink",
        tone === "warning" && "border-warning/30 bg-warning/[0.08] text-ink",
        tone === "danger" && "border-danger/30 bg-danger/[0.08] text-ink",
        className,
      )}
    >
      <Icon
        name={icon}
        className={cn(
          "mt-0.5 h-4 w-4",
          tone === "success" && "text-success",
          tone === "warning" && "text-warning",
          tone === "danger" && "text-danger",
          tone === "info" && "text-ink-3",
        )}
      />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
