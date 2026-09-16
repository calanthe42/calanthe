"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { EASE_BLOOM } from "@/components/motion/constants";
import { Reveal } from "@/components/motion/Reveal";
import { Button } from "@/components/ui/Button";
import { FloralImage } from "@/components/ui/FloralImage";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Monogram } from "@/components/ui/Monogram";
import {
  chipClasses,
  chipOffClasses,
  chipOnClasses,
  fieldClasses,
  labelClasses,
} from "@/components/ui/form-classes";
import { uniqueProductViews } from "@/lib/catalogue";
import { cn } from "@/lib/cn";
import { itemUnitPrice, useCart } from "@/lib/cart";
import { useToast } from "@/lib/toast";
import {
  addons,
  formatAed,
  occasions as occasionNames,
  SAME_DAY_CUTOFF_HOUR,
  sizes,
  timeSlots,
  type AddonId,
  type Product,
  type ProductImage,
  type SizeId,
} from "@/lib/data";
import { useDeliverySchedule } from "@/lib/useDeliverySchedule";

type ProductDetailProps = {
  product: Product;
};

/** Section label inside the purchase column. */
function OptionHeading({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2
      id={id}
      className="mb-3 font-brand text-xs font-medium uppercase tracking-brand text-olive"
    >
      {children}
    </h2>
  );
}

/** "birthday" -> "Birthday", using the catalogue's own names where known. */
function occasionName(slug: string): string {
  return (
    occasionNames.find((o) => o.slug === slug)?.name ??
    slug.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase())
  );
}

