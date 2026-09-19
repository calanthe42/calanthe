"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { EASE_BLOOM } from "@/components/motion/constants";
import { Monogram } from "@/components/ui/Monogram";
import { FloralImage } from "@/components/ui/FloralImage";
import { Button, ButtonLink } from "@/components/ui/Button";
import {
  describeCartItem,
  itemUnitPrice,
  useCart,
  type CartItem as CartItemType,
} from "@/lib/cart";
import { addons, formatAed, FREE_DELIVERY_THRESHOLD_AED } from "@/lib/data";
import { useLocale, useT } from "@/lib/locale";
import { useScrollLock } from "@/lib/useScrollLock";

function QtyStepper({ item }: { item: CartItemType }) {
  const { setQty } = useCart();
  const t = useT();
  /* One is the floor. Below it the reducer removes the line, which is a
     different and destructive act — it should be reached through "Remove",
     deliberately, not by pressing minus one more time than intended. */
  const atFloor = item.qty <= 1;

  return (
    <div className="flex items-center rounded-sm border border-hairline">
      <button
        type="button"
        aria-label={t.cart.decrease.replace("{name}", item.name)}
        disabled={atFloor}
        onClick={() => setQty(item.key, item.qty - 1)}
        className="flex h-11 w-11 items-center justify-center text-olive transition-opacity duration-200 ease-bloom hover:opacity-60 disabled:pointer-events-none disabled:opacity-30"
      >
        −
      </button>
      <span
        aria-live="polite"
        aria-label={t.cart.quantity.replace("{n}", String(item.qty))}
        className="min-w-6 text-center text-sm tabular-nums text-olive"
      >
        {item.qty}
      </span>
      <button
        type="button"
        aria-label={t.cart.increase.replace("{name}", item.name)}
        onClick={() => setQty(item.key, item.qty + 1)}
        className="flex h-11 w-11 items-center justify-center text-olive transition-opacity duration-200 ease-bloom hover:opacity-60"
      >
        +
      </button>
    </div>
  );
}

function CartLine({ item }: { item: CartItemType }) {
  const { removeItem } = useCart();
  const t = useT();

  return (
    <li className="flex gap-4 py-5">
      <div className="aspect-[4/5] w-20 shrink-0 overflow-hidden rounded-media-sm">
        <FloralImage image={item.image} sizes="80px" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <Link
            href={`/product/${item.slug}`}
            className="truncate font-display text-lg text-olive"
          >
            {item.name}
          </Link>
          <p className="shrink-0 text-sm text-olive">
            {formatAed(itemUnitPrice(item) * item.qty)}
          </p>
        </div>
        <p className="text-sm text-ink-muted">{describeCartItem(item)}</p>
        {item.giftMessage && (
          <p className="text-sm italic text-ink-muted">{t.cart.giftMessageIncluded}</p>
        )}
        <div className="mt-2 flex items-center justify-between">
          <QtyStepper item={item} />
          <Button
            variant="text"
            onClick={() => removeItem(item.key)}
            aria-label={t.cart.removeItem.replace("{name}", item.name)}
            className="px-2"
          >
            {t.cart.remove}
          </Button>
        </div>
      </div>
    </li>
  );
}

