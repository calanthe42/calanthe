"use client";

import { memo, useRef, useState, useTransition } from "react";
import { loadStripe, type Appearance } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { startCardCheckout, type CheckoutRequest } from "@backend/actions/checkout";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { EASE_BLOOM } from "@/components/motion/constants";
import { FloralImage } from "@/components/ui/FloralImage";
import { Button, ButtonLink, buttonClasses } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import {
  chipClasses,
  chipOffClasses,
  chipOnClasses,
  fieldClasses,
  fieldErrorClasses,
  labelClasses,
} from "@/components/ui/form-classes";
import { Monogram } from "@/components/ui/Monogram";
import { useLocale } from "@/lib/locale";
import { plural } from "@/lib/i18n/plural";
import { cn } from "@/lib/cn";
import { describeCartItem, itemUnitPrice, useCart, type CartItem } from "@/lib/cart";
import {
  checkoutFieldErrors,
  normalisePhone,
  type CheckoutField,
} from "@/lib/checkout-fields";
import type { Dictionary } from "@/lib/i18n/dictionary";
import {
  CONTACT,
  deliveryZones,
  formatAed,
  FREE_DELIVERY_THRESHOLD_AED,
  DELIVERY_ALWAYS_FREE,
  type DeliveryZone,
} from "@/lib/data";
import { useDeliverySchedule } from "@/lib/useDeliverySchedule";

/** Order in which invalid fields receive focus — the order they appear. */
const FIELD_ORDER: readonly CheckoutField[] = [
  "recipientName",
  "recipientPhone",
  "zoneId",
  "name",
  "phone",
  "email",
  "address",
];

const FIELD_IDS: Record<CheckoutField, string> = {
  recipientName: "rec-name",
  recipientPhone: "rec-phone",
  zoneId: "zone",
  name: "name",
  phone: "phone",
  email: "email",
  address: "address",
};

