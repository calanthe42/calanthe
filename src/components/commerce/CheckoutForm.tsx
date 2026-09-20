"use client";

import { memo, useRef, useState, useTransition } from "react";
import { placeCodOrder } from "@backend/actions/checkout";
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
import { useT } from "@/lib/locale";
import { cn } from "@/lib/cn";
import { describeCartItem, itemUnitPrice, useCart, type CartItem } from "@/lib/cart";
import {
  checkoutFieldErrors,
  normalisePhone,
  type CheckoutField,
} from "@/lib/checkout-fields";
import {
  CONTACT,
  deliveryZones,
  formatAed,
  FREE_DELIVERY_THRESHOLD_AED,
  timeSlots,
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
  zone,
  deliveryFee,
  totalAed,
}: {
  items: readonly CartItem[];
  subtotalAed: number;
  zone: DeliveryZone | undefined;
  deliveryFee: number;
  totalAed: number;
}) {
  return (
    <div className="rounded-sm border border-hairline bg-cream/70 p-6">
      <h2 className="mb-5 font-brand text-xs font-medium uppercase tracking-brand text-olive">
        Your order
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
                {describeCartItem(item)}
              </p>
              {item.giftMessage && (
                <p className="mt-1 text-sm italic text-ink-muted">With a handwritten card</p>
              )}
            </div>
          </li>
        ))}
      </ul>
      <hr className="my-5 border-0 border-t border-hairline" />
      <dl className="flex flex-col gap-2 text-sm">
        <div className="flex justify-between text-ink-muted">
          <dt>Subtotal</dt>
          <dd>{formatAed(subtotalAed)}</dd>
        </div>
        <div className="flex justify-between text-ink-muted">
          <dt>Delivery{zone ? ` to ${zone.name}` : ""}</dt>
          <dd>
            {zone
              ? deliveryFee === 0
                ? "Complimentary"
                : formatAed(deliveryFee)
              : "Choose an emirate"}
          </dd>
        </div>
        <div className="mt-2 flex items-baseline justify-between border-t border-hairline pt-4 text-olive">
          <dt className="font-brand text-xs font-medium uppercase tracking-brand">
            Total
          </dt>
          <dd className="font-display text-2xl">{formatAed(totalAed)}</dd>
        </div>
      </dl>
      <p className="mt-4 text-sm leading-relaxed text-ink-muted">
        Paid in cash when your flowers arrive.
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

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className={fieldErrorClasses}>
      <span aria-hidden className="mt-2 h-px w-3 shrink-0 bg-burnt-orange" />
      {message}
    </p>
  );
}

