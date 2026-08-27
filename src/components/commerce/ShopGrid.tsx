"use client";

import { useMemo, useState } from "react";
import { ProductCard } from "@/components/commerce/ProductCard";
import { Monogram } from "@/components/ui/Monogram";
import { cn } from "@/lib/cn";
import { occasions, type OccasionSlug, type Product } from "@/lib/data";

type PriceBand = "all" | "under-500" | "500-750" | "over-750";
type SortKey = "featured" | "price-asc" | "price-desc" | "new";

const priceBands: readonly { id: PriceBand; label: string }[] = [
  { id: "all", label: "Any price" },
  { id: "under-500", label: "Under AED 500" },
  { id: "500-750", label: "AED 500–750" },
  { id: "over-750", label: "AED 750+" },
];

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
};

export function ShopGrid({ products, showOccasionFilter = true }: ShopGridProps) {
  const [occasion, setOccasion] = useState<OccasionSlug | "all">("all");
  const [price, setPrice] = useState<PriceBand>("all");
  const [sort, setSort] = useState<SortKey>("featured");

  const visible = useMemo(() => {
    let list = [...products];
    if (occasion !== "all") {
      list = list.filter((p) => p.occasions.includes(occasion));
    }
    if (price === "under-500") list = list.filter((p) => p.priceAed < 500);
    if (price === "500-750")
      list = list.filter((p) => p.priceAed >= 500 && p.priceAed <= 750);
    if (price === "over-750") list = list.filter((p) => p.priceAed > 750);

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
  }, [products, occasion, price, sort]);

  return (
    <div>
      {/* Quiet text filters */}
      <div className="flex flex-col gap-2 border-b border-t border-hairline py-3">
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
          </div>
        )}
        <div className="no-scrollbar flex items-center gap-5 overflow-x-auto">
          {priceBands.map((band) => (
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
        <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-3 lg:gap-x-6 lg:gap-y-12">
          {visible.map((product, i) => {
            const editorial = i % 7 === 6;
            return (
              <li key={product.id} className={cn(editorial && "col-span-2")}>
                <ProductCard product={product} editorial={editorial} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
