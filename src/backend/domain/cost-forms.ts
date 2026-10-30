import {
  COST_LIMITS,
  aedTextToFils,
  isCostGroup,
  isOneUnit,
  westernDigits,
  type CostGroup,
  type InvoiceInput,
  type OneUnit,
} from "./costs";

/**
 * Reading what the owner sends — the one-sentence form for something she
 * buys, and an invoice — into values the server saves.
 *
 * PURE, like the rest of backend/domain: the server action does only what
 * needs a server (who is asking, saving, refreshing pages). A mistake in
 * what she typed is a `CostInputError` carrying a sentence written for her,
 * an `actions.costs.*` dictionary code so the admin can show it in her
 * language, and — on an invoice — the field it is about ("lines.2.packs"),
 * so the editor can point at it.
 */

export class CostInputError extends Error {
  readonly code: string;
  readonly vars?: Record<string, string | number>;
  readonly field?: string;

  constructor(message: string, code: string, vars?: Record<string, string | number>, field?: string) {
    super(message);
    this.name = "CostInputError";
    this.code = `actions.costs.${code}`;
    this.vars = vars;
    this.field = field;
  }
}

type Reader = { get(name: string): FormDataEntryValue | null };

const text = (form: Reader, name: string): string => {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
};

/** Trimmed, inner spaces folded, so "Peach  Avalanche " and "Peach Avalanche" are one name. */
export const cleanName = (raw: unknown): string => (typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "");

export const NAME_MAX = 80;
export const PACK_NAME_MAX = 40;
export const NOTES_MAX = 1000;
export const PRINTED_NAME_MAX = 120;
export const INVOICE_NUMBER_MAX = 60;
export const ALIASES_MAX = 30;

/**
 * "20", "0.5", "1,000", "٢٠" — or a number already — as a positive number,
 * or NaN.
 */
export function positiveNumber(raw: unknown): number {
  if (typeof raw === "number") return Number.isFinite(raw) && raw > 0 ? raw : Number.NaN;
  if (typeof raw !== "string") return Number.NaN;
  const cleaned = westernDigits(raw).replace(/[\s,]/g, "");
  if (!/^\d*\.?\d+$/.test(cleaned)) return Number.NaN;
  const value = Number(cleaned);
  return value > 0 ? value : Number.NaN;
}

/* ------------------------------------------------------------------ */
/* "[Peach Avalanche rose] comes as a [bunch] of [20] [stems]"          */
/* ------------------------------------------------------------------ */

export type ParsedCostItem = {
  name: string;
  group: CostGroup;
  packName: string | null;
  unitsPerPack: number;
  one: OneUnit;
  /** "I paid AED [ ] for one": null when left empty, so the price she has is kept. */
  priceFils: number | null;
  archived: boolean;
};

function checkName(name: string, field: string): void {
  if (!name) throw new CostInputError("Give it a name, like “Peach Avalanche rose”.", "nameRequired", undefined, field);
  if (name.length > NAME_MAX) {
    throw new CostInputError(`Keep the name under ${NAME_MAX} characters.`, "nameTooLong", { max: NAME_MAX }, field);
  }
}

function checkPack(packName: string, unitsPerPack: number, field: string): void {
  if (packName.length > PACK_NAME_MAX) {
    throw new CostInputError(
      `Keep how it comes under ${PACK_NAME_MAX} characters.`,
      "packNameTooLong",
      { max: PACK_NAME_MAX },
      `${field}packName`,
    );
  }
  if (
    !Number.isFinite(unitsPerPack) ||
    unitsPerPack < COST_LIMITS.unitsPerPackMin ||
    unitsPerPack > COST_LIMITS.unitsPerPackMax
  ) {
    throw new CostInputError(
      "Say how many come in one, like 20.",
      "unitsPerPackInvalid",
      undefined,
      `${field}unitsPerPack`,
    );
  }
}

/**
 * The one-sentence form: `name`, `group`, `packName`, `unitsPerPack`,
 * `one`, `priceAed` and `archived` ("on" or "true" when ticked; absent is
 * not archived, as an unticked checkbox sends nothing).
 */
