import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * One button language for the whole storefront.
 *
 * THE HIERARCHY, loudest to quietest. A screen should use exactly one
 * `primary`; everything else steps down from it, and the step down is always
 * a reduction in fill, never a change of shape or type:
 *
 *   primary          filled burnt-orange — the one thing to do here
 *   secondary        olive rule, no fill — the alternative
 *   secondary-cream  the same, on a dark ground
 *   glass·-primary   hero only, frosted over photography
 *   quiet            no border at all — a tertiary action beside another
 *   text             an underlined phrase — "remove", "edit", inline actions
 *   danger           olive rule that turns burgundy — destructive, never red-filled
 *
 * WHAT EVERY VARIANT SHARES, so the family reads as one: 48px minimum height
 * (44px for `text`, which is a phrase rather than a slab), 2px corners,
 * Cinzel uppercase at 0.18em, the same 200ms bloom easing, the same 2px
 * offset focus ring, and the same 0.985 press.
 *
 * STATES ARE BUILT IN, not left to each call site. `loading` shows a spinner
 * and blocks the press — a double-submitted order is a real cost, and every
 * commerce button here is one someone can hit twice. `disabled` drops to 45%
 * and takes the cursor. Both are driven by props, so no screen invents its
 * own spinner or its own greyed-out class.
 *
 * ICON BUTTONS are square, `size="icon"`, and REQUIRE an aria-label — the
 * type signature enforces it, because an icon button without one is a
 * mystery to anyone not looking at it.
 */

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "secondary-cream"
  | "glass"
  | "glass-primary"
  | "quiet"
  | "text"
  | "danger";

export type ButtonSize = "default" | "compact" | "icon";

const base =
  "inline-flex items-center justify-center gap-2 rounded-sm " +
  "font-brand text-[0.8125rem] font-medium uppercase tracking-brand " +
  "transition-[opacity,filter,transform,border-color,background-color] duration-200 ease-bloom " +
  "select-none focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "active:scale-[0.985] " +
  /* One disabled treatment for the whole family, and it covers `aria-disabled`
     too — a link cannot be `disabled`, so a disabled-looking ButtonLink can
     only say so through aria. */
  "disabled:pointer-events-none disabled:opacity-45 " +
  "aria-disabled:pointer-events-none aria-disabled:opacity-45";

const sizes: Record<ButtonSize, string> = {
  default: "min-h-12 px-8 py-3",
  /* Inside a drawer or a card, where a 48px slab with 32px padding would
     dominate the thing it sits in. Still 44px — the tap-target floor. */
  compact: "min-h-11 px-5 py-2.5",
  icon: "h-11 w-11 shrink-0 p-0",
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-burnt-orange text-cream hover:brightness-95 focus-visible:outline-burnt-orange",
  secondary:
    "border border-olive text-olive hover:opacity-70 focus-visible:outline-olive",
  "secondary-cream":
    "border border-cream text-cream hover:opacity-75 focus-visible:outline-cream",
  /* Hero-only: frosted glass over photography. Styling lives in
     globals.css (`.btn-glass`) — backdrop-filter and layered shadows
     are past what utility classes express cleanly. */
  glass: "btn-glass text-cream focus-visible:outline-cream",
  "glass-primary": "btn-glass btn-glass-primary text-cream focus-visible:outline-cream",
  quiet:
    "border border-transparent text-olive hover:border-hairline hover:bg-cream/50 focus-visible:outline-olive",
  /* Not a slab: normal sentence case, the house underline, and it sits on the
     text baseline beside whatever it acts on. */
  text:
    "min-h-11 font-sans text-sm normal-case tracking-normal text-ink-muted underline decoration-hairline underline-offset-4 hover:text-olive hover:decoration-burnt-orange focus-visible:outline-olive",
  /* Destructive reads as the brand's burgundy on hover, never a filled red —
     a red button in a cream editorial palette is a foreign object. */
  danger:
    "border border-hairline text-ink-muted hover:border-burgundy hover:text-burgundy focus-visible:outline-burgundy",
};

export function buttonClasses(
  variant: ButtonVariant,
  className?: string,
  size: ButtonSize = "default",
): string {
  return cn(base, sizes[size], variants[variant], className);
}

/** The one spinner. Transform-only, so it costs nothing to animate. */
function Spinner() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 shrink-0 motion-safe:animate-spin"
      aria-hidden
    >
      <circle
        cx="8"
        cy="8"
        r="6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeOpacity="0.28"
      />
      <path
        d="M8 1.5A6.5 6.5 0 0 1 14.5 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

type Shared = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Blocks the press and shows the spinner. Say what is happening. */
  loading?: boolean;
  loadingText?: string;
};

type ButtonProps = React.ComponentPropsWithoutRef<"button"> &
  Shared &
  /* An icon button carries no text, so the label is the only thing naming it.
     Required by the type rather than hoped for in review. */
  ({ size?: Exclude<ButtonSize, "icon"> } | { size: "icon"; "aria-label": string });

export function Button({
  variant = "primary",
  size = "default",
  loading = false,
  loadingText,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={buttonClasses(variant, className, size)}
      disabled={disabled || loading}
      /* Announced once, when it flips — not on every re-render. */
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <Spinner />
          {loadingText ?? children}
        </>
      ) : (
        children
      )}
    </button>
  );
}

type ButtonLinkProps = React.ComponentPropsWithoutRef<typeof Link> &
  Shared &
  ({ size?: Exclude<ButtonSize, "icon"> } | { size: "icon"; "aria-label": string });

export function ButtonLink({
  variant = "primary",
  size = "default",
  loading = false,
  loadingText,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={buttonClasses(variant, className, size)}
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <Spinner />
          {loadingText ?? children}
        </>
      ) : (
        children
      )}
    </Link>
  );
}