const OrderSummary = memo(function OrderSummary({
  items,
  subtotalAed,
  zoneName,
  deliveryFee,
  totalAed,
  t,
}: {
  items: readonly CartItem[];
  subtotalAed: number;
  /** The chosen emirate, already in the reader's language. */
  zoneName: string | undefined;
  deliveryFee: number;
  totalAed: number;
  t: Dictionary;
}) {
  return (
    <div className="rounded-sm border border-hairline bg-cream/70 p-6">
      <h2 className="mb-5 font-brand text-xs font-medium uppercase tracking-brand text-olive">
        {t.checkout.yourOrder}
      </h2>
      <ul className="flex flex-col gap-5">
        {items.map((item) => (
          <li key={item.key} className="flex gap-4">
            <div className="aspect-[4/5] w-16 shrink-0 overflow-hidden rounded-media-sm">
              <FloralImage image={item.image} sizes="64px" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate font-display text-lg leading-tight text-olive">
                  {item.name}
                </p>
                <p className="shrink-0 text-sm text-olive">
                  {formatAed(itemUnitPrice(item) * item.qty)}
                </p>
              </div>
              <p className="mt-1 text-sm text-ink-muted">
                {item.qty > 1 && <>{item.qty} × </>}
                {describeCartItem(item, t)}
              </p>
              {item.giftMessage && (
                <p className="mt-1 text-sm italic text-ink-muted">
                  {t.checkout.withCard}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
      <hr className="my-5 border-0 border-t border-hairline" />
      <dl className="flex flex-col gap-2 text-sm">
        <div className="flex justify-between text-ink-muted">
          <dt>{t.checkout.subtotal}</dt>
          <dd>{formatAed(subtotalAed)}</dd>
        </div>
        <div className="flex justify-between text-ink-muted">
          <dt>
            {zoneName
              ? t.checkout.deliveryTo.replace("{name}", zoneName)
              : t.checkout.delivery}
          </dt>
          <dd>
            {zoneName
              ? deliveryFee === 0
                ? t.checkout.complimentary
                : formatAed(deliveryFee)
              : t.checkout.chooseEmirate}
          </dd>
        </div>
        <div className="mt-2 flex items-baseline justify-between border-t border-hairline pt-4 text-olive">
          <dt className="font-brand text-xs font-medium uppercase tracking-brand">
            {t.checkout.total}
          </dt>
          <dd className="font-display text-2xl">{formatAed(totalAed)}</dd>
        </div>
      </dl>
      <p className="mt-4 text-sm leading-relaxed text-ink-muted">
        {t.checkout.paidByCard}
      </p>
    </div>
  );
});

/** One step of the form: a real sequence, so it is numbered. */
function Step({
  index,
  title,
  children,
}: {
  index: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`step-${index}`} className="border-t border-hairline pt-8">
      <h2
        id={`step-${index}`}
        className="mb-6 flex items-baseline gap-4 font-display text-2xl font-light text-olive lg:text-[1.75rem]"
      >
        <span className="font-sans text-sm text-ink-muted">{index}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * The emirate in the reader's language.
 *
 * `deliveryZones` is a fee table in code, so its `name` is English. An
 * emirate is not a product name — every reader here knows it in Arabic — so
 * the dictionary answers first and the row is the fallback, which keeps a
 * zone added later visible rather than blank.
 */
function zoneName(zone: DeliveryZone, t: Dictionary): string {
  return t.zoneNames[zone.id] ?? zone.name;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className={fieldErrorClasses}>
      <span aria-hidden className="mt-2 h-px w-3 shrink-0 bg-burnt-orange" />
      {message}
    </p>
  );
}

/*
 * STRIPE, LOADED ONLY HERE. Stripe.js is fetched by the checkout page alone,
 * never on the rest of the site. Without a publishable key the provider still
 * mounts (with `null`), the payment step says payment is unavailable, and
 * nothing can be charged.
 */
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = PUBLISHABLE_KEY ? loadStripe(PUBLISHABLE_KEY) : null;

/* The Payment Element in the house palette: cream ground, olive type, almost
   square corners, Instrument Sans — so the card fields read as part of the
   page, not as a third-party box. */
const APPEARANCE: Appearance = {
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

/**
 * Card checkout: card, Apple Pay and Google Pay in Stripe's Payment Element
 * (docs/PAYMENTS.md). Deferred-intent flow — the element mounts with the
 * basket's amount, the order and its PaymentIntent are created on the server
 * only when the customer presses Pay, and the browser confirms with Stripe
 * directly. The order becomes PAID only when Stripe's signed webhook says so.
 */
export function CheckoutForm() {
  const { subtotalAed } = useCart();
  const { locale } = useLocale();
  return (
    <Elements
      stripe={stripePromise}
      options={{
        mode: "payment",
        currency: "aed",
        /* Delivery is free (DELIVERY_ALWAYS_FREE), so the basket is the
           total; the server recomputes it regardless. Stripe needs > 0. */
        amount: Math.max(100, Math.round(subtotalAed * 100)),
        locale: locale === "ar" ? "ar" : "en",
        appearance: APPEARANCE,
        fonts: [{ cssSrc: "https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500&display=swap" }],
      }}
    >
      <CheckoutFormInner />
    </Elements>
  );
}

function CheckoutFormInner() {
  const { items, subtotalAed, clear } = useCart();
  const { locale, t } = useLocale();
  const stripe = useStripe();
  const elements = useElements();
  /* A payment that fails can be retried without creating a second order:
     the order and its intent are kept while the request is unchanged. */
  const intentRef = useRef<{ key: string; orderNumber: string; clientSecret: string } | null>(null);

  /* Pre-fill from the day/slot and recipient chosen on the product page. */
  const preferred = items.find((i) => i.preferredDay);
  const withRecipient = items.find((i) => i.recipientName);
  const { days, selectedDay, setDay, slots, slot, setSlot } = useDeliverySchedule({
    day: preferred?.preferredDay,
    slot: preferred?.preferredSlot,
  });

  const [mode, setMode] = useState<"gift" | "myself">("gift");
  const [surprise, setSurprise] = useState(false);
  /* One emirate served today (Abu Dhabi), so it is chosen for her; with
     more than one she picks. */
  const [zoneId, setZoneId] = useState<string>(
    deliveryZones.length === 1 ? deliveryZones[0]!.id : "",
  );
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [recipientName, setRecipientName] = useState(withRecipient?.recipientName ?? "");
  const [recipientPhone, setRecipientPhone] = useState(
    withRecipient?.recipientPhone ?? "",
  );
  const [address, setAddress] = useState("");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [placed, setPlaced] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  /* Errors appear only after the first attempt, then update as she types —
     never a wall of red on a form she has not tried to send. */
  const [attempted, setAttempted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const zone = deliveryZones.find((z) => z.id === zoneId);
  const freeDelivery =
    DELIVERY_ALWAYS_FREE || zone?.feeAed === 0 || subtotalAed >= FREE_DELIVERY_THRESHOLD_AED;
  const deliveryFee = zone ? (freeDelivery ? 0 : zone.feeAed) : 0;
  const totalAed = subtotalAed + deliveryFee;

  const fieldErrors = attempted
    ? checkoutFieldErrors({
        mode,
        recipientName,
        recipientPhone,
        zoneId,
        name,
        phone,
        email,
        address,
      })
    : {};
  const dayUnavailable =
    attempted &&
    (!selectedDay || !days.some((d) => d.key === selectedDay && !d.disabled));

  /** The message for a field, in the reader's language, or nothing. */
  function errorText(field: CheckoutField): string | undefined {
    const code = fieldErrors[field];
    return code ? t.checkout.errors[code] : undefined;
  }

  /** Props that tie a field to its error for assistive technology. */
  function errorProps(field: CheckoutField) {
    const message = fieldErrors[field];
    return message
      ? { "aria-invalid": true as const, "aria-describedby": `${FIELD_IDS[field]}-error` }
      : {};
  }

  function placeOrder() {
    if (items.length === 0 || pending) return;
    setAttempted(true);
    setFormError(null);

    const errors = checkoutFieldErrors({
      mode,
      recipientName,
      recipientPhone,
      zoneId,
      name,
      phone,
      email,
      address,
    });
    const firstInvalid = FIELD_ORDER.find((field) => errors[field]);
    if (firstInvalid) {
      document.getElementById(FIELD_IDS[firstInvalid])?.focus();
      setFormError(t.checkout.formInvalid);
      return;
    }
    /* The schedule refreshes every minute, so a day that slipped past the
       cutoff while the form was open is caught here. */
    if (!selectedDay || !days.some((d) => d.key === selectedDay && !d.disabled)) {
      setFormError(t.checkout.dayGone);
      return;
    }

    /* Everything that costs money is recomputed on the server from the
       product records. This sends what was chosen, never what it costs. */
    if (!stripe || !elements) {
      setFormError(stripePromise ? t.checkout.paymentLoading : t.server.checkout.paymentUnavailable);
      return;
    }

    const request: CheckoutRequest = {
        lines: items.map((item) => ({
          productId: item.productId,
          quantity: item.qty,
          sizeId: item.sizeId,
          addonIds: [...item.addonIds],
          giftMessage: item.giftMessage,
        })),
        customerName: name.trim(),
        customerEmail: email.trim(),
        customerPhone: normalisePhone(phone),
        deliveryEmirate: zoneId,
        deliveryAddress: address.trim(),
        deliveryDate: selectedDay,
        deliveryTimeSlot: slot,
        recipientName: mode === "gift" ? recipientName.trim() : undefined,
        recipientPhone:
          mode === "gift" ? normalisePhone(recipientPhone) || undefined : undefined,
        cardMessage: items.find((i) => i.giftMessage)?.giftMessage,
        /* The surprise choice used to be collected and dropped. The order has
           a delivery-notes field the atelier reads; this is where it goes. */
        /* Staff-facing, and deliberately not translated: this is read in
           the admin by whoever schedules the delivery, and the atelier
           works in English. */
        deliveryNotes:
          mode === "gift" && surprise
            ? "Keep it a surprise: contact the sender, not the recipient, before delivery."
            : undefined,
    };

    startTransition(async () => {
      /* 1. Card fields first — Stripe requires this before any other await
         (Apple Pay / Google Pay sheets fail otherwise). */
      const submitted = await elements.submit();
      if (submitted.error) {
        setFormError(submitted.error.message ?? t.checkout.paymentFailed);
        return;
      }

      /* 2. The order and its PaymentIntent, priced on the server. */
      const key = JSON.stringify(request);
      let intent = intentRef.current?.key === key ? intentRef.current : null;
      if (!intent) {
        const result = await startCardCheckout(request);
        if (!result.ok) {
          /* The cart is untouched, so she can correct and send again. */
          setFormError(result.message);
          return;
        }
        intent = { key, orderNumber: result.orderNumber, clientSecret: result.clientSecret };
        intentRef.current = intent;
      }

      /* 3. Confirm with Stripe from the browser. 3-D Secure opens in place;
         a method that must redirect comes back to /checkout/complete. */
      const confirmed = await stripe.confirmPayment({
        elements,
        clientSecret: intent.clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}/checkout/complete?order=${encodeURIComponent(intent.orderNumber)}`,
          /* The element does not ask for these (checkout already has them),
             so Stripe needs them here. */
          payment_method_data: {
            billing_details: { email: request.customerEmail, phone: request.customerPhone },
          },
        },
        redirect: "if_required",
      });
      if (confirmed.error) {
        setFormError(confirmed.error.message ?? t.checkout.paymentFailed);
        return;
      }

      /* Only a confirmed payment empties the cart. The order is marked PAID
         by Stripe's webhook, not by this screen. */
      intentRef.current = null;
      clear();
      setPlaced(intent.orderNumber);
      window.scrollTo({ top: 0 });
      requestAnimationFrame(() => headingRef.current?.focus());
    });
  }

  if (placed) {
    return (
      <div className="flex min-h-[65svh] flex-col items-center justify-center gap-6 text-center">
        <Monogram className="w-16 text-burnt-orange" />
        <Eyebrow>{t.checkout.orderRef.replace("{number}", placed)}</Eyebrow>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="max-w-lg font-display text-4xl font-light leading-tight text-olive outline-none lg:text-5xl"
        >
          {t.checkout.placedTitle}
        </h1>
        <p className="max-w-md text-base leading-relaxed text-ink-muted">
          {t.checkout.placedBody}
        </p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/account"
            className={buttonClasses("secondary", "whitespace-nowrap")}
          >
            {t.checkout.viewOrders}
          </Link>
          <Link href="/shop" className={buttonClasses("secondary", "whitespace-nowrap")}>
            {t.checkout.continueShopping}
          </Link>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex min-h-[60svh] flex-col items-center justify-center gap-6 text-center">
        <Monogram className="w-14 text-ink-muted" />
        <h1 className="font-display text-3xl font-light italic text-olive lg:text-4xl">
          {t.cart.empty}
        </h1>
        <p className="max-w-sm text-base leading-relaxed text-ink-muted">
          {t.cart.emptyBody}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/shop" className="whitespace-nowrap">
            {t.cart.shopFlowers}
          </ButtonLink>
          <ButtonLink
            href="/build-your-own"
            variant="secondary"
            className="whitespace-nowrap"
          >
            {t.cart.buildYourOwn}
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    /*
     * A REAL <form>, not a div with a click handler.
     *
     * Everything here was inputs inside divs, so pressing Enter in the last
     * field did nothing — on a checkout, where that is exactly what people
     * do — and browsers and password managers had no form to attach address
     * autofill to. `placeOrder` is unchanged and still the only thing that
     * creates an order; it is now reached through submit as well as click.
     *
     * `noValidate` because the field-level messages below are written for a
     * customer; the browser's own bubbles would say something else, in a
     * different voice, in the wrong language.
     */
    <form
      noValidate
      /*
       * A form with an onSubmit handler and no method is still a GET form
       * until React hydrates. Pressing Enter in the last field before that
       * moment would navigate to /checkout?customerName=…&customerPhone=…
       * &deliveryAddress=… — the customer's name, phone and home address in
       * the address bar, in history, and in every log along the way. The
       * same fault was found on the admin sign-in form, where it was a
       * password. POST keeps it in a body Next simply discards.
       */
      method="post"
      /* Clearance for the sticky order bar on a phone, so the last field and
         the WhatsApp line are never trapped underneath it. */
      className="pb-28 lg:pb-0"
      onSubmit={(e) => {
        e.preventDefault();
        placeOrder();
      }}
    >
      <div className="mb-10 lg:mb-14">
        <Eyebrow>{t.checkout.eyebrow}</Eyebrow>
        <h1 className="display-2 mt-3 font-display font-light text-olive">
          {t.checkout.title}
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-16">
        <div className="flex flex-col gap-12">
          <Step index={1} title={t.checkout.forWhom}>
            <div
              className="grid grid-cols-2 gap-3"
              role="group"
              aria-label={t.checkout.audience}
            >
              {(
                [
                  ["gift", t.checkout.gift],
                  ["myself", t.checkout.myself],
                ] as const
              ).map(([value, text]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={mode === value}
                  onClick={() => setMode(value)}
                  className={cn(
                    chipClasses,
                    "py-3",
                    mode === value ? chipOnClasses : chipOffClasses,
                  )}
                >
                  {text}
                </button>
              ))}
            </div>
            <AnimatePresence initial={false}>
              {mode === "gift" && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.4, ease: EASE_BLOOM }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-1 gap-5 pt-6 sm:grid-cols-2">
                    <div>
                      <label className={labelClasses} htmlFor="rec-name">
                        {t.checkout.recipientName}
                      </label>
                      <input
                        id="rec-name"
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        className={fieldClasses}
                        placeholder={t.checkout.recipientNamePlaceholder}
                        autoComplete="off"
                        {...errorProps("recipientName")}
                      />
                      <FieldError
                        id="rec-name-error"
                        message={errorText("recipientName")}
                      />
                    </div>
                    <div>
                      <label className={labelClasses} htmlFor="rec-phone">
                        {t.checkout.recipientPhone}
                      </label>
                      <input
                        id="rec-phone"
                        value={recipientPhone}
                        onChange={(e) => setRecipientPhone(e.target.value)}
                        className={fieldClasses}
                        placeholder={t.checkout.phonePlaceholder}
                        inputMode="tel"
                        autoComplete="off"
                        {...errorProps("recipientPhone")}
                      />
                      <FieldError
                        id="rec-phone-error"
                        message={errorText("recipientPhone")}
                      />
                    </div>
                  </div>
                  <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 text-base text-ink-muted">
                    <input
                      type="checkbox"
                      checked={surprise}
                      onChange={(e) => setSurprise(e.target.checked)}
                      className="h-4 w-4 shrink-0 accent-[#2b2f1b]"
                    />
                    {t.checkout.surprise}
                  </label>
                </motion.div>
              )}
            </AnimatePresence>
          </Step>

          <Step index={2} title={t.checkout.whenWhere}>
            <div>
              <label className={labelClasses} htmlFor="zone">
                {t.checkout.emirate}
              </label>
              <select
                id="zone"
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                className={cn(fieldClasses, "appearance-none")}
                {...errorProps("zoneId")}
              >
                <option value="" disabled>
                  {t.checkout.emiratePlaceholder}
                </option>
                {deliveryZones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.feeAed === 0
                      ? t.checkout.emirateOptionFree.replace("{name}", zoneName(z, t))
                      : t.checkout.emirateOption
                          .replace("{name}", zoneName(z, t))
                          .replace("{fee}", formatAed(z.feeAed))}
                  </option>
                ))}
              </select>
              <FieldError id="zone-error" message={errorText("zoneId")} />
              {/* This used to appear ONLY once free delivery had been earned,
                  which told her about the threshold at the one moment it no
                  longer mattered. The useful version is the one that says how
                  far away it is while she can still act on it. */}
              {freeDelivery ? (
                <p className="mt-2 text-base text-ink-muted">{t.checkout.deliveryFree}</p>
              ) : (
                <p className="mt-2 text-base text-ink-muted">
                  {t.checkout.deliveryFreeAway.replace(
                    "{amount}",
                    formatAed(FREE_DELIVERY_THRESHOLD_AED - subtotalAed),
                  )}
                </p>
              )}
            </div>

            <div className="mt-6">
              <label className={labelClasses} htmlFor="address">
                {t.checkout.address}
              </label>
              <textarea
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={2}
                className={fieldClasses}
                placeholder={t.checkout.addressPlaceholder}
                autoComplete="street-address"
                {...errorProps("address")}
              />
              <FieldError id="address-error" message={errorText("address")} />
            </div>

            <fieldset className="mt-6">
              <legend className={labelClasses}>{t.checkout.day}</legend>
              {/* `contain: inline-size` keeps this row from widening its parent
                  (a fieldset / grid column sizes to its content): without it
                  the row grew past the screen instead of scrolling, and on a
                  phone the last days could not be reached. */}
              <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [contain:inline-size]">
                {days.map((day) => (
                  <button
                    key={day.key}
                    type="button"
                    disabled={day.disabled}
                    aria-pressed={selectedDay === day.key}
                    onClick={() => setDay(day.key)}
                    className={cn(
                      chipClasses,
                      "shrink-0 flex-col gap-0 px-4 py-2",
                      day.disabled && "cursor-not-allowed opacity-40",
                      selectedDay === day.key ? chipOnClasses : chipOffClasses,
                    )}
                  >
                    <span className="text-sm">{day.label}</span>
                    <span className="text-xs text-ink-muted">{day.sub}</span>
                  </button>
                ))}
              </div>
              {dayUnavailable && (
                <FieldError id="day-error" message={t.checkout.dayInvalid} />
              )}
            </fieldset>

            <fieldset className="mt-5">
              <legend className={labelClasses}>{t.checkout.window}</legend>
              <div className="flex flex-wrap gap-2">
                {slots.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    disabled={s.disabled}
                    aria-pressed={slot === s.value}
                    onClick={() => setSlot(s.value)}
                    className={cn(
                      chipClasses,
                      "flex-col gap-0 py-2",
                      s.disabled && "cursor-not-allowed opacity-40",
                      slot === s.value ? chipOnClasses : chipOffClasses,
                    )}
                  >
                    {/* dir="ltr": a time range reads 10:00 – 13:00 in either
                        language; under RTL it rendered "13:00 – 10:00". */}
                    <span dir="ltr" className="text-base text-olive">
                      {s.value}
                    </span>
                    {/* Says why, so a greyed window reads as a fact about
                        today rather than as a broken button. */}
                    {s.disabled && s.reason && (
                      <span className="text-xs text-ink-muted">{s.reason}</span>
                    )}
                  </button>
                ))}
              </div>
            </fieldset>
          </Step>

          <Step index={3} title={t.checkout.yourDetails}>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className={labelClasses} htmlFor="name">
                  {t.checkout.name}
                </label>
                <input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={fieldClasses}
                  placeholder={t.checkout.namePlaceholder}
                  autoComplete="name"
                  {...errorProps("name")}
                />
                <FieldError id="name-error" message={errorText("name")} />
              </div>
              <div>
                <label className={labelClasses} htmlFor="phone">
                  {t.checkout.phone}
                </label>
                <input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={fieldClasses}
                  placeholder={t.checkout.phonePlaceholder}
                  inputMode="tel"
                  autoComplete="tel"
                  {...errorProps("phone")}
                />
                <FieldError id="phone-error" message={errorText("phone")} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClasses} htmlFor="email">
                  {t.checkout.email}
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={fieldClasses}
                  placeholder={t.checkout.emailPlaceholder}
                  autoComplete="email"
                  {...errorProps("email")}
                />
                <FieldError id="email-error" message={errorText("email")} />
              </div>
            </div>
          </Step>

          <Step index={4} title={t.checkout.payment}>
            <p className="text-base text-olive">{t.checkout.cardTitle}</p>
            <p className="mb-4 mt-1 text-sm leading-relaxed text-ink-muted">
              {t.checkout.cardBody}
            </p>
            {stripePromise ? (
              <PaymentElement
                options={{
                  layout: { type: "tabs", defaultCollapsed: false },
                  wallets: { applePay: "auto", googlePay: "auto" },
                  fields: { billingDetails: { email: "never", phone: "never", name: "auto" } },
                }}
              />
            ) : (
              <p role="status" className="rounded-sm border border-hairline p-4 text-sm text-olive">
                {t.server.checkout.paymentUnavailable}
              </p>
            )}
          </Step>
        </div>

        {/* Summary — sticky beside the form on desktop, folded on a phone. */}
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <button
            type="button"
            aria-expanded={summaryOpen}
            aria-controls="order-summary"
            onClick={() => setSummaryOpen((v) => !v)}
            className="mb-3 flex min-h-12 w-full items-center justify-between border-y border-hairline lg:hidden"
          >
            <span className="font-brand text-xs font-medium uppercase tracking-brand text-olive">
              {summaryOpen ? t.checkout.hideSummary : t.checkout.showSummary}
            </span>
            <span className="font-display text-xl text-olive">{formatAed(totalAed)}</span>
          </button>
          <div
            id="order-summary"
            className={cn("lg:block", summaryOpen ? "block" : "hidden")}
          >
            <OrderSummary
              items={items}
              subtotalAed={subtotalAed}
              zoneName={zone ? zoneName(zone, t) : undefined}
              deliveryFee={deliveryFee}
              totalAed={totalAed}
              t={t}
            />
          </div>

          <div className="mt-6">
            {formError && (
              <p
                role="alert"
                className="mb-4 border-l border-burnt-orange pl-4 text-sm leading-relaxed text-olive"
              >
                {formError}
              </p>
            )}
            {/* On a phone this is replaced by the sticky bar below: two
                identical Place Order buttons a thumb's width apart is a
                choice the customer should not have to make. */}
            <Button
              type="submit"
              variant="primary"
              className="hidden w-full lg:flex"
              loading={pending}
              loadingText={t.checkout.placing}
            >
              {t.checkout.placeWithTotal.replace("{total}", formatAed(totalAed))}
            </Button>
            <p className="mt-4 text-sm leading-relaxed text-ink-muted">
              {t.checkout.questions}{" "}
              <a
                href={CONTACT.whatsappHref}
                target="_blank"
                rel="noreferrer"
                className="text-olive underline decoration-hairline underline-offset-4 hover:decoration-burnt-orange"
              >
                {t.checkout.messageFlorist}
              </a>
              .
            </p>
          </div>
        </aside>
      </div>

      {/*
        THE ORDER BUTTON, WHERE THE THUMB IS.
        On a phone the only way to place the order was to reach the bottom of
        a three-step form — past recipient, address, day, window and contact
        details — with no running total in sight on the way. The product page
        already solves this with a sticky bar; checkout, the page that takes
        the money, did not have one. Same pattern, same tokens, same
        safe-area inset, so it clears the home indicator on every iPhone
        since the X.
      */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-canvas px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 lg:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl leading-tight text-olive">
              {formatAed(totalAed)}
            </p>
            <p className="truncate text-sm text-ink-muted">
              {plural(locale, t.checkout.itemCount, items.length)}
              {" · "}
              {zone ? zoneName(zone, t) : t.checkout.pickEmirate}
            </p>
          </div>
          <Button
            type="submit"
            variant="primary"
            className="shrink-0 px-6"
            loading={pending}
            loadingText={t.checkout.placingShort}
          >
            {t.checkout.place}
          </Button>
        </div>
      </div>
    </form>
  );
}
