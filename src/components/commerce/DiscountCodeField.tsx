"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { fieldClasses, labelClasses } from "@/components/ui/form-classes";
import { useCart } from "@/lib/cart";
import { cn } from "@/lib/cn";
import { CODE_MAX_LENGTH } from "@/lib/discounts";
import { useT } from "@/lib/locale";
import { formatFils, formatFilsInline } from "@/lib/money";

/**
 * The discount code field — one component, used in the cart drawer and in
 * the checkout summary, so a code typed in one is already there in the other.
 *
 * IT SENDS TEXT AND SHOWS WHAT THE SERVER ANSWERS. The amount a code takes
 * off is never worked out here: `useCart` asks the server for a quote and
 * this renders the result, or the server's sentence for why not. The order
 * is priced again, on the server, when it is placed.
 *
 * FOLDED BY DEFAULT. Most customers have no code, and an empty box above the
 * pay button is an invitation to go and look for one. It is one quiet line
 * until she asks for it, which also keeps Checkout in the thumb zone.
 *
 * NOT A <form>. It sits inside the checkout's own form, and a nested form is
 * invalid; Enter is caught here so it applies the code instead of placing
 * the order.
 *
 * The input is 16px (iOS zooms the page for anything smaller) and
 * left-to-right in both languages: a code is Latin capitals and digits.
 */
export function DiscountCodeField({ className }: { className?: string }) {
  const t = useT();
  const id = useId();
  const {
    discountCode,
    discount,
    discountState,
    discountMessage,
    applyDiscountCode,
    removeDiscountCode,
  } = useCart();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");

  const checking = discountState === "checking";
  const failed = discountState === "error";
  /* A held code that is applied or being checked shows as a chip; one that
     was refused goes back into the box, where it can be corrected. */
  const held = discountCode !== null && !failed;
  const value = typed || (failed ? (discountCode ?? "") : "");

  function apply() {
    const next = value.trim();
    if (!next || checking) return;
    applyDiscountCode(next);
    setTyped("");
  }

  if (!held && !failed && !open) {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          aria-controls={`${id}-panel`}
          className="flex min-h-11 items-center text-base text-ink-muted underline decoration-hairline underline-offset-4 transition-colors duration-200 ease-bloom hover:text-olive hover:decoration-burnt-orange focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-olive"
        >
          {t.discount.toggle}
        </button>
      </div>
    );
  }

  return (
    <div id={`${id}-panel`} className={className}>
      {held ? (
        <div className="flex min-h-11 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-1">
            <span
              dir="ltr"
              className="truncate rounded-sm border border-hairline px-2.5 py-1 text-sm tracking-wide text-olive"
            >
              {discountCode}
            </span>
            <button
              type="button"
              onClick={() => {
                removeDiscountCode();
                setTyped("");
                setOpen(false);
              }}
              aria-label={t.discount.remove.replace("{code}", discountCode ?? "")}
              className="flex h-11 w-11 shrink-0 items-center justify-center text-ink-muted transition-colors duration-200 ease-bloom hover:text-olive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-olive"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
          <p className="shrink-0 text-base text-olive">
            {discount ? (
              <span dir="ltr">−{formatFils(discount.discountFils)}</span>
            ) : (
              <span className="text-ink-muted">{t.discount.checking}</span>
            )}
          </p>
        </div>
      ) : (
        <div>
          <label htmlFor={`${id}-code`} className={labelClasses}>
            {t.discount.label}
          </label>
          <div className="flex items-stretch gap-2">
            <input
              id={`${id}-code`}
              dir="ltr"
              value={value}
              onChange={(e) => setTyped(e.target.value.toUpperCase().slice(0, CODE_MAX_LENGTH + 8))}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                /* Inside the checkout form: Enter here must not place the order. */
                e.preventDefault();
                apply();
              }}
              placeholder={t.discount.placeholder}
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
              aria-invalid={failed || undefined}
              aria-describedby={failed ? `${id}-message` : undefined}
              className={cn(fieldClasses, "min-w-0 flex-1 tracking-wide")}
            />
            <Button
              type="button"
              variant="secondary"
              size="compact"
              onClick={apply}
              disabled={!value.trim()}
              className="shrink-0"
            >
              {t.discount.apply}
            </Button>
          </div>
        </div>
      )}

      {/* One message, fading in. Success is a status; a refusal is an alert,
          with the same burnt-orange rule at the reading edge that the
          checkout's own error uses — never orange text. */}
      {discount ? (
        <p role="status" className="mt-2 animate-[quiet-fade-in_200ms_cubic-bezier(0.22,1,0.36,1)] text-base leading-relaxed text-olive motion-reduce:animate-none">
          {t.discount.applied
            .replace("{code}", `⁦${discount.code}⁩`)
            .replace("{amount}", formatFilsInline(discount.discountFils))}
        </p>
      ) : failed ? (
        <p
          id={`${id}-message`}
          role="alert"
          className="mt-3 animate-[quiet-fade-in_200ms_cubic-bezier(0.22,1,0.36,1)] border-s border-burnt-orange ps-4 text-base leading-relaxed text-olive motion-reduce:animate-none"
        >
          {discountMessage ?? t.discount.failed}
        </p>
      ) : null}
    </div>
  );
}
