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

/* The Payment Element in the house palette: cream ground, olive type, almost
   square corners, Instrument Sans — so the card fields read as part of the
   page, not as a third-party box. */
export const APPEARANCE: Appearance = {
  theme: "flat",
  variables: {
    colorPrimary: "#2B2F1B",
    colorBackground: "#F3EFDF",
    colorText: "#2B2F1B",
    colorTextSecondary: "#575946",
    colorDanger: "#B55B29",
    fontFamily: "'Instrument Sans', system-ui, sans-serif",
    borderRadius: "2px",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": { border: "1px solid #CBC4A9", boxShadow: "none", padding: "12px 14px" },
    ".Input:focus": { border: "1px solid #2B2F1B", boxShadow: "0 0 0 1px #2B2F1B" },
    ".Tab": { border: "1px solid #CBC4A9", boxShadow: "none" },
    ".Tab--selected": { border: "1px solid #2B2F1B", backgroundColor: "#E4DCC5" },
    ".Label": { color: "#868764", fontSize: "12px" },
  },
};

/** The font Stripe's iframes load, so the card fields match the page. */
export const STRIPE_FONTS = [
  {
    cssSrc: "https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500&display=swap",
  },
];

/** Express: Apple Pay and Google Pay as their own buttons, and nothing else. */
export const EXPRESS_CHECKOUT_OPTIONS: StripeExpressCheckoutElementOptions = {
  buttonType: { applePay: "buy", googlePay: "buy" },
  buttonTheme: { applePay: "black", googlePay: "black" },
  buttonHeight: 48,
  paymentMethods: {
    applePay: "always",
    googlePay: "always",
    link: "never",
    amazonPay: "never",
    paypal: "never",
    klarna: "never",
  },
};
