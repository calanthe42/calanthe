"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ExpressCheckoutElement, PaymentElement } from "@stripe/react-stripe-js";
import type {
  StripeExpressCheckoutElementClickEvent,
  StripePaymentElementOptions,
} from "@stripe/stripe-js";
import { HAS_STRIPE, expressCheckoutOptions } from "@/components/commerce/stripe-shared";
import { Button } from "@/components/ui/Button";
import { OrchidPrint } from "@/components/ui/OrchidPrint";
import { cn } from "@/lib/cn";
import { useLocale } from "@/lib/locale";

/**
 * THE COUNTER — the one place on the site where money changes hands.
 *
 * Everything before it is the cream of the shop floor. Paying happens here,
 * on a single Deep Olive surface that carries the client's own orchid print
 * tone on tone, the way the atelier's bags and booth panels do. It is meant
 * to read as a change of room: on a phone it runs almost edge to edge, and
 * it is the only dark surface between the header and the footer.
 *
 * Checkout (a basket) and the payment link (/pay/[token]) both pay here, so
 * the surface and its pieces live in this one file and the two pages compose
 * them in the same order:
 *
 *   PayCounter      the surface, the step's heading, the amount to pay
 *   CounterWallet   the device's wallet, when it has one
 *   CounterCard     the card fields
 *   CounterPay      what went wrong, the pay button, the reassurance
 *
 * Nothing in this file decides what is charged. The amount shown is a
 * display; the charge is the PaymentIntent the server creates.
 *
 * No shadows, no gradients, no glass: olive, cream, and one burnt-orange
 * button. The amount is the only loud thing on it.
 */
export function PayCounter({
  ref,
  headingId,
  index,
  title,
  amountLabel,
  amountText,
  children,
}: {
  /** The section itself — the phone's pay bar steps aside when it arrives. */
  ref?: React.Ref<HTMLElement>;
  headingId: string;
  /** The step's number, where paying is one step of a numbered form. */
  index?: number;
  title: string;
  /** What the amount is, for someone who cannot see where it sits. */
  amountLabel: string;
  /** "AED 650", already formatted. */
  amountText: string;
  children: React.ReactNode;
}) {
  return (
    <section
      ref={ref}
      aria-labelledby={headingId}
      /* -mx-3 on a phone: the page's 20px gutter becomes 8px, so the surface
         is wider than every card above it without losing its corners. */
      className="pay-counter relative isolate -mx-5 overflow-hidden rounded-sm bg-olive px-5 pb-8 pt-7 text-cream sm:mx-0 sm:px-8 sm:pb-10 sm:pt-9 lg:px-10"
    >
      {/* The print at just over half strength: under a heading it is a
          texture, under a card number it would be noise. */}
      <OrchidPrint ground="olive" className="opacity-55" />

      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
        <h2
          id={headingId}
          className="flex items-baseline gap-4 font-display text-2xl font-light lg:text-[1.75rem]"
        >
          {index ? (
            <span className="font-sans text-sm text-cream-muted">{index}</span>
          ) : null}
          {title}
        </h2>
        <p className="font-display text-[2.75rem] leading-none sm:text-5xl">
          <span className="sr-only">{amountLabel} </span>
          {/* An amount reads AED 650 in either language. */}
          <span dir="ltr">{amountText}</span>
        </p>
      </div>

      {children}
    </section>
  );
}

/** A hairline with a few words on it. */
function Rule({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="separator"
      className="mt-6 flex items-center gap-4 font-brand text-xs font-medium uppercase tracking-brand text-cream-muted rtl:text-sm"
    >
      <span className="h-px flex-1 bg-cream/20" />
      {children}
      <span className="h-px flex-1 bg-cream/20" />
    </div>
  );
}

/**
 * The device's wallet — Apple Pay on an Apple device, Google Pay on the
 * rest (stripe-shared.ts) — as the first thing she can do.
 *
 * NOTHING UNTIL STRIPE SAYS THERE IS A WALLET. The element has to be on the
 * page for Stripe to find out, so it is mounted at once and kept at no
 * height; the button and the "or pay by card" line under it are given room
 * only when `ready` reports a wallet this browser can use. A device without
 * one never sees a gap, a label over nothing, or a line that appears and
 * goes away again.
 */
export function CounterWallet({
  onClick,
  onConfirm,
}: {
  onClick: (event: StripeExpressCheckoutElementClickEvent) => void;
  onConfirm: () => void;
}) {
  const { t } = useLocale();
  const [hasWallet, setHasWallet] = useState(false);
  /* Once: Stripe reads these when it creates the element. */
  const options = useMemo(expressCheckoutOptions, []);

  return (
    <div className={hasWallet ? "mt-7" : "h-0 overflow-hidden"}>
      <div role="group" aria-label={t.checkout.expressTitle}>
        <ExpressCheckoutElement
          options={options}
          onReady={({ availablePaymentMethods: methods }) =>
            setHasWallet(Boolean(methods?.applePay || methods?.googlePay))
          }
          /* Stripe can change its mind after `ready` (a wallet signed out
             of, a card removed): the row follows it. */
          onAvailablePaymentMethodsChange={({ paymentMethods: methods }) =>
            setHasWallet(
              Boolean(methods?.applePay?.available || methods?.googlePay?.available),
            )
          }
          onClick={onClick}
          onConfirm={onConfirm}
        />
      </div>
      {hasWallet ? <Rule>{t.checkout.orPayByCard}</Rule> : null}
    </div>
  );
}

