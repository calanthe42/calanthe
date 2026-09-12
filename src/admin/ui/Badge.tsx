import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A short status word.
 *
 * Always text plus colour, never colour alone — "Delivered" in green, not a
 * green dot someone has to learn. Tones are semantic and follow the theme.
 */

export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const TONE: Record<Tone, string> = {
  neutral: "bg-ink/[0.07] text-ink-2",
  info: "bg-ink/[0.09] text-ink",
  success: "bg-success/[0.13] text-success",
  warning: "bg-warning/[0.13] text-warning",
  danger: "bg-danger/[0.12] text-danger",
};

export function Badge({
  tone = "neutral",
  dot = false,
  children,
  className,
}: {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-sm px-2 py-0.5 text-xs font-medium leading-5",
        TONE[tone],
        className,
      )}
    >
      {dot ? <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" /> : null}
      <span className="truncate">{children}</span>
    </span>
  );
}
