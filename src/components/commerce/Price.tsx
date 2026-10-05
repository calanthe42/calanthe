import { cn } from "@/lib/cn";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { formatFils } from "@/lib/money";

/**
 * A price, and — while something is on offer — the price it replaced.
 *
 * ONE PLACE for the struck-through pattern, so the card, the product page,
 * the cart and the receipt cannot each invent their own. No hooks and no
 * "use client": it renders on the server wherever its parent does.
 *
 * NOTHING HERE IS ORANGE. Burnt Orange is an accent, not a text colour: on
 * the page background it does not reach AA at these sizes. The regular price
 * is muted and struck through, the price to pay is Olive, and the reduction
 * is carried by the words — which is also what a screen reader gets: the
 * strike-through is invisible to it, so "Was" and "Now" are spoken.
 *
 * Amounts are fils and are formatted by lib/money.ts, so a total that carries
 * fils prints "AED 496.80", never "AED 496.8". They sit in a left-to-right
 * isolate so the currency stays in front of the number on an Arabic page.
 */

type PriceProps = {
  /** What the customer pays, in fils. */
  nowFils: number;
  /** The regular price, in fils. Shown struck through only when it is higher. */
  wasFils?: number | null;
  /** `stack` puts the regular price on its own line above — for narrow cards. */
  layout?: "inline" | "stack";
  /** A word that belongs to the price to pay: the card's "from". */
  prefix?: React.ReactNode;
  t: Dictionary;
  className?: string;
  /** Classes for the price to pay; the caller owns its size and face. */
  nowClassName?: string;
  wasClassName?: string;
};

export function Price({
  nowFils,
  wasFils,
  layout = "inline",
  prefix,
  t,
  className,
  nowClassName,
  wasClassName,
}: PriceProps) {
  const now = formatFils(Math.max(0, Math.round(nowFils)));
  const onOffer = typeof wasFils === "number" && wasFils > nowFils;

  if (!onOffer) {
    return (
      <span className={className}>
        {prefix}
        <span dir="ltr" className={nowClassName}>
          {now}
        </span>
      </span>
    );
  }

  const was = formatFils(Math.round(wasFils));
  return (
    <span
      className={cn(
        layout === "stack"
          ? "inline-flex flex-col items-end"
          : "inline-flex flex-wrap items-baseline justify-end gap-x-2",
        className,
      )}
    >
      <span>
        <span className="sr-only">{t.ui.priceWas.replace("{price}", was)}</span>
        <s aria-hidden dir="ltr" className={cn("text-ink-muted", wasClassName)}>
          {was}
        </s>
      </span>
      <span>
        {prefix}
        <span className="sr-only">{t.ui.priceNow.replace("{price}", now)}</span>
        <span aria-hidden dir="ltr" className={cn("text-olive", nowClassName)}>
          {now}
        </span>
      </span>
    </span>
  );
}