export function ProductDetail({ product }: ProductDetailProps) {
  const { addItem } = useCart();
  const { toast } = useToast();
  const reduced = useReducedMotion();

  /**
   * THE GALLERY SHOWS THIS PRODUCT'S OWN PHOTOGRAPHS AND NOTHING ELSE.
   * Duplicates are dropped; a product with one real photograph shows one
   * (see lib/catalogue.ts for why padding with unrelated images was removed).
   */
  const views = useMemo<ProductImage[]>(
    () => uniqueProductViews(product.images),
    [product],
  );

  const [view, setView] = useState(0);
  const [zoom, setZoom] = useState(false);
  const mainImageRef = useRef<HTMLDivElement>(null);
  /* Cursor-follow zoom is written imperatively — pointer moves must never
     re-render this tree (see brand/motion-spec: no jank). */
  const zoomLayerRef = useRef<HTMLDivElement>(null);

  /* Selections */
  const [sizeId, setSizeId] = useState<SizeId>("standard");
  const [addonIds, setAddonIds] = useState<readonly AddonId[]>([]);
  const [giftMessage, setGiftMessage] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const { now, days, selectedDay, setDay, slot, setSlot, countdown } =
    useDeliverySchedule();

  /* Same pricing rule the cart charges — never a second copy of it. */
  const totalAed = useMemo(
    () => itemUnitPrice({ basePriceAed: product.priceAed, sizeId, addonIds }),
    [product.priceAed, sizeId, addonIds],
  );
  const size = sizes.find((s) => s.id === sizeId);

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
      image: product.images[0],
      basePriceAed: product.priceAed,
      sizeId,
      addonIds,
      qty: 1,
      giftMessage: giftMessage.trim() || undefined,
      preferredDay: selectedDay ?? undefined,
      preferredSlot: slot,
      recipientName: recipientName.trim() || undefined,
      recipientPhone: recipientPhone.trim() || undefined,
    });
    toast(`${product.name} added to your cart`);
  }

  const cardDetailsCount = [giftMessage, recipientName, recipientPhone].filter((v) =>
    v.trim(),
  ).length;

  return (
    <div className="mx-auto max-w-7xl gutter pb-32 pt-6 lg:pb-20 lg:pt-12">
      <nav aria-label="Breadcrumb" className="mb-6 lg:mb-10">
        <ol className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
          <li>
            <Link
              href="/shop"
              className="inline-flex min-h-11 items-center underline-offset-4 hover:text-olive hover:underline"
            >
              Shop
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page" className="text-olive">
            {product.name}
          </li>
        </ol>
      </nav>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16 xl:gap-20">
        {/* ---- Gallery: pinned beside the details on desktop, so the
            photograph stays in view while she chooses. ---- */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div
            ref={mainImageRef}
            className="relative aspect-[4/5] cursor-zoom-in overflow-hidden rounded-media bg-cream"
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
                transition={{ duration: 0.6, ease: EASE_BLOOM }}
              >
                <div
                  ref={zoomLayerRef}
                  className="h-full w-full transition-transform duration-500 ease-bloom"
                  style={{ transform: zoom && !reduced ? "scale(1.6)" : "scale(1)" }}
                >
                  <FloralImage
                    image={views[view] ?? product.images[0]}
                    sizes="(max-width: 1024px) 100vw, 58vw"
                    priority
                  />
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* A single-photograph product gets no thumbnail strip: one
              thumbnail under one image is a control that does nothing. */}
          {views.length > 1 && (
            <div className="mt-3 flex gap-3" role="group" aria-label="Photographs">
              {views.map((v, i) => (
                <button
                  key={v.src ?? v.placeholder.seed}
                  type="button"
                  aria-label={`Show photograph ${i + 1} of ${views.length}`}
                  aria-pressed={view === i}
                  onClick={() => setView(i)}
                  className={cn(
                    "aspect-[4/5] w-16 overflow-hidden rounded-media-sm border transition-[opacity,border-color] duration-200 ease-bloom lg:w-20",
                    view === i
                      ? "border-olive"
                      : "border-transparent opacity-60 hover:opacity-100",
                  )}
                >
                  <FloralImage image={v} sizes="80px" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ---- Story, then price and promise, then choices ---- */}
        <div className="flex flex-col">
          <Reveal>
            <Eyebrow>The Collection</Eyebrow>
            <h1 className="mt-3 font-display text-[2.5rem] font-light leading-[1.05] text-olive lg:text-6xl">
              {product.name}
            </h1>
            {product.description && (
              <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-muted">
                {product.description}
              </p>
            )}
            {product.occasions.length > 0 && (
              <p className="mt-4 text-sm text-ink-muted">
                Composed for{" "}
                {product.occasions.map((slug, i) => (
                  <span key={slug}>
                    {i > 0 && (i === product.occasions.length - 1 ? " and " : ", ")}
                    <Link
                      href={`/occasions/${slug}`}
                      className="text-olive underline decoration-hairline underline-offset-4 transition-colors duration-200 ease-bloom hover:decoration-burnt-orange"
                    >
                      {occasionName(slug).toLowerCase()}
                    </Link>
                  </span>
                ))}
                .
              </p>
            )}
          </Reveal>

          <Reveal delay={0.06} className="mt-8 border-y border-hairline py-6">
            <div className="flex items-baseline justify-between gap-4">
              <p className="font-display text-4xl text-olive" aria-live="polite">
                {formatAed(totalAed)}
              </p>
              <p className="text-sm text-ink-muted">
                {size?.name}
                {addonIds.length > 0 &&
                  ` with ${addonIds.length} extra${addonIds.length === 1 ? "" : "s"}`}
              </p>
            </div>
            <ul className="mt-5 flex flex-col gap-2.5 text-base text-olive">
              <li className="flex gap-3">
                <span aria-hidden className="mt-3 h-px w-4 shrink-0 bg-burnt-orange" />
                {countdown ? (
                  <span>Order within {countdown} for delivery today.</span>
                ) : now ? (
                  <span>Order now for delivery tomorrow.</span>
                ) : (
                  <span>
                    Same-day delivery on orders placed before {SAME_DAY_CUTOFF_HOUR}:00.
                  </span>
                )}
              </li>
              <li className="flex gap-3">
                <span aria-hidden className="mt-3 h-px w-4 shrink-0 bg-burnt-orange" />
                <span>
                  A photo or video on WhatsApp for your approval before it leaves.
                </span>
              </li>
              <li className="flex gap-3">
                <span aria-hidden className="mt-3 h-px w-4 shrink-0 bg-burnt-orange" />
                <span>Delivered across all seven Emirates.</span>
              </li>
            </ul>
          </Reveal>

          <div className="mt-8 flex flex-col gap-9">
            {/* Size */}
            <section aria-labelledby="size-heading">
              <OptionHeading id="size-heading">Size</OptionHeading>
              <div className="grid grid-cols-3 gap-2.5">
                {sizes.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={sizeId === s.id}
                    onClick={() => setSizeId(s.id)}
                    className={cn(
                      chipClasses,
                      "flex-col gap-1 px-2 py-3",
                      sizeId === s.id ? chipOnClasses : chipOffClasses,
                    )}
                  >
                    <span className="text-base text-olive">{s.name}</span>
                    <span className="text-xs text-ink-muted">
                      {s.priceDeltaAed > 0 ? `+${formatAed(s.priceDeltaAed)}` : s.note}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            {/* Extras — words, not pictures. The tiles used to carry
                generated botanical art captioned "chocolates" and "teddy
                bear", which showed the customer something that was not the
                thing she was paying for. */}
            <section aria-labelledby="extras-heading">
              <OptionHeading id="extras-heading">Something extra</OptionHeading>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                        "flex min-h-12 items-center gap-3 rounded-sm border px-4 text-left transition-colors duration-200 ease-bloom",
                        on
                          ? "border-olive bg-cream"
                          : "border-hairline hover:border-sage",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded-[2px] border transition-colors duration-200 ease-bloom",
                          on ? "border-olive bg-olive text-cream" : "border-sage",
                        )}
                      >
                        {on && (
                          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5">
                            <path
                              d="M2.5 6.2 5 8.5l4.5-5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.6"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </span>
                      <span className="flex-1 text-base text-olive">{addon.name}</span>
                      <span className="text-sm text-ink-muted">
                        +{formatAed(addon.priceAed)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Delivery */}
            <section aria-labelledby="delivery-heading">
              <OptionHeading id="delivery-heading">Delivery day</OptionHeading>
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
                    <span className="text-sm text-olive">{day.label}</span>
                    <span className="text-xs text-ink-muted">{day.sub}</span>
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
                    className={cn(
                      chipClasses,
                      slot === s ? chipOnClasses : chipOffClasses,
                    )}
                  >
                    <span className="text-sm text-olive">{s}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Card and recipient — optional, so folded until wanted. */}
            <details className="group/card border-y border-hairline">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 [&::-webkit-details-marker]:hidden">
                <span>
                  <span className="block font-brand text-xs font-medium uppercase tracking-brand text-olive">
                    Card and recipient
                  </span>
                  <span className="mt-1 block text-sm text-ink-muted">
                    {cardDetailsCount > 0
                      ? "Added. You can change it at checkout too."
                      : "Optional. Add a handwritten card and who is receiving it."}
                  </span>
                </span>
                <span
                  aria-hidden
                  className="text-xl text-ink-muted transition-transform duration-300 ease-bloom group-open/card:rotate-45"
                >
                  +
                </span>
              </summary>

              <div className="flex flex-col gap-5 pb-6 pt-2">
                <div>
                  <label className={labelClasses} htmlFor="gift-message">
                    Card message
                  </label>
                  <textarea
                    id="gift-message"
                    value={giftMessage}
                    onChange={(e) => setGiftMessage(e.target.value.slice(0, 220))}
                    rows={3}
                    placeholder="Write the words they'll keep…"
                    className={fieldClasses}
                  />
                  <p className="mt-1.5 text-right text-xs text-ink-muted">
                    {giftMessage.length}/220
                  </p>
                  <AnimatePresence>
                    {giftMessage.trim() && (
                      <motion.figure
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.4, ease: EASE_BLOOM }}
                        className="mt-3 rounded-media-sm bg-cream px-6 py-7"
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
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClasses} htmlFor="pd-recipient-name">
                      Recipient name
                    </label>
                    <input
                      id="pd-recipient-name"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      className={fieldClasses}
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label className={labelClasses} htmlFor="pd-recipient-phone">
                      Recipient phone
                    </label>
                    <input
                      id="pd-recipient-phone"
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value)}
                      inputMode="tel"
                      placeholder="050 123 4567"
                      className={fieldClasses}
                      autoComplete="off"
                    />
                  </div>
                </div>
                <p className="-mt-1 text-sm text-ink-muted">
                  Used only to coordinate delivery. The price is never shown to them.
                </p>
              </div>
            </details>

            {/* Desktop add-to-cart */}
            <div className="hidden lg:block">
              <Button variant="primary" className="w-full" onClick={handleAdd}>
                Add to Cart — {formatAed(totalAed)}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky mobile bar — thumb zone, with enough context to act on
          without scrolling back up. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-canvas px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 lg:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg leading-tight text-olive">
              {product.name}
            </p>
            <p className="text-sm text-ink-muted">{formatAed(totalAed)}</p>
          </div>
          <Button variant="primary" className="shrink-0 px-6" onClick={handleAdd}>
            Add to Cart
          </Button>
        </div>
      </div>
    </div>
  );
}
