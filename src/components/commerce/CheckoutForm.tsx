"use client";

import { memo, useState, useTransition } from "react";
import { placeCodOrder } from "@backend/actions/checkout";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { EASE_BLOOM } from "@/components/motion/constants";
import { FloralImage } from "@/components/ui/FloralImage";
import { Button, buttonClasses } from "@/components/ui/Button";
import {
  chipClasses,
  chipOffClasses,
  chipOnClasses,
  fieldClasses,
  labelClasses,
} from "@/components/ui/form-classes";
import { Monogram } from "@/components/ui/Monogram";
import { cn } from "@/lib/cn";
import { describeCartItem, itemUnitPrice, useCart, type CartItem } from "@/lib/cart";
import { useToast } from "@/lib/toast";
import {
  deliveryZones,
  formatAed,
  FREE_DELIVERY_THRESHOLD_AED,
  timeSlots,
  type DeliveryZone,
} from "@/lib/data";
import { useDeliverySchedule } from "@/lib/useDeliverySchedule";

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
    <div className="rounded-sm border border-hairline bg-cream p-6">
      <h2 className="mb-4 font-brand text-xs font-medium uppercase tracking-brand text-olive">
        Order Summary
      </h2>
      <ul className="flex flex-col gap-4">
        {items.map((item) => (
          <li key={item.key} className="flex gap-3">
            <div className="aspect-[4/5] w-14 shrink-0 overflow-hidden rounded-media-sm">
              <FloralImage image={item.image} sizes="56px" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate font-display text-base text-olive">
                  {item.name} × {item.qty}
                </p>
                <p className="shrink-0 text-sm text-olive">
                  {formatAed(itemUnitPrice(item) * item.qty)}
                </p>
              </div>
              <p className="text-xs text-sage">
                {describeCartItem(item)}
                {item.giftMessage && <> · Gift card</>}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <hr className="my-4 border-0 border-t border-hairline" />
      <dl className="flex flex-col gap-2 text-sm">
        <div className="flex justify-between text-sage">
          <dt>Subtotal</dt>
          <dd>{formatAed(subtotalAed)}</dd>
        </div>
        <div className="flex justify-between text-sage">
          <dt>Delivery{zone ? ` — ${zone.name}` : ""}</dt>
          <dd>
            {zone
              ? deliveryFee === 0
                ? "Complimentary"
                : formatAed(deliveryFee)
              : "Select area"}
          </dd>
        </div>
        <div className="flex justify-between pt-1 font-display text-xl text-olive">
          <dt>Total</dt>
          <dd>{formatAed(totalAed)}</dd>
        </div>
      </dl>
    </div>
  );
});