export function CheckoutForm() {
  const { items, subtotalAed, clear } = useCart();
  const t = useT();

  /* Pre-fill from the day/slot and recipient chosen on the product page. */
  const preferred = items.find((i) => i.preferredDay);
  const withRecipient = items.find((i) => i.recipientName);
  const { days, selectedDay, setDay, slot, setSlot } = useDeliverySchedule({
    day: preferred?.preferredDay,
    slot: preferred?.preferredSlot,
  });

  const [mode, setMode] = useState<"gift" | "myself">("gift");
  const [surprise, setSurprise] = useState(false);
  const [zoneId, setZoneId] = useState<string>("");
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
  const freeDelivery = subtotalAed >= FREE_DELIVERY_THRESHOLD_AED;
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
      setFormError("A few details need a second look. They are marked above.");
      return;
    }
    /* The schedule refreshes every minute, so a day that slipped past the
       cutoff while the form was open is caught here. */
    if (!selectedDay || !days.some((d) => d.key === selectedDay && !d.disabled)) {
      setFormError("Your delivery day is no longer available. Choose another.");
      return;
    }

    /* Everything that costs money is recomputed on the server from the
       product records. This sends what was chosen, never what it costs. */
    startTransition(async () => {
      const result = await placeCodOrder({
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
        deliveryNotes:
          mode === "gift" && surprise
            ? "Keep it a surprise: contact the sender, not the recipient, before delivery."
            : undefined,
      });

      if (!result.ok) {
        /* The cart is untouched, so she can correct and send again. */
        setFormError(result.message);
        return;
      }
      /* Only a confirmed order empties the cart. It used to be cleared the
         moment the button was pressed, so a failed order lost the basket. */
      clear();
      setPlaced(result.orderNumber);
      window.scrollTo({ top: 0 });
      requestAnimationFrame(() => headingRef.current?.focus());
    });
  }

  if (placed) {
    return (
      <div className="flex min-h-[65svh] flex-col items-center justify-center gap-6 text-center">
        <Monogram className="w-16 text-burnt-orange" />
        <Eyebrow>Order {placed}</Eyebrow>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="max-w-lg font-display text-4xl font-light leading-tight text-olive outline-none lg:text-5xl"
        >
          Your flowers are in our hands.
        </h1>
        <p className="max-w-md text-base leading-relaxed text-ink-muted">
          Before your arrangement leaves the atelier, your florist sends a photo or video
          on WhatsApp for your approval. Payment is taken in cash on delivery.
        </p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/account"
            className={buttonClasses("secondary", "whitespace-nowrap")}
          >
            View Your Orders
          </Link>
          <Link href="/shop" className={buttonClasses("secondary", "whitespace-nowrap")}>
            Continue Shopping
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
      onSubmit={(e) => {
        e.preventDefault();
        placeOrder();
      }}
    >
      <div className="mb-10 lg:mb-14">
        <Eyebrow>Checkout</Eyebrow>
        <h1 className="display-2 mt-3 font-display font-light text-olive">
          Almost there.
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-16">
        <div className="flex flex-col gap-12">
          <Step index={1} title="Who are the flowers for?">
            <div
              className="grid grid-cols-2 gap-3"
              role="group"
              aria-label="Who the order is for"
            >
              {(
                [
                  ["gift", "It's a gift"],
                  ["myself", "For myself"],
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
                        Recipient name
                      </label>
                      <input
                        id="rec-name"
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        className={fieldClasses}
                        placeholder="Their name"
                        autoComplete="off"
                        {...errorProps("recipientName")}
                      />
                      <FieldError
                        id="rec-name-error"
                        message={fieldErrors.recipientName}
                      />
                    </div>
                    <div>
                      <label className={labelClasses} htmlFor="rec-phone">
                        Recipient phone (optional)
                      </label>
                      <input
                        id="rec-phone"
                        value={recipientPhone}
                        onChange={(e) => setRecipientPhone(e.target.value)}
                        className={fieldClasses}
                        placeholder="050 123 4567"
                        inputMode="tel"
                        autoComplete="off"
                        {...errorProps("recipientPhone")}
                      />
                      <FieldError
                        id="rec-phone-error"
                        message={fieldErrors.recipientPhone}
                      />
                    </div>
                  </div>
                  <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 text-base text-ink-muted">
                    <input
                      type="checkbox"
                      checked={surprise}
                      onChange={(e) => setSurprise(e.target.checked)}
                      className="h-4 w-4 accent-[#2b2f1b]"
                    />
                    Keep it a surprise. Contact me, not them, about the delivery.
                  </label>
                </motion.div>
              )}
            </AnimatePresence>
          </Step>

          <Step index={2} title="When and where">
            <div>
              <label className={labelClasses} htmlFor="zone">
                Delivery emirate
              </label>
              <select
                id="zone"
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                className={cn(fieldClasses, "appearance-none")}
                {...errorProps("zoneId")}
              >
                <option value="" disabled>
                  Choose your emirate
                </option>
                {deliveryZones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name} — {formatAed(z.feeAed)} delivery
                  </option>
                ))}
              </select>
              <FieldError id="zone-error" message={fieldErrors.zoneId} />
              {zone && freeDelivery && (
                <p className="mt-2 text-sm text-ink-muted">
                  Delivery is complimentary on orders over{" "}
                  {formatAed(FREE_DELIVERY_THRESHOLD_AED)}.
                </p>
              )}
            </div>

            <div className="mt-6">
              <label className={labelClasses} htmlFor="address">
                Delivery address
              </label>
              <textarea
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={2}
                className={fieldClasses}
                placeholder="Villa or apartment, street, area"
                autoComplete="street-address"
                {...errorProps("address")}
              />
              <FieldError id="address-error" message={fieldErrors.address} />
            </div>

            <fieldset className="mt-6">
              <legend className={labelClasses}>Delivery day</legend>
              <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
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
                <FieldError
                  id="day-error"
                  message="Choose a day we can still deliver on."
                />
              )}
            </fieldset>

            <fieldset className="mt-5">
              <legend className={labelClasses}>Time window</legend>
              <div className="flex flex-wrap gap-2">
                {timeSlots.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={slot === s}
                    onClick={() => setSlot(s)}
                    className={cn(
                      chipClasses,
                      slot === s ? chipOnClasses : chipOffClasses,
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </fieldset>
          </Step>

          <Step index={3} title="Your details">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className={labelClasses} htmlFor="name">
                  Your name
                </label>
                <input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={fieldClasses}
                  placeholder="Full name"
                  autoComplete="name"
                  {...errorProps("name")}
                />
                <FieldError id="name-error" message={fieldErrors.name} />
              </div>
              <div>
                <label className={labelClasses} htmlFor="phone">
                  Your phone
                </label>
                <input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={fieldClasses}
                  placeholder="050 123 4567"
                  inputMode="tel"
                  autoComplete="tel"
                  {...errorProps("phone")}
                />
                <FieldError id="phone-error" message={fieldErrors.phone} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClasses} htmlFor="email">
                  Email for order updates
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={fieldClasses}
                  placeholder="you@example.com"
                  autoComplete="email"
                  {...errorProps("email")}
                />
                <FieldError id="email-error" message={fieldErrors.email} />
              </div>
            </div>
          </Step>

          <Step index={4} title="Payment">
            {/* The one method this checkout takes. It used to show a
                disabled card form, a Tabby instalment offer and "Apple Pay
                arrives later" — none of which a customer could use. */}
            <div className="flex items-start gap-4 rounded-sm border border-olive bg-cream/60 p-5">
              <span
                aria-hidden
                className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-olive"
              >
                <span className="h-2 w-2 rounded-full bg-olive" />
              </span>
              <div>
                <p className="text-base text-olive">Cash on delivery</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                  Pay the courier when your flowers arrive. Nothing is charged now.
                </p>
              </div>
            </div>
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
              {summaryOpen ? "Hide" : "Show"} order summary
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
              zone={zone}
              deliveryFee={deliveryFee}
              totalAed={totalAed}
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
            <Button
              type="submit"
              variant="primary"
              className="w-full"
              loading={pending}
              loadingText="Placing your order…"
            >
              Place Order — {formatAed(totalAed)}
            </Button>
            <p className="mt-4 text-sm leading-relaxed text-ink-muted">
              Questions first?{" "}
              <a
                href={CONTACT.whatsappHref}
                target="_blank"
                rel="noreferrer"
                className="text-olive underline decoration-hairline underline-offset-4 hover:decoration-burnt-orange"
              >
                Message a florist
              </a>
              .
            </p>
          </div>
        </aside>
      </div>
    </form>
  );
}
