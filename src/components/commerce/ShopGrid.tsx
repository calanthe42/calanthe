"use client";

import { useMemo, useState } from "react";
import { ProductCard } from "@/components/commerce/ProductCard";
import { Monogram } from "@/components/ui/Monogram";
import { cn } from "@/lib/cn";
import {
  flowerTypes,
  occasions,
  priceBuckets,
  productCategoryNames,
  type FlowerType,
  type PriceBucketId,
  type Product,
  type ProductCategory,
} from "@/lib/data";

type SortKey = "featured" | "price-asc" | "price-desc" | "new";

const sortKeys: readonly { id: SortKey; label: string }[] = [
  { id: "featured", label: "Featured" },
  { id: "new", label: "New" },
  { id: "price-asc", label: "Price, low to high" },
  { id: "price-desc", label: "Price, high to low" },
];

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-11 whitespace-nowrap px-1 font-brand text-[0.6875rem] font-medium uppercase tracking-brand transition-colors duration-200 ease-bloom",
        active
          ? "text-olive underline decoration-burnt-orange underline-offset-8"
          : "text-ink-muted hover:text-olive",
      )}
    >
      {children}
    </button>
  );
}

/** A category in the shop's primary navigation row. */
function CategoryTab({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "group/tab relative flex min-h-11 shrink-0 items-baseline gap-1.5 whitespace-nowrap font-display text-xl font-light transition-colors duration-200 ease-bloom lg:text-2xl",
        active ? "text-olive" : "text-ink-muted hover:text-olive",
      )}
    >
      {label}
      <span className="font-sans text-[0.625rem] tracking-normal text-ink-muted">
        {count}
      </span>
      {/* The house hover grammar: a hairline drawing in, not a filled pill. */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-x-0 bottom-1 h-px origin-left bg-burnt-orange transition-transform duration-300 ease-bloom",
          active ? "scale-x-100" : "scale-x-0 group-hover/tab:scale-x-100",
        )}
      />
    </button>
  );
}

type ShopGridProps = {
  products: readonly Product[];
  /**
   * The occasions to offer as filters. Passed in from the page so the chips
   * are whatever the owner has created in /admin — the static list in
   * lib/data.ts is only a fallback for callers that have no database read of
   * their own, and an occasion added in the admin would never have appeared
   * in it.
   */
  occasions?: readonly { slug: string; name: string }[];
  /** Hide the occasion row when the page itself is an occasion. */
  showOccasionFilter?: boolean;
  initialQuery?: string;
  initialFlower?: string;
  initialPrice?: string;
};

