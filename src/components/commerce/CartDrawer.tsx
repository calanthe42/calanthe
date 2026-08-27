"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { EASE_BLOOM } from "@/components/motion/constants";
import { Monogram } from "@/components/ui/Monogram";
import { BotanicalPlaceholder } from "@/components/ui/BotanicalPlaceholder";
import { buttonClasses } from "@/components/ui/Button";
import {
  describeCartItem,
  itemUnitPrice,
  useCart,
  type CartItem as CartItemType,
} from "@/lib/cart";
import { formatAed, FREE_DELIVERY_THRESHOLD_AED } from "@/lib/data";
import { useScrollLock } from "@/lib/useScrollLock";

function QtyStepper({ item }: { item: CartItemType }) {
  const { setQty } = useCart();

  return (
    <div className="flex items-center rounded-sm border border-hairline">
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => setQty(item.key, item.qty - 1)}
        className="flex h-11 w-11 items-center justify-center text-olive transition-opacity duration-200 ease-bloom hover:opacity-60"
      >
        −
      </button>
      <span className="min-w-6 text-center text-sm text-olive">{item.qty}</span>
      <button
        type="button"
        aria-label="Increase quantity"
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

  return (
    <li className="flex gap-4 py-5">
      <div className="aspect-[4/5] w-20 shrink-0 overflow-hidden rounded-media-sm">
        <BotanicalPlaceholder seed={item.image.seed} palette={item.image.palette} />
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
        <p className="text-sm text-sage">{describeCartItem(item)}</p>
        {item.giftMessage && (
          <p className="text-sm italic text-sage">Gift message included</p>
        )}
        <div className="mt-2 flex items-center justify-between">
          <QtyStepper item={item} />
          <button
            type="button"
            onClick={() => removeItem(item.key)}
            className="min-h-11 px-2 text-sm text-sage underline-offset-4 transition-colors duration-200 ease-bloom hover:text-olive hover:underline"
          >
            Remove
          </button>
        </div>
      </div>
    </li>
  );
}

export function CartDrawer() {
  const { items, subtotalAed, isOpen, closeCart } = useCart();
  const remaining = Math.max(0, FREE_DELIVERY_THRESHOLD_AED - subtotalAed);
  const progress = Math.min(1, subtotalAed / FREE_DELIVERY_THRESHOLD_AED);
  useScrollLock(isOpen);

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
            className="fixed inset-y-0 right-0 z-[60] flex w-full max-w-md flex-col bg-canvas pt-[env(safe-area-inset-top)]"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.45, ease: EASE_BLOOM }}
          >
            <header className="flex items-center justify-between border-b border-hairline px-6 py-4">
              <h2 className="font-brand text-sm font-medium uppercase tracking-brand text-olive">
                Your Cart
              </h2>
              <button
                type="button"
                aria-label="Close cart"
                onClick={closeCart}
                className="flex h-11 w-11 items-center justify-center text-olive transition-opacity duration-200 ease-bloom hover:opacity-60"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </header>

            {items.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
                <Monogram className="w-14 text-sage" />
                <p className="font-display text-2xl font-light italic text-olive">
                  Your cart is waiting to bloom.
                </p>
                <Link
                  href="/shop"
                  onClick={closeCart}
                  className={buttonClasses("secondary")}
                >
                  Shop Flowers
                </Link>
              </div>
            ) : (
              <>
                {/* Free delivery progress */}
                <div className="border-b border-hairline px-6 py-4">
                  <p className="text-sm text-sage">
                    {remaining > 0 ? (
                      <>{formatAed(remaining)} away from complimentary delivery</>
                    ) : (
                      <>Your delivery is complimentary</>
                    )}
                  </p>
                  <div className="mt-2 h-px w-full bg-hairline">
                    <div
                      className="h-px bg-burnt-orange transition-transform duration-500 ease-bloom"
                      style={{
                        transform: `scaleX(${progress})`,
                        transformOrigin: "left",
                      }}
                    />
                  </div>
                </div>

                <ul className="flex-1 divide-y divide-hairline overflow-y-auto px-6">
                  {items.map((item) => (
                    <CartLine key={item.key} item={item} />
                  ))}
                </ul>

                <footer className="border-t border-hairline px-6 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-4">
                  <div className="mb-4 flex items-baseline justify-between">
                    <p className="font-brand text-xs font-medium uppercase tracking-brand text-sage">
                      Subtotal
                    </p>
                    <p className="font-display text-2xl text-olive">
                      {formatAed(subtotalAed)}
                    </p>
                  </div>
                  <Link
                    href="/checkout"
                    onClick={closeCart}
                    className={buttonClasses("primary", "w-full")}
                  >
                    Checkout
                  </Link>
                </footer>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
