import {
  COST_LIMITS,
  aedTextToFils,
  isCostKind,
  isUseUnit,
  parseSwatch,
  type CostKind,
  type CostSettingsValues,
  type UseUnit,
} from "./costs";

/**
 * Reading the owner's costing forms — a flower or material, and her
 * settings — into values the server saves.
 *
 * PURE, like the rest of backend/domain: the server action does only what
 * needs a server (who is asking, saving, refreshing pages). A mistake in
 * what she typed is a `CostInputError` carrying a sentence written for her
 * and an `actions.costs.*` dictionary code, so the admin can show it in her
 * language.
 */

export class CostInputError extends Error {
  readonly code: string;
  readonly vars?: Record<string, string | number>;

  constructor(message: string, code: string, vars?: Record<string, string | number>) {
    super(message);
    this.name = "CostInputError";
    this.code = `actions.costs.${code}`;
    this.vars = vars;
  }
}

type Reader = { get(name: string): FormDataEntryValue | null };

const text = (form: Reader, name: string): string => {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
};

export const NAME_MAX = 80;
export const PACK_NAME_MAX = 40;
export const NOTES_MAX = 1000;
export const ALIAS_MAX = 80;
export const ALIASES_MAX = 30;

export type ParsedCostItem = {
  name: string;
  kind: CostKind;
  useUnit: UseUnit;
  packName: string | null;
  unitsPerPack: number;
  /** null when the field was left empty: the cost she already has is kept. */
  unitCostFils: number | null;
  swatch: string | null;
  notes: string | null;
  aliases: string[];
};

/** "20", "0.5", "1,000" — a positive number, or NaN. */
function positiveNumber(raw: string): number {
  const cleaned = raw.replace(/[\s,]/g, "");
  if (!/^\d*\.?\d+$/.test(cleaned)) return Number.NaN;
  return Number(cleaned);
}

/** "60", "60%", "12.5" — a number, or NaN. */
function percent(raw: string): number {
  const cleaned = raw.replace(/%/g, "").replace(/\s/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return Number.NaN;
  return Number(cleaned);
}

export function parseCostItemForm(form: Reader): ParsedCostItem {
  const name = text(form, "name").replace(/\s+/g, " ");
  if (!name) throw new CostInputError("Give it a name, like “Red Naomi rose”.", "nameRequired");
  if (name.length > NAME_MAX) {
    throw new CostInputError(`Keep the name under ${NAME_MAX} characters.`, "nameTooLong", { max: NAME_MAX });
  }

  const kind = text(form, "kind");
  if (!isCostKind(kind)) throw new CostInputError("Choose what kind of thing it is.", "kindRequired");
  const useUnit = text(form, "useUnit");
  if (!isUseUnit(useUnit)) throw new CostInputError("Choose the unit a product uses it in.", "unitRequired");

  const packName = text(form, "packName");
  if (packName.length > PACK_NAME_MAX) {
    throw new CostInputError(`Keep how it is bought under ${PACK_NAME_MAX} characters.`, "packNameTooLong", {
      max: PACK_NAME_MAX,
    });
  }

  const unitsRaw = text(form, "unitsPerPack");
  const unitsPerPack = unitsRaw === "" ? 1 : positiveNumber(unitsRaw);
  if (!Number.isFinite(unitsPerPack) || unitsPerPack < COST_LIMITS.unitsPerPackMin || unitsPerPack > 100_000) {
    throw new CostInputError("Units per pack must be a number above 0, like 20.", "unitsPerPackInvalid");
  }

  const unitCostFils = aedTextToFils(text(form, "unitCostAed"));
  if (unitCostFils !== null && !Number.isFinite(unitCostFils)) {
    throw new CostInputError("Enter what one unit costs you in dirhams, like 0.75.", "costInvalid");
  }
  if (unitCostFils !== null && unitCostFils > COST_LIMITS.maxFils) {
    throw new CostInputError("That cost looks too high — please check it.", "costTooHigh");
  }

  const swatchRaw = text(form, "swatch");
  const swatch = swatchRaw === "" ? null : parseSwatch(swatchRaw);
  if (swatchRaw !== "" && swatch === null) {
    throw new CostInputError("Use a colour like #c0392b, or leave it empty.", "swatchInvalid");
  }

  const notes = text(form, "notes");
  if (notes.length > NOTES_MAX) {
    throw new CostInputError(`Keep the notes under ${NOTES_MAX} characters.`, "notesTooLong", { max: NOTES_MAX });
  }

  /* One per line, as printed. The same name twice — whatever its case — is
     one name, and the item's own name is not an alias of itself. */
  const seen = new Set<string>([name.toLowerCase()]);
  const aliases: string[] = [];
  for (const line of text(form, "aliases").split(/\r?\n/)) {
    const alias = line.trim().replace(/\s+/g, " ");
    if (!alias) continue;
    if (alias.length > ALIAS_MAX) {
      throw new CostInputError(`Keep each printed name under ${ALIAS_MAX} characters.`, "aliasTooLong", {
        max: ALIAS_MAX,
      });
    }
    if (seen.has(alias.toLowerCase())) continue;
    seen.add(alias.toLowerCase());
    aliases.push(alias);
  }
  if (aliases.length > ALIASES_MAX) {
    throw new CostInputError(`Keep to ${ALIASES_MAX} printed names or fewer.`, "tooManyAliases", {
      max: ALIASES_MAX,
    });
  }

  return {
    name,
    kind,
    useUnit,
    packName: packName || null,
    unitsPerPack,
    unitCostFils,
    swatch,
    notes: notes || null,
    aliases,
  };
}

export function parseCostSettingsForm(form: Reader): CostSettingsValues {
  const { targetMarginPercent: margin, wastePercent: waste, vatRatePercent: vat } = COST_LIMITS;

  const targetMarginPercent = percent(text(form, "targetMarginPercent"));
  if (!Number.isFinite(targetMarginPercent) || targetMarginPercent < margin.min || targetMarginPercent > margin.max) {
    throw new CostInputError(
      `Your target margin must be between ${margin.min}% and ${margin.max}%.`,
      "targetInvalid",
      { min: margin.min, max: margin.max },
    );
  }

  const labour = aedTextToFils(text(form, "labourRatePerHourAed"));
  if (labour === null || !Number.isFinite(labour) || labour > COST_LIMITS.maxFils) {
    throw new CostInputError("Enter the florist's hourly rate in dirhams, like 60.", "labourInvalid");
  }

  const defaultWastePercent = percent(text(form, "defaultWastePercent"));
  if (!Number.isFinite(defaultWastePercent) || defaultWastePercent < waste.min || defaultWastePercent > waste.max) {
    throw new CostInputError(
      `The allowance for lost flowers must be between ${waste.min}% and ${waste.max}%.`,
      "wasteInvalid",
      { min: waste.min, max: waste.max },
    );
  }

  const vatReclaimable = form.get("vatReclaimable") === "on" || form.get("vatReclaimable") === "true";

  const vatRaw = text(form, "vatRatePercent");
  const vatRatePercent = percent(vatRaw);
  if (!Number.isFinite(vatRatePercent) || vatRatePercent < vat.min || vatRatePercent > vat.max) {
    throw new CostInputError(`The VAT rate must be between ${vat.min}% and ${vat.max}%.`, "vatRateInvalid", {
      min: vat.min,
      max: vat.max,
    });
  }

  return {
    targetMarginPercent,
    /* An hourly rate in whole fils: a hundredth of a dirham is precise enough. */
    labourRatePerHourFils: Math.round(labour),
    defaultWastePercent,
    vatReclaimable,
    vatRatePercent,
  };
}