export function parseCostItemForm(form: Reader): ParsedCostItem {
  const name = cleanName(text(form, "name"));
  checkName(name, "name");

  const group = text(form, "group");
  if (!isCostGroup(group)) {
    throw new CostInputError("Choose flowers, greenery, packaging or something extra.", "groupRequired", undefined, "group");
  }
  const one = text(form, "one");
  if (!isOneUnit(one)) {
    throw new CostInputError("Choose stem, piece or metre.", "oneRequired", undefined, "one");
  }

  const packName = text(form, "packName").replace(/\s+/g, " ");
  const unitsRaw = text(form, "unitsPerPack");
  const unitsPerPack = unitsRaw === "" ? 1 : positiveNumber(unitsRaw);
  checkPack(packName, unitsPerPack, "");

  const priceFils = aedTextToFils(text(form, "priceAed"));
  if (priceFils !== null && !Number.isFinite(priceFils)) {
    throw new CostInputError("Type what one cost you in dirhams, like 3.25.", "priceInvalid", undefined, "priceAed");
  }
  if (priceFils !== null && priceFils > COST_LIMITS.priceForOneMaxFils) {
    throw new CostInputError("That price looks too high — please check it.", "priceTooHigh", undefined, "priceAed");
  }

  const archivedRaw = text(form, "archived").toLowerCase();
  return {
    name,
    group,
    packName: packName || null,
    unitsPerPack,
    one,
    priceFils,
    archived: archivedRaw === "on" || archivedRaw === "true" || archivedRaw === "1",
  };
}

/* ------------------------------------------------------------------ */
/* An invoice                                                          */
/* ------------------------------------------------------------------ */

export type ParsedInvoiceLine = {
  itemId: number | null;
  /** Set when `itemId` is null: something new, created when the invoice is saved. */
  newItem: { name: string; group: CostGroup; packName: string | null; unitsPerPack: number; one: OneUnit } | null;
  printedName: string | null;
  packs: number;
  unitsPerPack: number;
  lineTotalFils: number;
};

export type ParsedInvoice = {
  id: number | null;
  supplier: { id: number } | { name: string };
  /** Trimmed, inner spaces folded; null when she typed none. */
  invoiceNumber: string | null;
  /** YYYY-MM-DD, checked to be a real day. */
  invoiceDate: string;
  deliveryFils: number;
  vatFils: number;
  /** As printed, or null. */
  totalFils: number | null;
  lines: ParsedInvoiceLine[];
};

const positiveId = (value: unknown): number | null =>
  typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;