/**
 * The card fields: Stripe's Payment Element, in the counter's palette
 * (`stripeAppearance`). The wallets are off here because the device's wallet
 * has its own button above.
 *
 * The room is kept from the start. Stripe.js arrives lazily and the fields a
 * moment after it; without a reserved height the pay button would sit where
 * the card number is about to be and then drop away under her thumb.
 */
export function CounterCard({
  fields,
}: {
  fields?: StripePaymentElementOptions["fields"];
}) {
  const { t } = useLocale();
  /* Ours until Stripe draws its own placeholder, then Stripe's. */
  const [waiting, setWaiting] = useState(true);
  return (
    <div
      role="group"
      aria-label={t.checkout.cardTitle}
      className="relative mt-6 min-h-[17rem]"
    >
      {waiting ? (
        <p className="absolute inset-x-0 top-0 text-base text-cream-muted">
          {t.checkout.paymentLoading}
        </p>
      ) : null}
      <PaymentElement
        onLoaderStart={() => setWaiting(false)}
        onReady={() => setWaiting(false)}
        options={{
          layout: { type: "tabs", defaultCollapsed: false },
          wallets: { applePay: "never", googlePay: "never", link: "never" },
          ...(fields ? { fields } : {}),
        }}
      />
    </div>
  );
}

/** A line of plain text on the counter — "card payment is not available". */
export function CounterNotice({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="status"
      className="mt-7 border-s border-cream/40 ps-4 text-base leading-relaxed"
    >
      {children}
    </p>
  );
}

/**
 * What went wrong, the pay button, and the one line of reassurance.
 *
 * THE BUTTON IS THE PAGE'S ONE BURNT-ORANGE ACTION, and it states the
 * amount. It is a submit button: the page's form decides what pressing it
 * does, exactly as before.
 *
 * AN ERROR IS BROUGHT INTO VIEW. The message sits directly above the button,
 * which is where she is looking when she presses it here — but the form can
 * also be sent from the phone's pay bar or with Enter, from far up the page,
 * and a refusal she cannot see reads as a button that does nothing. A field
 * the form has just sent her to (it is focused, and marked invalid) keeps
 * the screen: that message is already beside what needs fixing.
 */
export function CounterPay({
  error,
  label,
  loading,
  loadingText,
  disabled,
  showButton = true,
}: {
  error: string | null;
  label: string;
  loading: boolean;
  loadingText: string;
  disabled?: boolean;
  /** False where there is nothing to pay with (no card payments configured). */
  showButton?: boolean;
}) {
  const { t } = useLocale();
  const alertRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const alert = alertRef.current;
    if (!error || !alert) return;
    if (document.activeElement?.getAttribute("aria-invalid") === "true") return;
    const { top, bottom } = alert.getBoundingClientRect();
    if (top >= 0 && bottom <= window.innerHeight) return;
    alert.scrollIntoView({
      block: "center",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, [error]);

  return (
    <div className="mt-7">
      {error ? (
        <p
          ref={alertRef}
          role="alert"
          /* Cream, not orange: orange type on olive is under 3:1. The orange
             is the rule beside it. */
          className="mb-5 border-s-2 border-burnt-orange ps-4 text-base leading-relaxed"
        >
          {error}
        </p>
      ) : null}

      {showButton ? (
        <Button
          type="submit"
          variant="primary"
          /* 48px, the wallet button's height, so the two actions are a pair.
             While it is working it keeps its full strength: at the family's
             45% the words that say what is happening cannot be read on
             olive. */
          className="min-h-12 w-full focus-visible:outline-cream disabled:aria-busy:opacity-100"
          loading={loading}
          loadingText={loadingText}
          disabled={disabled}
        >
          {label}
        </Button>
      ) : null}

      {/* Said only where it is true: with no card payments there are no
          card details to speak of. */}
      {HAS_STRIPE ? (
        <p className="mt-5 flex gap-3 text-base leading-relaxed text-cream-muted">
          <svg
            viewBox="0 0 16 16"
            className="mt-1 h-4 w-4 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <rect x="3" y="7" width="10" height="7" rx="1" />
            <path d="M5.25 7V4.75a2.75 2.75 0 0 1 5.5 0V7" />
          </svg>
          {t.checkout.cardBody}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Whether the counter is still further down the page.
 *
 * On a phone a bar with the total and a pay button rides the bottom of the
 * screen while she fills in the form. The counter has its own pay button,
 * stating the amount, and two of them a thumb apart is a choice nobody
 * should be asked to make — so the bar is there only while the counter is
 * still ahead of her, and steps aside the moment it arrives. It does not
 * come back once she has scrolled past.
 *
 * False until measured, so the bar never flashes over a counter that was on
 * screen from the start (the payment link is a short page).
 */
export function useCounterAhead(counter: HTMLElement | null): boolean {
  const [ahead, setAhead] = useState(false);
  useEffect(() => {
    if (!counter) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry) setAhead(!entry.isIntersecting && entry.boundingClientRect.top > 0);
    });
    observer.observe(counter);
    return () => observer.disconnect();
  }, [counter]);
  return ahead;
}

/** The phone's pay bar, present only while `shown`. */
export function payBarClasses(shown: boolean): string {
  return cn(
    "fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-canvas px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 lg:hidden",
    "transition-[transform,opacity] duration-300 ease-bloom motion-reduce:transition-opacity",
    !shown && "pointer-events-none translate-y-full opacity-0",
  );
}
