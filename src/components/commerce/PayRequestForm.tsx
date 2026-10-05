"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Elements, useElements, useStripe } from "@stripe/react-stripe-js";
import { getQuotePaymentState, startQuotePayment } from "@backend/actions/pay";
import {
  CounterCard,
  CounterNotice,
  CounterPay,
  CounterWallet,
  PayCounter,
  payBarClasses,
  useCounterAhead,
} from "@/components/commerce/PayCounter";
import {
  HAS_STRIPE,
  STRIPE_FONTS,
  stripeAppearance,
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
 * page. She pays at the same counter as checkout (PayCounter.tsx): the
 * device's wallet first, then a card in Stripe's Payment Element.
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
  const appearance = useMemo(() => stripeAppearance(locale), [locale]);
  return (
    <Elements
      stripe={stripePromise}
      options={{
        mode: "payment",
        currency: "aed",
        amount: props.totalFils,
        locale: locale === "ar" ? "ar" : "en",
        appearance,
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
  /* The counter, once it is on the page: the phone's pay bar is shown only
     while it is still further down (PayCounter.tsx). */
  const [counter, setCounter] = useState<HTMLElement | null>(null);
  const counterAhead = useCounterAhead(counter);
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
        className="mt-10"
        onSubmit={(event) => {
          event.preventDefault();
          void pay();
        }}
      >
        <PayCounter
          ref={setCounter}
          headingId="pay-counter"
          title={t.checkout.payment}
          amountLabel={t.pay.total}
          amountText={amountText}
        >
          {HAS_STRIPE ? (
            <>
              <CounterWallet
                /* Stripe allows one second, with nothing awaited before
                   resolve(): there is no form to check here, so it opens at once. */
                onClick={(event) => event.resolve()}
                onConfirm={() => void pay()}
              />
              <CounterCard />
            </>
          ) : (
            <CounterNotice>{t.server.checkout.paymentUnavailable}</CounterNotice>
          )}
          <CounterPay
            error={error}
            label={t.pay.payNow.replace("{amount}", amountText)}
            loading={busy}
            loadingText={t.pay.paying}
            showButton={HAS_STRIPE}
          />
        </PayCounter>

        <div className="mt-6 flex flex-col gap-2 text-base leading-relaxed text-ink-muted">
          {validUntil ? <p>{validUntil}</p> : null}
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
            indicator. Like checkout's, it steps aside when the counter and
            its own pay button arrive. */}
        {HAS_STRIPE ? (
          <div className={payBarClasses(counterAhead)} inert={!counterAhead}>
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
