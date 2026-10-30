import type { Translator } from "@admin/i18n/translate";
import type { CostItemRow, UseUnit } from "@backend/domain/costs";

/**
 * How a flower or material reads on screen, in one place — the library list,
 * its edit page and the product editor's Cost section all say "AED 3.61 a
 * stem" and "Bunch of 20 stems" the same way, in either language.
 *
 * Plain functions over the translator, so a Server Component (with
 * getAdminI18n) and a Client Component (with useI18n) share them.
 */

type Words = Pick<Translator, "t" | "plural" | "money">;

/** "AED 3.61 a stem". A unit cost may carry fractions of a fils; money() rounds for display only. */
export function perUnitText(i18n: Words, fils: number, unit: UseUnit): string {
  return i18n.t(`costs.items.perUnit.${unit}`, { amount: i18n.money(fils) });
}

/** "24 stems", "1.5 metres". */
export function unitCountText(i18n: Words, count: number, unit: UseUnit): string {
  return i18n.plural(`costs.items.unitCount.${unit}`, count);
}

/** "Bunch of 20 stems", or "Single stems" when it is bought one at a time. */
export function boughtAsText(i18n: Words, row: Pick<CostItemRow, "packName" | "unitsPerPack" | "useUnit">): string {
  const pack = row.packName?.trim();
  if (!pack) return i18n.t(`costs.items.boughtSingly.${row.useUnit}`);
  return i18n.t("costs.items.boughtAs", { pack, units: unitCountText(i18n, row.unitsPerPack, row.useUnit) });
}

/**
 * Money that may be below zero — a product sold at a loss. The translator's
 * money() never prints a negative amount (an order total cannot be one), so
 * the sign is put in front here.
 */
export function signedMoney(money: Translator["money"], fils: number): string {
  return fils < 0 ? `−${money(-fils)}` : money(fils);
}

/** A fils amount as the plain number an AED input shows: 48000 → "480", 362.5 → "3.625". */
export function filsToAedInput(fils: number): string {
  if (!Number.isFinite(fils) || fils <= 0) return "";
  return String(Math.round(fils * 100) / 10000);
}