export function ShopGrid({
  products,
  occasions: occasionOptions = occasions,
  showOccasionFilter = true,
  initialQuery = "",
  initialFlower = "",
  initialPrice = "",
}: ShopGridProps) {
  const [category, setCategory] = useState<ProductCategory | "all">("all");
  const [occasion, setOccasion] = useState<string>("all");
  const [flower, setFlower] = useState<FlowerType | "all">(
    flowerTypes.some((f) => f.slug === initialFlower)
      ? (initialFlower as FlowerType)
      : "all",
  );
  const [price, setPrice] = useState<PriceBucketId | "all">(
    priceBuckets.some((b) => b.id === initialPrice)
      ? (initialPrice as PriceBucketId)
      : "all",
  );
  const [sort, setSort] = useState<SortKey>("featured");
  const query = initialQuery.trim().toLowerCase();

  /*
   * THE CATEGORY ROW IS THE CATALOGUE'S OWN.
   *
   * Not a merchandising list written in code: these are the distinct
   * `category` values of the products actually on sale, in the schema's own
   * order, each with a live count. Add a product in /admin and choose
   * "Plant" and Plants appears here on the next revalidate; sell the last
   * one and it disappears. Nothing to keep in sync, and no tab that leads
   * to an empty grid.
   */
  const categoryOptions = useMemo(() => {
    const counts = new Map<ProductCategory, number>();
    for (const p of products) {
      if (!p.category) continue;
      counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    }
    return (Object.keys(productCategoryNames) as ProductCategory[])
      .filter((id) => counts.has(id))
      .map((id) => ({ id, name: productCategoryNames[id], count: counts.get(id) ?? 0 }));
  }, [products]);

  const visible = useMemo(() => {
    let list = [...products];
    if (query) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.flowers.some((f) => f.includes(query)),
      );
    }
    if (category !== "all") {
      list = list.filter((p) => p.category === category);
    }
    if (occasion !== "all") {
      list = list.filter((p) => (p.occasions as readonly string[]).includes(occasion));
    }
    if (flower !== "all") {
      list = list.filter((p) => p.flowers.includes(flower));
    }
    if (price !== "all") {
      const bucket = priceBuckets.find((b) => b.id === price);
      if (bucket) {
        list = list.filter((p) => p.priceAed >= bucket.min && p.priceAed <= bucket.max);
      }
    }

    switch (sort) {
      case "price-asc":
        list.sort((a, b) => a.priceAed - b.priceAed);
        break;
      case "price-desc":
        list.sort((a, b) => b.priceAed - a.priceAed);
        break;
      case "new":
        list.sort((a, b) => Number(b.newArrival) - Number(a.newArrival));
        break;
      case "featured":
        list.sort((a, b) => Number(b.featured) - Number(a.featured));
        break;
    }
    return list;
  }, [products, query, category, occasion, flower, price, sort]);

  return (
    <div>
      {query && (
        <p className="mb-4 text-sm text-ink-muted">
          Results for &ldquo;{initialQuery.trim()}&rdquo;
        </p>
      )}

      {/*
        CATEGORY NAVIGATION — the primary way into the catalogue, and
        deliberately a tier above the filters beneath it.

        Shop used to open straight onto an undifferentiated grid with three
        rows of equal-weight text filters over it, which is how a catalogue
        reads as a placeholder. Category is what a customer actually browses
        by, so it is set in the display face at a readable size with a live
        count, and the occasion/flower/price/sort controls stay small and
        quiet underneath — a hierarchy rather than four rows of the same
        thing.
      */}
      {categoryOptions.length > 1 && (
        <nav
          aria-label="Product categories"
          className="no-scrollbar -mx-[--gutter] mb-1 flex gap-7 overflow-x-auto px-[--gutter] lg:mx-0 lg:px-0"
        >
          <CategoryTab
            active={category === "all"}
            onClick={() => setCategory("all")}
            label="All"
            count={products.length}
          />
          {categoryOptions.map((c) => (
            <CategoryTab
              key={c.id}
              active={category === c.id}
              onClick={() => setCategory(c.id)}
              label={c.name}
              count={c.count}
            />
          ))}
        </nav>
      )}

      {/* Quiet text filters */}
      <div className="flex flex-col gap-1 border-b border-t border-hairline py-3">
        {showOccasionFilter && (
          <div className="no-scrollbar flex gap-5 overflow-x-auto">
            <FilterButton active={occasion === "all"} onClick={() => setOccasion("all")}>
              All
            </FilterButton>
            {occasionOptions.map((o) => (
              <FilterButton
                key={o.slug}
                active={occasion === o.slug}
                onClick={() => setOccasion(o.slug)}
              >
                {o.name}
              </FilterButton>
            ))}
            <span aria-hidden className="my-auto h-4 w-px shrink-0 bg-hairline" />
            {flowerTypes.map((f) => (
              <FilterButton
                key={f.slug}
                active={flower === f.slug}
                onClick={() => setFlower(flower === f.slug ? "all" : f.slug)}
              >
                {f.name}
              </FilterButton>
            ))}
          </div>
        )}
        <div className="no-scrollbar flex items-center gap-5 overflow-x-auto">
          <FilterButton active={price === "all"} onClick={() => setPrice("all")}>
            Any price
          </FilterButton>
          {priceBuckets.map((band) => (
            <FilterButton
              key={band.id}
              active={price === band.id}
              onClick={() => setPrice(band.id)}
            >
              {band.label}
            </FilterButton>
          ))}
          <span aria-hidden className="h-4 w-px shrink-0 bg-hairline" />
          {sortKeys.map((key) => (
            <FilterButton
              key={key.id}
              active={sort === key.id}
              onClick={() => setSort(key.id)}
            >
              {key.label}
            </FilterButton>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        /* An empty result is a dead end unless it hands back a way out, so
           this one names what was searched for and offers the single action
           that always works: clear everything. */
        <div className="flex flex-col items-center gap-5 py-24 text-center">
          <Monogram className="w-14 text-hairline" />
          <p className="font-display text-2xl font-light italic text-olive">
            {query
              ? `No arrangements found for “${initialQuery.trim()}”.`
              : "Nothing blooms here yet."}
          </p>
          <p className="max-w-sm text-base text-ink-muted">
            Try a different occasion, flower or price — or look through the
            whole collection.
          </p>
          <button
            type="button"
            onClick={() => {
              setCategory("all");
              setOccasion("all");
              setFlower("all");
              setPrice("all");
            }}
            className="inline-flex min-h-11 items-center font-brand text-xs font-medium uppercase tracking-brand text-olive underline decoration-hairline underline-offset-8 transition-colors duration-200 ease-bloom hover:decoration-burnt-orange"
          >
            Explore all arrangements
          </button>
        </div>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-9 lg:grid-cols-4 lg:gap-x-5 lg:gap-y-10">
          {visible.map((product) => (
            <li key={product.id}>
              {/* Two columns on a phone, four on desktop — say so, or
                  every phone downloads a near-full-width image for a
                  half-width slot. */}
              <ProductCard
                product={product}
                showView
                sizes="(max-width: 1024px) 46vw, 23vw"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
