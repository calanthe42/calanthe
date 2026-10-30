import type { Translator } from "@admin/i18n/translate";
import type { CostItemRow, CostSource, OneUnit } from "@backend/domain/costs";

/**
 * How what she buys reads on screen, in one place — What you buy, the
 * invoice editor, Money and the product editor's Cost section all say "a
 * bunch of 20", "AED 3.23 a stem" and "last paid 26 Oct, Al Aweer" the same
 * way, in either language.
 *
 * Plain functions over the translator, so a Server Component (with
 * getAdminI18n) and a Client Component (with useI18n) share them.
 */

type Words = Pick<Translator, "t" | "plural" | "money" | "number" | "date">;

/**
 * How things come, as the editors offer them. `packName` is stored as text,
 * so an older or imported word still reads ("a crate of 10"), but these are
 * the ones she picks from.
 */
export const PACK_NAMES = ["bunch", "box", "roll", "carton", "single"] as const;
export type PackName = (typeof PACK_NAMES)[number];

export const isPackName = (value: unknown): value is PackName =>
  typeof value === "string" && (PACK_NAMES as readonly string[]).includes(value);

/** A stored pack word as one of hers: "Bunch" and "bunches" are a bunch. Empty is single. */
export function packNameOf(raw: string | null | undefined): PackName | null {
  const word = (raw ?? "").trim().toLowerCase();
  if (word === "") return "single";
  if (isPackName(word)) return word;
  const singular = word.replace(/(es|s)$/, "");
  return isPackName(singular) ? singular : null;
}

/** "AED 3.23 a stem". A price for one may carry fractions of a fils; money() rounds for display only. */
export function perOneText(i18n: Pick<Words, "t" | "money">, fils: number, one: OneUnit): string {
  return i18n.t(`costs.perOne.${one}`, { amount: i18n.money(fils) });
}

/** "24 stems", "1.5 metres". */
export function countText(i18n: Pick<Words, "plural">, count: number, one: OneUnit): string {
  return i18n.plural(`costs.count.${one}`, count);
}

/** "a bunch of 20", "single stems", "by the metre". */
export function comesAsText(
  i18n: Pick<Words, "t" | "number">,
  row: Pick<CostItemRow, "packName" | "unitsPerPack" | "one">,
): string {
  const pack = packNameOf(row.packName);
  if (pack === "single") return i18n.t(`costs.comesSingly.${row.one}`);
  const count = i18n.number(row.unitsPerPack);
  if (pack === null) return i18n.t("costs.comesAs.other", { pack: row.packName?.trim() ?? "", count });
  return i18n.t(`costs.comesAs.${pack}`, { count });
}

/** Where a price came from: her latest invoice line, or typed by her. */
type PriceSource = { costSource: CostSource; lastPaidAt: string | null; lastSupplier: { name: string } | null };

/** "last paid 26 Oct, Al Aweer", or "typed by you". */
export function whereFromText(i18n: Pick<Words, "t" | "date">, row: PriceSource): string {
  if (row.costSource === "invoice" && row.lastPaidAt) {
    const date = i18n.date(row.lastPaidAt, "short");
    return row.lastSupplier
      ? i18n.t("costs.lastPaid", { date, supplier: row.lastSupplier.name })
      : i18n.t("costs.lastPaidOn", { date });
  }
  return i18n.t("costs.typed");
}

/** "AED 3.23 a stem, last paid 26 Oct, Al Aweer", or "no price yet". */
export function priceLineText(
  i18n: Pick<Words, "t" | "money" | "date">,
  row: Pick<CostItemRow, "priceForOneFils" | "one"> & PriceSource,
): string {
  if (row.priceForOneFils === null) return i18n.t("costs.noPrice");
  /* The comma is the dictionary's: Arabic writes "،". */
  return i18n.t("costs.priceLine", {
    price: perOneText(i18n, row.priceForOneFils, row.one),
    where: whereFromText(i18n, row),
  });
}

/**
 * The "of every AED 100" number, to one decimal and no ".0": 20.2, 6, 0.4.
 * One decimal, not whole numbers, so 33.4 never reads as "33" beside an
 * amber "Watch" when the guide is 33 or less.
 */
export function per100Number(number: Translator["number"], value: number): string {
  return number(Math.round(value * 10) / 10);
}

/**
 * Money that may be below zero — an arrangement sold at a loss, a month that
 * spent more than it took. The translator's money() never prints a negative
 * amount (an order total cannot be one), so the sign is put in front here.
 */
export function signedMoney(money: Translator["money"], fils: number): string {
  return fils < 0 ? `−${money(-fils)}` : money(fils);
}

/** A fils amount as the plain number an AED input shows: 48000 → "480", 362.5 → "3.625". */
export function filsToAedInput(fils: number | null | undefined): string {
  if (typeof fils !== "number" || !Number.isFinite(fils) || fils <= 0) return "";
  return String(Math.round(fils * 100) / 10000);
}
