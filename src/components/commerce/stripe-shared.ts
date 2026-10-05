"use client";

import { useEffect, useState } from "react";
import { loadStripe, type Appearance, type StripeExpressCheckoutElementOptions } from "@stripe/stripe-js";

/**
 * The Stripe pieces the two paying pages share: checkout (a basket) and the
 * payment link (/pay/[token], an arrangement a florist confirmed).
 *
 * Both must look and load the same, so the palette, the wallet buttons and
 * the lazy loader live here once. Neither page changes what is charged — the
 * amount always comes from the server-created PaymentIntent.
 */

/*
 * STRIPE, LOADED ONLY WHERE MONEY IS TAKEN. Stripe.js is fetched by the
 * paying pages alone, never on the rest of the site. Without a publishable
 * key the provider still mounts (with `null`), the payment step says payment
 * is unavailable, and nothing can be charged.
 */
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
/** Whether card payment is possible on this deployment at all. */
export const HAS_STRIPE = Boolean(PUBLISHABLE_KEY);
/* Stripe.js (265 KB) is fetched lazily: on the first interaction with the
   form, or after a short idle — always well before the payment step is
   reached, never as part of the page's first paint (Lighthouse, 2026-10-04). */
let stripeLoading: ReturnType<typeof loadStripe> | null = null;
export const getStripePromise = () => (stripeLoading ??= loadStripe(PUBLISHABLE_KEY!));

/**
 * The promise to hand to <Elements>, armed on the first touch or key press,
 * or after a short idle — whichever comes first. `null` until then, and for
 * ever on a deployment with no publishable key.
 */
export function useLazyStripe(): ReturnType<typeof loadStripe> | null {
  const [stripePromise, setStripePromise] = useState<ReturnType<typeof loadStripe> | null>(null);
  useEffect(() => {
    if (!HAS_STRIPE) return;
    const arm = () => setStripePromise((current) => current ?? getStripePromise());
    const idle =
      "requestIdleCallback" in window
        ? window.requestIdleCallback(arm, { timeout: 2500 })
        : globalThis.setTimeout(arm, 2500);
    window.addEventListener("pointerdown", arm, { once: true, capture: true });
    window.addEventListener("keydown", arm, { once: true, capture: true });
    return () => {
      if ("cancelIdleCallback" in window) window.cancelIdleCallback(idle as number);
      else globalThis.clearTimeout(idle as number);
      window.removeEventListener("pointerdown", arm, { capture: true });
      window.removeEventListener("keydown", arm, { capture: true });
    };
  }, []);
  return stripePromise;
}

/*
 * THE COUNTER'S PALETTE, INSIDE STRIPE'S FRAMES.
 *
 * Paying happens on one Deep Olive surface (PayCounter.tsx), and the card
 * fields live in Stripe's iframes, which no stylesheet of ours reaches. The
 * Appearance API is the only way in, so the surface's colours are repeated
 * here as plain values. They are the brand's own pigments:
 *
 *   field   cream laid over olive at 7% — a shade lighter than the counter,
 *           and SOLID, so the orchid print never runs under a card number
 *   rule    sage, which measures 3.7:1 on olive: enough to find a field's
 *           edge, which a fainter hairline is not
 *   muted   cream-muted (tokens.css), 6:1 on olive — labels and placeholders
 *
 * AN ERROR IS CREAM, NOT ORANGE. Burnt orange text on olive measures under
 * 3:1 — the one sentence she most needs to read would be the hardest on the
 * surface. The orange keeps the job it can do: the edge of the field at
 * fault and the small card icon. `colorDanger` is therefore cream.
 */
const OLIVE = "#2B2F1B";
const CREAM = "#E4DCC5";
const CREAM_MUTED = "#B0AC95";
const SAGE = "#868764";
const BURNT_ORANGE = "#B55B29";
const FIELD = "#383B27";

/**
 * The look of Stripe's fields on the counter.
 *
 * Labels are the form's own labels — Cinzel capitals, tracked — so the card
 * fields read as the fourth step of the same form. Arabic is a joined
 * script: never capitals, never tracked, and a step larger (globals.css).
 */
