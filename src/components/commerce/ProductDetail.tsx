"use client";

import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { EASE_BLOOM } from "@/components/motion/constants";
import { Reveal } from "@/components/motion/Reveal";
import { BotanicalPlaceholder } from "@/components/ui/BotanicalPlaceholder";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Monogram } from "@/components/ui/Monogram";
import {
  chipClasses,
  chipOffClasses,
  chipOnClasses,
  fieldClasses,
} from "@/components/ui/form-classes";
import { cn } from "@/lib/cn";
import { itemUnitPrice, useCart } from "@/lib/cart";
import { useToast } from "@/lib/toast";
import {
  addons,
  formatAed,
  sizes,
  timeSlots,
  type AddonId,
  type PlaceholderPalette,
  type Product,
  type SizeId,
} from "@/lib/data";
import { useDeliverySchedule } from "@/lib/useDeliverySchedule";

const GALLERY_SUFFIXES = ["", "-alt", "-detail", "-scale"] as const;

type ProductDetailProps = {
  product: Product;
};

export function ProductDetail({ product }: ProductDetailProps) {
  const { addItem } = useCart();
  const { toast } = useToast();
  const reduced = useReducedMotion();

  /* Gallery: the two real views plus two derived atelier views. */
  const views = useMemo(
    () => [
      product.images[0].placeholder,
      product.images[1].placeholder,
      {
        seed: `${product.images[0].placeholder.seed}-detail`,
        palette: "warm" as PlaceholderPalette,
      },
      {
        seed: `${product.images[1].placeholder.seed}-scale`,
        palette: product.images[0].placeholder.palette,
      },
    ],
    [product],
  );
  const [view, setView] = useState(0);
  const [zoom, setZoom] = useState(false);
  const mainImageRef = useRef<HTMLDivElement>(null);
  /* Cursor-follow zoom is written imperatively — pointer moves must
     never re-render this tree (see brand/motion-spec: no jank). */
  const zoomLayerRef = useRef<HTMLDivElement>(null);

  /* Selections */
  const [sizeId, setSizeId] = useState<SizeId>("standard");
  const [addonIds, setAddonIds] = useState<readonly AddonId[]>([]);
  const [giftMessage, setGiftMessage] = useState("");
  const { now, days, selectedDay, setDay, slot, setSlot, countdown } =
    useDeliverySchedule();

  /* Same pricing rule the cart charges — never a second copy of it. */
  const totalAed = useMemo(
    () => itemUnitPrice({ basePriceAed: product.priceAed, sizeId, addonIds }),
    [product.priceAed, sizeId, addonIds],
  );

  function flyToCart() {
    try {
      const source = mainImageRef.current;
      const target = document.getElementById("header-cart");
      if (!source || !target || reduced) return;
      if (typeof source.animate !== "function") return;
      const from = source.getBoundingClientRect();
      const to = target.getBoundingClientRect();
      const clone = source.cloneNode(true) as HTMLElement;
      Object.assign(clone.style, {
        position: "fixed",
        left: `${from.left}px`,
        top: `${from.top}px`,
        width: `${from.width}px`,
        height: `${from.height}px`,
        margin: "0",
        zIndex: "80",
        pointerEvents: "none",
        borderRadius: "2px",
        overflow: "hidden",
      });
      document.body.appendChild(clone);
      const dx = to.left + to.width / 2 - (from.left + from.width / 2);
      const dy = to.top + to.height / 2 - (from.top + from.height / 2);
      const anim = clone.animate(
        [
          { transform: "translate(0, 0) scale(1)", opacity: 1 },
          { transform: `translate(${dx}px, ${dy}px) scale(0.05)`, opacity: 0.4 },
        ],
        { duration: 650, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" },
      );
      anim.onfinish = () => clone.remove();
      anim.oncancel = () => clone.remove();
      /* Belt and braces — never leave an orphaned clone. */
      setTimeout(() => clone.remove(), 1200);
    } catch {
      /* decorative only — adding to cart must never fail because of it */
    }
  }

  function handleAdd() {
    flyToCart();
    addItem({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: product.images[0].placeholder,
      basePriceAed: product.priceAed,
      sizeId,
      addonIds,
      qty: 1,
      giftMessage: giftMessage.trim() || undefined,
      preferredDay: selectedDay ?? undefined,
      preferredSlot: slot,
    });
    toast(`${product.name} added to your cart`);
  }

  const chipBase = chipClasses;

  return (
    <div className="mx-auto max-w-7xl px-6 pb-28 pt-8 lg:px-8 lg:pb-16 lg:pt-14">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
        {/* ---- Gallery ---- */}
        <div>
          <div
            ref={mainImageRef}
            className="relative aspect-[4/5] cursor-zoom-in overflow-hidden rounded-sm"
            style={{ viewTransitionName: "product-hero" }}
            onMouseEnter={() => setZoom(true)}
            onMouseLeave={() => setZoom(false)}
            onMouseMove={(e) => {
              const layer = zoomLayerRef.current;
              if (!layer) return;
              const r = e.currentTarget.getBoundingClientRect();
              layer.style.transformOrigin = `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}% ${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`;
            }}
          >
            <AnimatePresence initial={false}>
              <motion.div
                key={view}
                className="absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: EASE_BLOOM }}
              >
                <div
                  ref={zoomLayerRef}
                  className="h-full w-full transition-transform duration-300 ease-bloom"
                  style={{
                    transform: zoom && !reduced ? "scale(1.8)" : "scale(1)",
                  }}
                >
                  <BotanicalPlaceholder
                    seed={views[view]?.seed ?? product.images[0].placeholder.seed}
                    palette={views[view]?.palette ?? "warm"}
                  />
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="mt-3 flex gap-3">
            {views.map((v, i) => (
              <button
                key={v.seed + GALLERY_SUFFIXES[i]}
                type="button"
                aria-label={`View ${i + 1}`}
                aria-current={view === i}
                onClick={() => setView(i)}
                className={cn(
                  "aspect-[4/5] w-16 overflow-hidden rounded-sm border transition-colors duration-200 ease-bloom lg:w-20",
                  view === i
                    ? "border-olive"
                    : "border-transparent opacity-70 hover:opacity-100",
                )}
              >
                <BotanicalPlaceholder seed={v.seed} palette={v.palette} />
              </button>
            ))}
          </div>
        </div>

        {/* ---- Details — reveal cascade ---- */}
        <div className="flex flex-col gap-8">
          <Reveal>
            <Eyebrow>The Collection</Eyebrow>
            <div className="mt-2 flex items-baseline justify-between gap-4">
              <h1 className="font-display text-4xl font-light text-olive lg:text-5xl">
                {product.name}
              </h1>
              <p className="shrink-0 text-lg text-olive">{formatAed(totalAed)}</p>
            </div>
            {countdown ? (
              <p className="mt-3 text-sm text-burnt-orange">
                Order within {countdown} for delivery today
              </p>
            ) : (
              now && (
                <p className="mt-3 text-sm text-sage">Order now for delivery tomorrow</p>
              )
            )}
          </Reveal>

          {/* Size */}
          <Reveal delay={0.08}>
            <h2 className="mb-3 font-brand text-xs font-medium uppercase tracking-brand text-sage">
              Size
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {sizes.map((size) => (
                <button
                  key={size.id}
                  type="button"
                  aria-pressed={sizeId === size.id}
                  onClick={() => setSizeId(size.id)}
                  className={cn(
                    chipBase,
                    "flex-col gap-0.5 py-3",
                    sizeId === size.id
                      ? "border-olive bg-cream"
                      : "border-hairline hover:border-sage",
                  )}
                >
                  <span className="font-brand text-[0.6875rem] font-medium uppercase tracking-brand text-olive">
                    {size.name}
                  </span>
                  <span className="text-xs text-sage">
                    {size.priceDeltaAed > 0
                      ? `+${formatAed(size.priceDeltaAed)}`
                      : size.note}
                  </span>
                </button>
              ))}
            </div>
          </Reveal>

          {/* Add-ons */}
          <Reveal delay={0.12}>
            <h2 className="mb-3 font-brand text-xs font-medium uppercase tracking-brand text-sage">
              Add a little more
            </h2>
            <div className="flex flex-wrap gap-3">
              {addons.map((addon) => {
                const on = addonIds.includes(addon.id);
                return (
                  <button
                    key={addon.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setAddonIds((prev) =>
                        on ? prev.filter((id) => id !== addon.id) : [...prev, addon.id],
                      )
                    }
                    className={cn(
                      chipBase,
                      "gap-2",
                      on ? "border-olive bg-cream" : "border-hairline hover:border-sage",
                    )}
                  >
                    <span className="text-sm text-olive">{addon.name}</span>
                    <span className="text-xs text-sage">
                      +{formatAed(addon.priceAed)}
                    </span>
                  </button>
                );
              })}
            </div>
          </Reveal>

          {/* Gift message + live preview */}
          <Reveal delay={0.16}>
            <h2 className="mb-3 font-brand text-xs font-medium uppercase tracking-brand text-sage">
              Gift message
            </h2>
            <textarea
              value={giftMessage}
              onChange={(e) => setGiftMessage(e.target.value.slice(0, 220))}
              rows={3}
              placeholder="Write the words they'll keep…"
              className={fieldClasses}
            />
            <AnimatePresence>
              {giftMessage.trim() && (
                <motion.figure
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4, ease: EASE_BLOOM }}
                  className="mt-4 rounded-sm bg-cream px-6 py-7 shadow-[0_2px_16px_rgba(43,47,27,0.08)]"
                >
                  <blockquote className="whitespace-pre-wrap text-center font-display text-xl font-light italic leading-relaxed text-olive">
                    {giftMessage}
                  </blockquote>
                  <figcaption className="mt-5 flex justify-center">
                    <Monogram className="w-8 text-burnt-orange" />
                  </figcaption>
                </motion.figure>
              )}
            </AnimatePresence>
          </Reveal>

          {/* Delivery */}
          <Reveal delay={0.2}>
            <h2 className="mb-3 font-brand text-xs font-medium uppercase tracking-brand text-sage">
              Delivery day
            </h2>
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              {days.map((day) => (
                <button
                  key={day.key}
                  type="button"
                  disabled={day.disabled}
                  aria-pressed={selectedDay === day.key}
                  onClick={() => setDay(day.key)}
                  className={cn(
                    chipBase,
                    "flex-col gap-0 px-4 py-2",
                    day.disabled && "cursor-not-allowed opacity-40",
                    selectedDay === day.key ? chipOnClasses : chipOffClasses,
                  )}
                >
                  <span className="text-sm text-olive">{day.label}</span>
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
                  className={cn(chipBase, slot === s ? chipOnClasses : chipOffClasses)}
                >
                  <span className="text-sm text-olive">{s}</span>
                </button>
              ))}
            </div>
          </Reveal>

          {/* Desktop add-to-cart */}
          <Reveal delay={0.24} className="hidden lg:block">
            <Button variant="primary" className="w-full" onClick={handleAdd}>
              Add to Cart — {formatAed(totalAed)}
            </Button>
          </Reveal>
        </div>
      </div>

      {/* Sticky mobile bar — thumb zone */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-canvas px-6 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 lg:hidden">
        <Button variant="primary" className="w-full" onClick={handleAdd}>
          Add to Cart — {formatAed(totalAed)}
        </Button>
      </div>
    </div>
  );
}
