import { describe, expect, it } from "vitest";
import { priceLine } from "@backend/domain/pricing";
import {
  cartSaleOf,
  itemRegularUnitFils,
  itemRegularUnitPrice,
  itemUnitFils,
  itemUnitPrice,
} from "./cart-pricing";
import { sizes, type AddonId, type ProductSale, type SizeId } from "./data";
import type { SaleRule } from "./discounts";
import { DEFAULT_ADDONS, type StoreAddon } from "./store-settings";
import type { Product } from "@/payload-types";

/**
 * THE BASKET AND THE SERVER MUST NAME THE SAME PRICE.
 *
 * The browser shows a line with `itemUnitFils`; the server charges it with
 * `priceLine`. They share the sale arithmetic (lib/discounts.ts), but each
 * assembles the line itself — base, size uplift, add-ons — so this pins the
 * two together across every size, with and without add-ons, with each kind
 * of sale. If they ever part, checkout answers PRICE_CHANGED for every
 * customer; this fails first.
 *
 * Both sides are handed the SAME add-on list, as they are in the shop (the
 * owner's list, read once by the layout and once by the checkout). It is her
 * defaults plus one with an odd price, so a rounding difference would show.
 */

const product = (priceFils: number): Product =>
  ({
    id: 7,
    name: "Amber Hour",
    slug: "amber-hour",
    priceFils,
    available: true,
    category: "bouquet",
    occasions: [],
  }) as unknown as Product;

const rule = (terms: Partial<SaleRule>): SaleRule => ({
  id: "3",
  title: "internal",
  labelEn: "Eid offer",
  labelAr: "عرض العيد",
  appliesTo: "all",
  productIds: [],
  occasionIds: [],
  categories: [],
  valueType: "percentage",
  percentOff: 20,
  amountOffFils: 0,
  active: true,
  ...terms,
});

const productSale = (r: SaleRule): ProductSale => ({
  id: r.id,
  label: { en: r.labelEn, ar: r.labelAr },
  valueType: r.valueType,
  percentOff: r.percentOff,
  amountOffFils: r.amountOffFils,
  priceAed: 0,
});

const LIST: StoreAddon[] = [
  ...DEFAULT_ADDONS,
  { key: "silk-ribbon", nameEn: "Silk ribbon", nameAr: "شريط حرير", priceFils: 1_275, active: true },
];
const SIZE_IDS = sizes.map((s) => s.id) as SizeId[];
const ADDON_SETS: AddonId[][] = [[], [LIST[0]!.key], LIST.slice(0, 3).map((a) => a.key), ["silk-ribbon", "vase"]];
const BASES = [48_000, 65_000, 39_050, 35_000];
const RULES: (SaleRule | null)[] = [
  null,
  rule({ valueType: "percentage", percentOff: 20 }),
  rule({ valueType: "percentage", percentOff: 15 }),
  rule({ valueType: "percentage", percentOff: 90 }),
  rule({ valueType: "fixed", percentOff: 0, amountOffFils: 10_000 }),
  rule({ valueType: "fixed", percentOff: 0, amountOffFils: 5_050 }),
  /* Deeper than the price: capped at 90% on both sides. */
  rule({ valueType: "fixed", percentOff: 0, amountOffFils: 90_000 }),
];

describe("the basket prices a line exactly as the server does", () => {
  for (const base of BASES) {
    for (const sizeId of SIZE_IDS) {
      for (const addonIds of ADDON_SETS) {
        for (const sale of RULES) {
          const name = `${base} fils · ${sizeId} · ${addonIds.length} add-ons · ${
            sale ? `${sale.valueType} ${sale.percentOff || sale.amountOffFils}` : "no sale"
          }`;
          it(name, () => {
            const server = priceLine(
              { productId: "7", quantity: 2, sizeId, addonIds },
              product(base),
              sale,
              LIST,
            );
            const selection = {
              basePriceAed: base / 100,
              sizeId,
              addonIds,
              sale: sale ? cartSaleOf(productSale(sale)) : undefined,
            };
            expect(itemUnitFils(selection, LIST)).toBe(server.unitPriceFils);
            /* The struck-through price is the server's compare-at price. */
            if (server.compareAtUnitPriceFils !== null) {
              expect(itemRegularUnitFils(selection, LIST)).toBe(server.compareAtUnitPriceFils);
            } else {
              expect(itemRegularUnitFils(selection, LIST)).toBe(server.unitPriceFils);
            }
          });
        }
      }
    }
  }
});

describe("cart pricing", () => {
  it("lowers the arrangement and the size uplift, never the add-ons", () => {
    const deluxe = sizes.find((s) => s.id === "deluxe")!;
    const vase = LIST[0]!;
    const selection = {
      basePriceAed: 480,
      sizeId: "deluxe" as SizeId,
      addonIds: [vase.key],
      sale: cartSaleOf(productSale(rule({ percentOff: 20 }))),
    };
    const arrangement = (480 + deluxe.priceDeltaAed) * 100;
    expect(itemUnitFils(selection, LIST)).toBe(Math.floor((arrangement * 80) / 10000) * 100 + vase.priceFils);
    expect(itemRegularUnitFils(selection, LIST)).toBe(arrangement + vase.priceFils);
  });

  it("prices an add-on at whatever the list it is given says", () => {
    const selection = { basePriceAed: 480, sizeId: "standard" as SizeId, addonIds: ["vase"] };
    const repriced = LIST.map((a) => (a.key === "vase" ? { ...a, priceFils: 16_000 } : a));
    expect(itemUnitFils(selection, LIST)).toBe(48_000 + 15_000);
    expect(itemUnitFils(selection, repriced)).toBe(48_000 + 16_000);
  });

  it("speaks dirhams where the page still does", () => {
    const selection = { basePriceAed: 480, sizeId: "standard" as SizeId, addonIds: [] };
    expect(itemUnitPrice(selection, LIST)).toBe(480);
    expect(itemRegularUnitPrice(selection, LIST)).toBe(480);
  });

  it("keeps only the label and the terms of a sale — no price, no end date", () => {
    const kept = cartSaleOf({
      ...productSale(rule({})),
      priceAed: 384,
      endsAt: "2026-10-10T19:59:00.000Z",
    });
    expect(kept).toEqual({
      id: "3",
      label: { en: "Eid offer", ar: "عرض العيد" },
      valueType: "percentage",
      percentOff: 20,
      amountOffFils: 0,
    });
    expect(cartSaleOf(undefined)).toBeUndefined();
  });
});
