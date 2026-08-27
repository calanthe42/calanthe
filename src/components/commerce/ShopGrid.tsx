"use client";

import { useMemo, useState } from "react";
import { ProductCard } from "@/components/commerce/ProductCard";
import { Monogram } from "@/components/ui/Monogram";
import { cn } from "@/lib/cn";
import {
  flowerTypes,
  occasions,
  priceBuckets,
  type FlowerType,
  type OccasionSlug,
  type PriceBucketId,
  type Product,
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
          : "text-sage hover:text-olive",
      )}
    >
      {children}
    </button>
  );
}

type ShopGridProps = {
  products: readonly Product[];
  /** Hide the occasion row when the page itself is an occasion. */
  showOccasionFilter?: boolean;
  initialQuery?: string;
  initialFlower?: string;
  initialPrice?: string;
};

export function ShopGrid({
  products,
  showOccasionFilter = true,
  initialQuery = "",
  initialFlower = "",
  initialPrice = "",
}: ShopGridProps) {
  const [occasion, setOccasion] = useState<OccasionSlug | "all">("all");
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

  const visible = useMemo(() => {
    let list = [...products];
    if (query) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.flowers.some((f) => f.includes(query)),
      );
    }
    if (occasion !== "all") {
      list = list.filter((p) => p.occasions.includes(occasion));
    }
    if (flower !== "all") {
      list = list.filter((p) => p.flowers.includes(flower));
    }
    if (price !== "all") {
      const bucket = priceBuckets.find((b) => b.id === price);
      if (bucket) {
        list = list.filter(
          (p) => p.priceAed >= bucket.min && p.priceAed <= bucket.max,
        );
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
  }, [products, query, occasion, flower, price, sort]);

  return (
    <div>
      {query && (
        <p className="mb-4 text-sm text-sage">
          Results for &ldquo;{initialQuery.trim()}&rdquo;
        </p>
      )}

      {/* Quiet text filters */}
      <div className="flex flex-col gap-1 border-b border-t border-hairline py-3">
        {showOccasionFilter && (
          <div className="no-scrollbar flex gap-5 overflow-x-auto">
            <FilterButton active={occasion === "all"} onClick={() => setOccasion("all")}>
              All
            </FilterButton>
            {occasions.map((o) => (
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
        <div className="flex flex-col items-center gap-5 py-24 text-center">
          <Monogram className="w-14 text-sage" />
          <p className="font-display text-2xl font-light italic text-olive">
            Nothing blooms here yet.
          </p>
          <p className="max-w-xs text-sm text-sage">
            No arrangements match those choices — try softening a filter.
          </p>
        </div>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-9 lg:grid-cols-4 lg:gap-x-5 lg:gap-y-10">
          {visible.map((product) => (
            <li key={product.id}>
              <ProductCard product={product} showView />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
