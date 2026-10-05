"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Elements,
  ExpressCheckoutElement,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { getQuotePaymentState, startQuotePayment } from "@backend/actions/pay";
import {
  APPEARANCE,
  EXPRESS_CHECKOUT_OPTIONS,
  HAS_STRIPE,
  STRIPE_FONTS,
  useLazyStripe,
} from "@/components/commerce/stripe-shared";
import { Button } from "@/components/ui/Button";
import { Monogram } from "@/components/ui/Monogram";
import { CONTACT } from "@/lib/data";
import { useLocale } from "@/lib/locale";

/**
 * Paying a payment link — /pay/[token].
 *
 * A florist confirmed a bespoke arrangement and the customer was emailed this
 * page. Apple Pay / Google Pay come first (Express Checkout), then a card in
 * Stripe's Payment Element, in the same palette as checkout.
 *
 * THE BROWSER SENDS ONLY THE TOKEN. `totalFils` configures the wallet sheet
 * and the label on the button; what is charged is the PaymentIntent the
 * server creates for the order's own total (backend/actions/pay.ts). A page
 * that claimed a different amount would change nothing.
 *
 * THIS SCREEN NEVER SAYS "PAID". When Stripe accepts the payment it says
 * "we are confirming your payment" and asks the server where the request
 * stands; only once Stripe's signed webhook has marked the order paid does
 * the page reload into the invoice.
 *
 * This file does not touch the cart: a payment link is not a basket.
 */

type Props = {
  token: string;
  /** For the wallet sheet only — see the note above. */
  totalFils: number;
  /** "AED 650", already formatted on the server. */
  amountText: string;
  /** "This link is valid until …", or null when the order carries no expiry. */
  validUntil: string | null;
  /** The server-rendered heading and summary, shown until payment is sent. */
  children: React.ReactNode;
};

export function PayRequestForm(props: Props) {
  const { locale } = useLocale();
  /* Stripe.js arrives lazily — see stripe-shared.ts. */
  const stripePromise = useLazyStripe();
  return (
    <Elements
      stripe={stripePromise}
      options={{
        mode: "payment",
        currency: "aed",
        amount: props.totalFils,
        locale: locale === "ar" ? "ar" : "en",
        appearance: APPEARANCE,
        fonts: STRIPE_FONTS,
      }}
    >
      <PayRequestInner {...props} />
    </Elements>
  );
}