export function CheckoutForm() {
  const { items, subtotalAed, clear } = useCart();
  const { toast } = useToast();

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

  const zone = deliveryZones.find((z) => z.id === zoneId);
  const freeDelivery = subtotalAed >= FREE_DELIVERY_THRESHOLD_AED;
  const deliveryFee = zone ? (freeDelivery ? 0 : zone.feeAed) : 0;
  const totalAed = subtotalAed + deliveryFee;
  /* Fractional so 4 instalments always sum to exactly the total. */
  const tabbyInstalment = (totalAed / 4).toFixed(2);

  function placeOrder() {
    if (items.length === 0) return;
    if (!name.trim() || !phone.trim() || !email.trim() || !zoneId || !address.trim()) {
      toast("A few delivery details are still missing");
      return;
    }
    if (mode === "gift" && !recipientName.trim()) {
      toast("Tell us who is receiving the flowers");
      return;
    }
    /* The schedule refreshes every minute, so a day that slipped past
       the cutoff while the form was open is caught here. */
    if (!selectedDay || !days.some((d) => d.key === selectedDay && !d.disabled)) {
      toast("Your delivery day is no longer available — pick another");
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
        customerPhone: phone.trim(),
        deliveryEmirate: zoneId,
        deliveryAddress: address.trim(),
        deliveryDate: selectedDay,
        deliveryTimeSlot: slot,
        recipientName: mode === "gift" ? recipientName.trim() : undefined,
        recipientPhone: mode === "gift" ? recipientPhone.trim() || undefined : undefined,
        cardMessage: items.find((i) => i.giftMessage)?.giftMessage,
      });

      if (!result.ok) {
        toast(result.message);
        return;
      }
      setPlaced(result.orderNumber);
      clear();
    });
    clear();
  }

  if (placed) {
    return (
      <div className="flex min-h-[65svh] flex-col items-center justify-center gap-6 px-6 text-center">
        <Monogram className="w-16 text-burnt-orange" />
        <h1 className="max-w-md font-display text-3xl font-light text-olive lg:text-4xl">
          Thank you — your flowers are in our hands.
        </h1>
        <p className="max-w-sm text-base leading-relaxed text-sage">
          Order {placed}. Before delivery, your florist will send you a photo or video of
          the finished arrangement on WhatsApp for your approval. (UI preview — no payment
          was taken.)
        </p>
        <Link href="/account" className={buttonClasses("secondary")}>
          View Your Orders
        </Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex min-h-[65svh] flex-col items-center justify-center gap-6 px-6 text-center">
        <Monogram className="w-14 text-sage" />
        <p className="font-display text-2xl font-light italic text-olive">
          Your cart is waiting to bloom.
        </p>
        <Link href="/shop" className={buttonClasses("secondary")}>
          Shop Flowers
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_24rem] lg:gap-16">
      <div className="flex flex-col gap-10">
        {/* Gift / myself */}
        <section>
          <div className="grid grid-cols-2 gap-3">
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
                <div className="grid grid-cols-1 gap-4 pt-5 sm:grid-cols-2">
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
                    />
                  </div>
                  <div>
                    <label className={labelClasses} htmlFor="rec-phone">
                      Recipient phone
                    </label>
                    <input
                      id="rec-phone"
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value)}
                      className={fieldClasses}
                      placeholder="+971 …"
                      inputMode="tel"
                    />
                  </div>
                </div>
                <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 text-sm text-sage">
                  <input
                    type="checkbox"
                    checked={surprise}
                    onChange={(e) => setSurprise(e.target.checked)}
                    className="h-4 w-4 accent-[#2b2f1b]"
                  />
                  Keep it a surprise — only contact me about the delivery
                </label>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Delivery area */}
        <section>
          <label className={labelClasses} htmlFor="zone">
            Delivery area
          </label>
          <select
            id="zone"
            value={zoneId}
            onChange={(e) => setZoneId(e.target.value)}
            className={cn(fieldClasses, "appearance-none")}
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
          {zone && freeDelivery && (
            <p className="mt-2 text-sm text-sage">
              Delivery is complimentary — your order is over{" "}
              {formatAed(FREE_DELIVERY_THRESHOLD_AED)}.
            </p>
          )}
        </section>

        {/* Day + slot */}
        <section>
          <p className={labelClasses}>Delivery day</p>
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {days.map((day) => (
              <button
                key={day.key}
                type="button"
                disabled={day.disabled}
                aria-pressed={selectedDay === day.key}
                onClick={() => setDay(day.key)}
                className={cn(
                  chipClasses,
                  "flex-col gap-0 px-4 py-2",
                  day.disabled && "cursor-not-allowed opacity-40",
                  selectedDay === day.key ? chipOnClasses : chipOffClasses,
                )}
              >
                <span className="text-sm">{day.label}</span>
                <span className="text-xs text-sage">{day.sub}</span>
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {timeSlots.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={slot === s}
                onClick={() => setSlot(s)}
                className={cn(chipClasses, slot === s ? chipOnClasses : chipOffClasses)}
              >
                {s}
              </button>
            ))}
          </div>
        </section>

        {/* Your details */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            />
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
              placeholder="+971 …"
              inputMode="tel"
              autoComplete="tel"
            />
          </div>
          <div>
            <label className={labelClasses} htmlFor="email">
              Email (order updates)
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={fieldClasses}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClasses} htmlFor="address">
              Delivery address
            </label>
            <textarea
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
              className={fieldClasses}
              placeholder="Villa / apartment, street, area"
              autoComplete="street-address"
            />
          </div>
        </section>

        {/* Payment placeholder */}
        <section>
          <p className={labelClasses}>Payment</p>
          <div className="rounded-sm border border-hairline p-5">
            <p className="text-sm text-olive">Card payment</p>
            <div className="mt-3 grid grid-cols-1 gap-3 opacity-50 sm:grid-cols-[1fr_6rem_6rem]">
              <input className={fieldClasses} placeholder="Card number" disabled />
              <input className={fieldClasses} placeholder="MM / YY" disabled />
              <input className={fieldClasses} placeholder="CVC" disabled />
            </div>
            <p className="mt-3 text-xs text-sage">
              Payment is connected in the backend phase — this is a visual placeholder.
            </p>
          </div>
          <div className="mt-3 flex items-center gap-3 rounded-sm border border-hairline p-5">
            <span className="rounded-sm bg-cream px-2 py-1 font-brand text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-olive">
              tabby
            </span>
            <p className="text-sm text-sage">
              or 4 interest-free payments of AED {tabbyInstalment}
            </p>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-sm border border-dashed border-hairline p-5 opacity-70">
            <p className="font-brand text-[0.625rem] font-medium uppercase tracking-brand text-sage">
              Apple Pay · Google Pay
            </p>
            <p className="text-xs text-sage">arrives with the payments phase</p>
          </div>
        </section>

        {/* Trust row */}
        <section className="flex flex-wrap gap-x-8 gap-y-2 border-t border-hairline pt-6">
          {["Secure checkout", "Same-day delivery", "Hand-arranged in the atelier"].map(
            (line) => (
              <p
                key={line}
                className="font-brand text-[0.625rem] font-medium uppercase tracking-brand text-sage"
              >
                {line}
              </p>
            ),
          )}
        </section>
      </div>

      {/* Summary — accordion on mobile, fixed column on desktop */}
      <aside>
        <button
          type="button"
          aria-expanded={summaryOpen}
          onClick={() => setSummaryOpen((v) => !v)}
          className="mb-3 flex min-h-11 w-full items-center justify-between lg:hidden"
        >
          <span className="font-brand text-xs font-medium uppercase tracking-brand text-olive">
            Order Summary — {formatAed(totalAed)}
          </span>
          <span
            aria-hidden
            className={cn(
              "text-sage transition-transform duration-300 ease-bloom",
              summaryOpen && "rotate-45",
            )}
          >
            +
          </span>
        </button>
        <div className={cn("lg:block", summaryOpen ? "block" : "hidden")}>
          <OrderSummary
            items={items}
            subtotalAed={subtotalAed}
            zone={zone}
            deliveryFee={deliveryFee}
            totalAed={totalAed}
          />
        </div>
        <div className="mt-6">
          <Button
            variant="primary"
            className="w-full"
            onClick={placeOrder}
            disabled={pending}
          >
            Place Order — {formatAed(totalAed)}
          </Button>
        </div>
      </aside>
    </div>
  );
}
