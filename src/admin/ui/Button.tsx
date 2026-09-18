import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./icons";

/**
 * Buttons and button-shaped links.
 *
 * One primary (burnt orange) action per screen; everything else is secondary
 * or ghost. Every size is at least 44px tall on a phone — "sm" only tightens
 * to 36px from the `sm` breakpoint, where a mouse is the likely pointer.
 *
 * Server-renderable: no hooks, so a page can use them without becoming a
 * client component.
 */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "dangerSolid";
export type ButtonSize = "md" | "sm";

const BASE =
  "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

const SIZE: Record<ButtonSize, string> = {
  md: "min-h-11 px-4",
  sm: "min-h-11 px-3 sm:min-h-9",
};

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent shadow-card hover:bg-accent-hover",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-hover",
  ghost: "text-ink-2 hover:bg-hover hover:text-ink",
  danger: "border border-danger/35 bg-surface text-danger hover:bg-danger/10",
  dangerSolid: "bg-danger text-page hover:opacity-90",
};

export function buttonClasses({
  variant = "secondary",
  size = "md",
  block = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
} = {}): string {
  return cn(BASE, SIZE[size], VARIANT[variant], block && "w-full", className);
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden focusable="false" className={cn("h-4 w-4 animate-spin", className)}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

type Shared = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconEnd?: IconName;
  block?: boolean;
  children?: ReactNode;
  className?: string;
};

export function Button({
  variant,
  size,
  icon,
  iconEnd,
  block,
  loading = false,
  loadingText,
  children,
  className,
  type = "button",
  disabled,
  ...rest
}: Shared &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
    loading?: boolean;
    loadingText?: string;
  }) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, block, className })}
      {...rest}
    >
      {loading ? <Spinner /> : icon ? <Icon name={icon} className="h-4 w-4" /> : null}
      {loading && loadingText ? loadingText : children}
      {iconEnd && !loading ? <Icon name={iconEnd} className="h-4 w-4" /> : null}
    </button>
  );
}

export function ButtonLink({
  href,
  external = false,
  variant,
  size,
  icon,
  iconEnd,
  block,
  children,
  className,
  ...rest
}: Shared &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "children"> & {
    href: string;
    /** Opens in a new tab — used for the storefront, never for admin screens. */
    external?: boolean;
  }) {
  const classes = buttonClasses({ variant, size, block, className });
  const content = (
    <>
      {icon ? <Icon name={icon} className="h-4 w-4" /> : null}
      {children}
      {iconEnd ? <Icon name={iconEnd} className="h-4 w-4" /> : null}
    </>
  );

  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={classes} {...rest}>
        {content}
      </a>
    );
  }
  return (
    <Link href={href} className={classes} {...rest}>
      {content}
    </Link>
  );
}