/** A real calendar day, written YYYY-MM-DD. */
export function isRealDay(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** An amount typed in AED, whole fils: an invoice prints money to the fils. */
function money(raw: unknown, field: string, opts: { required: boolean; max: number }): number | null {
  const fils = aedTextToFils(typeof raw === "string" ? raw : typeof raw === "number" ? String(raw) : "");
  if (fils === null) {
    if (opts.required) {
      throw new CostInputError("Type what this line cost, like 300.", "lineTotalRequired", undefined, field);
    }
    return null;
  }
  if (!Number.isFinite(fils)) {
    throw new CostInputError("Type the amount in dirhams, like 300 or 41.50.", "amountInvalid", undefined, field);
  }
  if (fils > opts.max) {
    throw new CostInputError("That amount looks too high — please check it.", "amountTooHigh", undefined, field);
  }
  return Math.round(fils);
}

/**
 * The invoice editor's input, read defensively: it arrives from a browser,
 * so nothing is trusted to have the shape the type says. `today` is the
 * UAE's YYYY-MM-DD, passed in so this stays pure: an invoice may be dated
 * up to a day ahead (a supplier's clock, an early delivery), not later.
 */
export function parseInvoiceInput(input: unknown, today: string): ParsedInvoice {
  const raw = (input && typeof input === "object" ? input : {}) as Partial<Record<keyof InvoiceInput, unknown>>;

  const id = raw.id === undefined || raw.id === null ? null : positiveId(raw.id);
  if (raw.id !== undefined && raw.id !== null && id === null) {
    throw new CostInputError("That invoice could not be found.", "invoiceNotFound");
  }

  /* Who it is from: one of her suppliers, or a new one by name. */
  const supplierRaw = (raw.supplier && typeof raw.supplier === "object" ? raw.supplier : {}) as {
    id?: unknown;
    name?: unknown;
  };
  let supplier: ParsedInvoice["supplier"];
  if (supplierRaw.id !== undefined && supplierRaw.id !== null) {
    const supplierId = positiveId(supplierRaw.id);
    if (supplierId === null) {
      throw new CostInputError("Choose who the invoice is from.", "supplierRequired", undefined, "supplier");
    }
    supplier = { id: supplierId };
  } else {
    const name = cleanName(supplierRaw.name);
    if (!name) throw new CostInputError("Choose who the invoice is from.", "supplierRequired", undefined, "supplier");
    if (name.length > NAME_MAX) {
      throw new CostInputError(
        `Keep the supplier's name under ${NAME_MAX} characters.`,
        "supplierTooLong",
        { max: NAME_MAX },
        "supplier",
      );
    }
    supplier = { name };
  }

  const invoiceNumber = cleanName(typeof raw.invoiceNumber === "string" ? westernDigits(raw.invoiceNumber) : "");
  if (invoiceNumber.length > INVOICE_NUMBER_MAX) {
    throw new CostInputError(
      `Keep the invoice number under ${INVOICE_NUMBER_MAX} characters.`,
      "invoiceNumberTooLong",
      { max: INVOICE_NUMBER_MAX },
      "invoiceNumber",
    );
  }

  const invoiceDate = typeof raw.invoiceDate === "string" ? westernDigits(raw.invoiceDate.trim()) : "";
  if (!isRealDay(invoiceDate)) {
    throw new CostInputError("Choose the date on the invoice.", "dateRequired", undefined, "invoiceDate");
  }
  if (invoiceDate < "2020-01-01") {
    throw new CostInputError("That date looks too far back — please check it.", "dateTooOld", undefined, "invoiceDate");
  }
  const tomorrow = new Date(`${today}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  if (invoiceDate > tomorrow.toISOString().slice(0, 10)) {
    throw new CostInputError(
      "The date on the invoice is in the future. Please check it.",
      "dateInFuture",
      undefined,
      "invoiceDate",
    );
  }

  const deliveryFils = money(raw.deliveryAed, "deliveryAed", { required: false, max: COST_LIMITS.extraMaxFils }) ?? 0;
  const vatFils = money(raw.vatAed, "vatAed", { required: false, max: COST_LIMITS.extraMaxFils }) ?? 0;
  const totalFils = money(raw.totalAed, "totalAed", { required: false, max: COST_LIMITS.lineTotalMaxFils * 10 });

  if (!Array.isArray(raw.lines) || raw.lines.length === 0) {
    throw new CostInputError("Add at least one line: what you bought.", "linesRequired", undefined, "lines");
  }
  if (raw.lines.length > COST_LIMITS.invoiceLinesMax) {
    throw new CostInputError(
      `An invoice can have at most ${COST_LIMITS.invoiceLinesMax} lines.`,
      "tooManyLines",
      { max: COST_LIMITS.invoiceLinesMax },
      "lines",
    );
  }

  const lines = raw.lines.map((entry, index): ParsedInvoiceLine => {
    const at = `lines.${index}.`;
    /* The owner reads lines numbered from 1. */
    const vars = { line: index + 1 };
    const line = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;

    const itemId = line.itemId === null || line.itemId === undefined ? null : positiveId(line.itemId);
    let newItem: ParsedInvoiceLine["newItem"] = null;
    if (itemId === null) {
      const fresh = (line.newItem && typeof line.newItem === "object" ? line.newItem : null) as Record<
        string,
        unknown
      > | null;
      if (!fresh) {
        throw new CostInputError(`Line ${index + 1}: choose what you bought.`, "lineItemRequired", vars, `${at}item`);
      }
      const name = cleanName(fresh.name);
      checkName(name, `${at}newItem.name`);
      if (!isCostGroup(fresh.group)) {
        throw new CostInputError(
          `Line ${index + 1}: is it flowers, greenery, packaging or something extra?`,
          "lineGroupRequired",
          vars,
          `${at}newItem.group`,
        );
      }
      if (!isOneUnit(fresh.one)) {
        throw new CostInputError(
          `Line ${index + 1}: is one a stem, a piece or a metre?`,
          "lineOneRequired",
          vars,
          `${at}newItem.one`,
        );
      }
      const packName = cleanName(fresh.packName);
      const unitsPerPack = positiveNumber(fresh.unitsPerPack);
      checkPack(packName, unitsPerPack, `${at}newItem.`);
      newItem = { name, group: fresh.group, packName: packName || null, unitsPerPack, one: fresh.one };
    }

    const printedName = cleanName(line.printedName).slice(0, PRINTED_NAME_MAX) || null;

    const packs = positiveNumber(line.packs);
    if (!Number.isFinite(packs) || packs < COST_LIMITS.packsMin || packs > COST_LIMITS.packsMax) {
      throw new CostInputError(
        `Line ${index + 1}: how many did you buy? Type a number, like 5.`,
        "packsInvalid",
        vars,
        `${at}packs`,
      );
    }
    const unitsPerPack = positiveNumber(line.unitsPerPack);
    if (
      !Number.isFinite(unitsPerPack) ||
      unitsPerPack < COST_LIMITS.unitsPerPackMin ||
      unitsPerPack > COST_LIMITS.unitsPerPackMax
    ) {
      throw new CostInputError(
        `Line ${index + 1}: how many come in one? Type a number, like 20.`,
        "lineUnitsPerPackInvalid",
        vars,
        `${at}unitsPerPack`,
      );
    }

    const lineTotalFils = money(line.lineTotalAed, `${at}lineTotalAed`, {
      required: true,
      max: COST_LIMITS.lineTotalMaxFils,
    })!;

    return { itemId, newItem, printedName, packs, unitsPerPack, lineTotalFils };
  });

  return {
    id,
    supplier,
    invoiceNumber: invoiceNumber || null,
    invoiceDate,
    deliveryFils,
    vatFils,
    totalFils,
    lines,
  };
}