export function stripeAppearance(locale: "en" | "ar"): Appearance {
  return {
    theme: "flat",
    variables: {
      colorPrimary: CREAM,
      colorBackground: FIELD,
      colorText: CREAM,
      colorTextSecondary: CREAM_MUTED,
      colorTextPlaceholder: CREAM_MUTED,
      colorDanger: CREAM,
      iconColor: CREAM_MUTED,
      iconChevronDownColor: CREAM_MUTED,
      iconCardErrorColor: BURNT_ORANGE,
      iconCardCvcErrorColor: BURNT_ORANGE,
      fontFamily: "'Instrument Sans', system-ui, sans-serif",
      /* 16px: body size, and the floor under which iOS zooms a focused field. */
      fontSizeBase: "16px",
      borderRadius: "2px",
      spacingUnit: "4px",
      gridRowSpacing: "20px",
      gridColumnSpacing: "12px",
    },
    rules: {
      ".Input": {
        backgroundColor: FIELD,
        border: `1px solid ${SAGE}`,
        boxShadow: "none",
        color: CREAM,
        padding: "13px 14px",
      },
      /* The same focus as the fields above it on the page — the edge takes
         the ink colour and gains a 1px ring — in cream, because here the ink
         is cream. */
      ".Input:focus": {
        border: `1px solid ${CREAM}`,
        boxShadow: `0 0 0 1px ${CREAM}`,
        outline: "none",
      },
      ".Input--invalid": {
        border: `1px solid ${BURNT_ORANGE}`,
        boxShadow: `0 0 0 1px ${BURNT_ORANGE}`,
        color: CREAM,
      },
      ".Label":
        locale === "ar"
          ? { color: CREAM_MUTED, fontSize: "14px", marginBottom: "8px" }
          : {
              color: CREAM_MUTED,
              fontFamily: "'Cinzel', serif",
              fontSize: "12px",
              fontWeight: "500",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              marginBottom: "8px",
            },
      ".Error": { color: CREAM, fontSize: "16px", lineHeight: "1.4", marginTop: "8px" },
      /* Only a card is offered, so no tabs show. Should Stripe ever add a
         second method, it arrives in the same palette, not in its own. */
      ".Tab": {
        backgroundColor: FIELD,
        border: `1px solid ${SAGE}`,
        boxShadow: "none",
        color: CREAM_MUTED,
      },
      ".Tab:hover": { color: CREAM },
      ".Tab--selected": {
        backgroundColor: FIELD,
        border: `1px solid ${CREAM}`,
        boxShadow: "none",
        color: CREAM,
      },
      ".Tab--selected:focus": { boxShadow: `0 0 0 1px ${CREAM}` },
      ".Block": {
        backgroundColor: OLIVE,
        border: `1px solid ${SAGE}`,
        boxShadow: "none",
      },
    },
  };
}

/** The fonts Stripe's iframes load, so the card fields match the page. */
export const STRIPE_FONTS = [
  {
    cssSrc:
      "https://fonts.googleapis.com/css2?family=Cinzel:wght@500&family=Instrument+Sans:wght@400;500&display=swap",
  },
];

/**
 * An iPhone, an iPad or a Mac — the devices whose wallet is Apple Pay.
 * (An iPad introduces itself as a Mac, which is the answer wanted anyway.)
 */
function isAppleDevice(): boolean {
  return (
    typeof navigator !== "undefined" &&
    /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent)
  );
}

/**
 * THE DEVICE'S OWN WALLET, AND ONLY THAT ONE.
 *
 * On an Apple device the button is Apple Pay; on everything else it is
 * Google Pay. Never both — two wallet buttons stacked is a choice nobody
 * needs to make about their own phone — and never Link, PayPal, Amazon Pay
 * or Klarna. Which wallet is settled here, before the element is created,
 * because Stripe does not let `paymentMethods` change afterwards; the
 * element mounts in the browser only, so `navigator` is always there by
 * then. Whether that wallet can actually show on this browser is still
 * Stripe's call: the counter hides the row when it cannot (PayCounter.tsx).
 *
 * The artwork is Apple's and Google's own, white for a dark ground, the
 * mark alone ("plain") so it needs no translating, and the same height as
 * the pay button under it.
 */
export function expressCheckoutOptions(): StripeExpressCheckoutElementOptions {
  const apple = isAppleDevice();
  return {
    buttonType: { applePay: "plain", googlePay: "plain" },
    buttonTheme: { applePay: "white", googlePay: "white" },
    buttonHeight: 48,
    layout: { maxColumns: 1, maxRows: 1 },
    paymentMethodOrder: [apple ? "apple_pay" : "google_pay"],
    paymentMethods: {
      applePay: apple ? "always" : "never",
      googlePay: apple ? "never" : "always",
      link: "never",
      amazonPay: "never",
      paypal: "never",
      klarna: "never",
    },
  };
}
