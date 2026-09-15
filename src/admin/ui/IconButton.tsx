import Link from "next/link";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./icons";

/**
 * A button that is only an icon.
 *
 * `label` is required and becomes both the accessible name and the native
 * tooltip: an icon with no name is a button a screen reader announces as
 * "button", and one a sighted person has to guess at.
 */

type Tone = "ghost" | "secondary" | "nav";

const TONE: Record<Tone, string> = {
  ghost: "text-ink-2 hover:bg-hover hover:text-ink",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-hover",
  nav: "text-nav-ink-2 hover:bg-nav-hover hover:text-nav-ink",
};

const BASE =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50";

export function IconButton({
  label,
  icon,
  tone = "ghost",
  className,
  type = "button",
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label"> & {
  label: string;
  icon: IconName;
  tone?: Tone;
}) {
  return (
    <button type={type} aria-label={label} title={label} className={cn(BASE, TONE[tone], className)} {...rest}>
      <Icon name={icon} />
    </button>
  );
}

export function IconLink({
  label,
  icon,
  href,
  tone = "ghost",
  external = false,
  className,
}: {
  label: string;
  icon: IconName;
  href: string;
  tone?: Tone;
  external?: boolean;
  className?: string;
}) {
  const classes = cn(BASE, TONE[tone], className);
  return external ? (
    <a href={href} target="_blank" rel="noreferrer" aria-label={label} title={label} className={classes}>
      <Icon name={icon} />
    </a>
  ) : (
    <Link href={href} aria-label={label} title={label} className={classes}>
      <Icon name={icon} />
    </Link>
  );
}