function PayRequestInner({ token, amountText, validUntil, children }: Props) {
  const { t } = useLocale();
  const router = useRouter();
  const stripe = useStripe();
  const elements = useElements();

  const [phase, setPhase] = useState<"form" | "confirming">("form");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* The "Express checkout" label appears only once Stripe says this device
     has Apple Pay or Google Pay; where neither exists the element renders
     nothing, and a heading over nothing reads as a broken page. */
  const [hasWallet, setHasWallet] = useState(false);
  /* A second press while the first is in flight must not start a second
     payment. State alone lags a render behind a fast double tap. */
  const inFlight = useRef(false);

  /** Card fields, then the PaymentIntent on the server, then confirm with Stripe. */
  async function pay() {
    if (inFlight.current) return;
    if (!stripe || !elements) {
      setError(HAS_STRIPE ? t.checkout.paymentLoading : t.server.checkout.paymentUnavailable);
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      /* 1. The element first — Stripe requires this before any other await
         (Apple Pay / Google Pay sheets fail otherwise). */
      const submitted = await elements.submit();
      if (submitted.error) {
        setError(submitted.error.message ?? t.checkout.paymentFailed);
        return;
      }

      /* 2. The PaymentIntent, for the order's own total. Only the token goes up. */
      const started = await startQuotePayment(token);
      if (!started.ok) {
        if (started.code === "PROCESSING") {
          /* Already being paid (another tab, a second press): wait with it. */
          setPhase("confirming");
          return;
        }
        setError(started.message);
        /* The request is no longer what this page shows — paid, cancelled,
           expired or gone. Ask the server for the page that is true now. */
        if (
          started.code === "PAID" ||
          started.code === "EXPIRED" ||
          started.code === "CANCELLED" ||
          started.code === "INVALID"
        ) {
          router.refresh();
        }
        return;
      }

      /* 3. Confirm with Stripe from the browser. 3-D Secure opens in place; a
         method that must leave the page comes back to this same link. */
      const confirmed = await stripe.confirmPayment({
        elements,
        clientSecret: started.clientSecret,
        confirmParams: { return_url: `${window.location.origin}/pay/${token}` },
        redirect: "if_required",
      });
      if (confirmed.error) {
        setError(confirmed.error.message ?? t.checkout.paymentFailed);
        return;
      }
      setPhase("confirming");
    } catch {
      setError(t.server.pay.failed);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  if (phase === "confirming") return <PayConfirming token={token} />;

  return (
    <>
      {children}

      {/* method="post": until React hydrates, a form with no method is a GET
          and Enter would put its fields in the address bar. */}
      <form
        method="post"
        noValidate
        /* Clearance for the fixed pay bar on a phone. */
        className="mt-10 pb-28 lg:pb-0"
        onSubmit={(event) => {
          event.preventDefault();
          void pay();
        }}
      >
        {HAS_STRIPE ? (
          <>
            {hasWallet ? (
              <p className="mb-3 text-base text-ink-muted">{t.checkout.expressTitle}</p>
            ) : null}
            <ExpressCheckoutElement
              options={EXPRESS_CHECKOUT_OPTIONS}
              onReady={(event) => {
                const methods = event.availablePaymentMethods;
                setHasWallet(Boolean(methods?.applePay || methods?.googlePay));
              }}
              /* Stripe allows one second, with nothing awaited before
                 resolve(): there is no form to check here, so it opens at once. */
              onClick={(event) => event.resolve()}
              onConfirm={() => void pay()}
            />

            {hasWallet ? (
              <div className="my-6 flex items-center gap-4 text-sm text-ink-muted" role="separator">
                <span className="h-px flex-1 bg-hairline" />
                {t.checkout.orPayByCard}
                <span className="h-px flex-1 bg-hairline" />
              </div>
            ) : null}

            <PaymentElement
              options={{
                layout: { type: "tabs", defaultCollapsed: false },
                /* The wallets have their own buttons above. */
                wallets: { applePay: "never", googlePay: "never" },
              }}
            />
          </>
        ) : (
          <p role="status" className="rounded-sm border border-hairline p-4 text-base text-olive">
            {t.server.checkout.paymentUnavailable}
          </p>
        )}

        {error ? (
          <p
            role="alert"
            className="mt-6 border-s border-burnt-orange ps-4 text-base leading-relaxed text-olive"
          >
            {error}
          </p>
        ) : null}

        {/* On a phone this is replaced by the fixed bar below. */}
        {HAS_STRIPE ? (
          <Button
            type="submit"
            variant="primary"
            className="mt-8 hidden w-full lg:flex"
            loading={busy}
            loadingText={t.pay.paying}
          >
            {t.pay.payNow.replace("{amount}", amountText)}
          </Button>
        ) : null}

        <div className="mt-8 flex flex-col gap-2 text-base leading-relaxed text-ink-muted">
          {validUntil ? <p>{validUntil}</p> : null}
          <p>{t.checkout.cardBody}</p>
          <p>
            {t.checkout.questions}{" "}
            <a
              href={CONTACT.whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center text-olive underline decoration-hairline underline-offset-4 hover:decoration-burnt-orange"
            >
              {t.pay.whatsapp}
            </a>
          </p>
        </div>

        {/* THE PAY BUTTON, WHERE THE THUMB IS — the same bar as checkout:
            total at the start, the action at the end, clear of the home
            indicator. */}
        {HAS_STRIPE ? (
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-canvas px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 lg:hidden">
            <div className="mx-auto flex max-w-xl items-center gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink-muted">{t.pay.total}</p>
                <p dir="ltr" className="font-display text-xl leading-tight text-olive rtl:text-end">
                  {amountText}
                </p>
              </div>
              <Button
                type="submit"
                variant="primary"
                className="shrink-0 px-6"
                loading={busy}
                loadingText={t.pay.paying}
              >
                {t.pay.payShort}
              </Button>
            </div>
          </div>
        ) : null}
      </form>
    </>
  );
}

const POLL_EVERY_MS = 2_000;
const POLL_FOR_MS = 30_000;

/**
 * The browser has paid; the webhook has not yet said so.
 *
 * Asks the server every two seconds, for half a minute, where the request
 * stands — the state and nothing else — and reloads into the invoice the
 * moment it is paid. If the webhook is slower than that, the page says the
 * invoice will come by email and stops asking; it never invites a second
 * payment.
 */
export function PayConfirming({ token }: { token: string }) {
  const { t } = useLocale();
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [waitedOut, setWaitedOut] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();

    const ask = async () => {
      if (stopped) return;
      const answer = await getQuotePaymentState(token).catch(() => null);
      if (stopped) return;
      if (answer?.state === "paid") {
        router.refresh();
        return;
      }
      if (Date.now() - startedAt >= POLL_FOR_MS) {
        setWaitedOut(true);
        return;
      }
      timer = setTimeout(() => void ask(), POLL_EVERY_MS);
    };
    timer = setTimeout(() => void ask(), POLL_EVERY_MS);

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [token, router]);

  return (
    <div className="flex min-h-[55svh] flex-col items-center justify-center gap-6 text-center">
      <Monogram className="w-16 text-burnt-orange" />
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="max-w-lg font-display text-4xl font-light leading-tight text-olive outline-none lg:text-5xl"
      >
        {t.pay.confirmingTitle}
      </h1>
      <p role="status" className="max-w-md text-base leading-relaxed text-ink-muted">
        {waitedOut ? t.pay.stillConfirming : t.pay.confirmingBody}
      </p>
    </div>
  );
}