function CompleteTheGift() {
  const { items, addAddonToItem } = useCart();
  const t = useT();
  const last = items[items.length - 1];
  if (!last) return null;
  const suggestions = addons.filter((a) => !last.addonIds.includes(a.id)).slice(0, 3);
  if (suggestions.length === 0) return null;

  return (
    <div className="border-t border-hairline px-6 py-4">
      <p className="mb-3 font-brand text-[0.625rem] font-medium uppercase tracking-brand text-ink-muted">
        {t.cart.completeTheGift}
      </p>
      {/* Named, priced choices rather than image tiles: the add-ons have no
          photographs, and generated art captioned "chocolates" showed
          something other than what was being added. */}
      <ul className="flex flex-col gap-2">
        {suggestions.map((addon) => (
          <li key={addon.id}>
            <button
              type="button"
              onClick={() => addAddonToItem(last.key, addon.id)}
              aria-label={`Add ${addon.name} to ${last.name}, ${formatAed(addon.priceAed)}`}
              className="flex min-h-11 w-full items-center justify-between gap-3 rounded-sm border border-hairline px-4 text-left transition-colors duration-200 ease-bloom hover:border-sage"
            >
              <span className="text-sm text-olive">{addon.name}</span>
              <span className="text-sm text-ink-muted">+{formatAed(addon.priceAed)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CartDrawer() {
  const { items, subtotalAed, isOpen, closeCart, hydrated, droppedCount } = useCart();
  /* THE DRAWER ENTERS FROM THE READING EDGE. It was pinned to `right-0` and
     slid in from +100%, which is correct in English and backwards in Arabic:
     the cart button sits top-start in RTL, so the panel was flying out from
     under the opposite corner. */
  const { dir } = useLocale();
  const t = useT();
  const fromEnd = dir === "rtl" ? "-100%" : "100%";
  const remaining = Math.max(0, FREE_DELIVERY_THRESHOLD_AED - subtotalAed);
  const progress = Math.min(1, subtotalAed / FREE_DELIVERY_THRESHOLD_AED);
  useScrollLock(isOpen);

  /* Escape closes it, like every other overlay on the site. Without this the
     drawer stayed open on Escape AND kept the scroll lock, so the page sat
     frozen behind it until the visitor found the X — the exact "page won't
     scroll" fault, reached through the cart rather than the menu. */
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCart();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, closeCart]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.button
            type="button"
            aria-label="Close cart"
            onClick={closeCart}
            className="fixed inset-0 z-50 bg-olive/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE_BLOOM }}
          />
          <motion.aside
            role="dialog"
            aria-label="Cart"
            className="fixed inset-y-0 end-0 z-[60] flex w-full max-w-md flex-col bg-canvas pt-[env(safe-area-inset-top)]"
            initial={{ x: fromEnd }}
            animate={{ x: 0 }}
            exit={{ x: fromEnd }}
            transition={{ duration: 0.45, ease: EASE_BLOOM }}
          >
            <header className="flex items-center justify-between border-b border-hairline px-6 py-4">
              <h2 className="font-brand text-sm font-medium uppercase tracking-brand text-olive">
                {t.cart.title}
              </h2>
              <Button
                variant="quiet"
                size="icon"
                aria-label={t.cart.close}
                onClick={closeCart}
                className="-me-2"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </Button>
            </header>

            {!hydrated ? (
              /* NOT-YET-KNOWN IS NOT EMPTY. The basket lives in localStorage
                 and is read in an effect, so the first paint always has zero
                 lines — a returning customer used to meet "your cart is
                 waiting to bloom" for a frame before her flowers appeared.
                 Shaped like the lines that are coming, not a spinner. */
              <ul className="flex-1 divide-y divide-hairline px-6" aria-hidden>
                {[0, 1].map((i) => (
                  <li key={i} className="flex gap-4 py-5">
                    <div className="aspect-[4/5] w-20 shrink-0 animate-pulse rounded-media-sm bg-cream" />
                    <div className="flex flex-1 flex-col gap-2 pt-1">
                      <div className="h-4 w-2/3 animate-pulse rounded-sm bg-cream" />
                      <div className="h-3 w-1/2 animate-pulse rounded-sm bg-cream/70" />
                      <div className="mt-3 h-10 w-28 animate-pulse rounded-sm bg-cream/60" />
                    </div>
                  </li>
                ))}
              </ul>
            ) : items.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
                <Monogram className="w-14 text-ink-muted" />
                <p className="font-display text-2xl font-light italic text-olive">
                  {t.cart.empty}
                </p>
                <div className="flex w-full max-w-xs flex-col gap-3">
                  <ButtonLink
                    href="/shop"
                    onClick={closeCart}
                    className="whitespace-nowrap"
                  >
                    {t.cart.shopFlowers}
                  </ButtonLink>
                  <ButtonLink
                    href="/build-your-own"
                    variant="secondary"
                    onClick={closeCart}
                    className="whitespace-nowrap"
                  >
                    {t.cart.buildYourOwn}
                  </ButtonLink>
                </div>
              </div>
            ) : (
              <>
                {droppedCount > 0 && (
                  /* The sanitiser drops lines whose product has left the
                     catalogue. Doing that silently means a basket that is
                     smaller than the customer left it, for no stated reason. */
                  <p
                    role="status"
                    className="border-b border-hairline bg-cream/60 px-6 py-3 text-sm leading-relaxed text-ink-muted"
                  >
                    {droppedCount === 1
                      ? t.cart.droppedOne
                      : t.cart.droppedMany.replace("{n}", String(droppedCount))}
                  </p>
                )}

                {/* Free delivery progress */}
                <div className="border-b border-hairline px-6 py-4">
                  <p className="text-sm text-ink-muted">
                    {remaining > 0
                      ? t.cart.freeDeliveryAway.replace("{amount}", formatAed(remaining))
                      : t.cart.freeDeliveryReached}
                  </p>
                  <div className="mt-2 h-px w-full bg-hairline">
                    <div
                      className="h-px bg-burnt-orange transition-transform duration-500 ease-bloom"
                      style={{
                        transform: `scaleX(${progress})`,
                        /* Grows from the reading edge, not always from the
                           physical left. */
                        transformOrigin: dir === "rtl" ? "right" : "left",
                      }}
                    />
                  </div>
                </div>

                <ul className="flex-1 divide-y divide-hairline overflow-y-auto px-6">
                  {items.map((item) => (
                    <CartLine key={item.key} item={item} />
                  ))}
                </ul>

                <CompleteTheGift />

                {/*
                  THE FOOTER SAYS WHAT IS AND IS NOT SETTLED.

                  It used to show one figure labelled "Subtotal" above a
                  Checkout button, which invites the reader to treat it as the
                  amount due. The delivery fee depends on the emirate and is
                  not known until checkout, so the honest thing is to name
                  that — and to say when delivery is already free, which is
                  the one case where the subtotal IS the total.
                */}
                <footer className="border-t border-hairline px-6 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-4">
                  <div className="flex items-baseline justify-between">
                    <p className="font-brand text-xs font-medium uppercase tracking-brand text-ink-muted">
                      {t.cart.subtotal}
                    </p>
                    <p className="font-display text-2xl text-olive">
                      {formatAed(subtotalAed)}
                    </p>
                  </div>
                  <div className="mt-1.5 flex items-baseline justify-between gap-3 border-t border-hairline/60 pt-2.5">
                    <p className="text-sm text-ink-muted">{t.cart.delivery}</p>
                    <p className="text-sm text-ink-muted">
                      {remaining > 0 ? (
                        t.cart.deliveryAtCheckout
                      ) : (
                        <span className="text-olive">{t.cart.deliveryFree}</span>
                      )}
                    </p>
                  </div>

                  <ButtonLink
                    href="/checkout"
                    onClick={closeCart}
                    className="mt-4 w-full"
                  >
                    {t.cart.checkout}
                  </ButtonLink>
                  <Button
                    variant="text"
                    onClick={closeCart}
                    className="mt-1 w-full"
                  >
                    {t.cart.continueShopping}
                  </Button>
                </footer>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
