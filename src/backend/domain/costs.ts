/**
 * What a product costs the owner to make, and what she keeps when it sells.
 *
 * PURE. No Payload, no I/O, no server imports: the product editor's Cost
 * section runs the same arithmetic in the browser, live as she types, that
 * the server would run, so the number she sees before pressing Save is the
 * number she gets after it. Everything here is unit-tested in costs.test.ts.
 *
 * MONEY IS FILS (1 AED = 100 fils), as everywhere else in the shop. A cost
 * per stem may carry decimals — 20 stems for AED 7.50 is 37.5 fils a stem —
 * so unit costs are not rounded; totals are rounded once, at the end, so the
 * parts in the summary add up to the total she reads.
 *
 * OWNER ONLY. Nothing in this file decides who may see a cost; the
 * collections, loaders and actions do (backend/data/costs.ts,
 * backend/actions/costs.ts). This file only knows what a cost IS.
 */

/* ------------------------------------------------------------------ */
/* The library: flowers and materials                                  */
/* ------------------------------------------------------------------ */

export type CostKind = "flower" | "greenery" | "container" | "wrapping" | "card" | "other";

/** The unit a recipe counts in: "3 stems", "1 piece", "0.5 metre". */
export type UseUnit = "stem" | "piece" | "metre" | "sheet" | "bunch";

export const COST_KINDS: readonly CostKind[] = ["flower", "greenery", "container", "wrapping", "card", "other"];
export const USE_UNITS: readonly UseUnit[] = ["stem", "piece", "metre", "sheet", "bunch"];

/**
 * What wilts. The allowance for lost flowers — the stems that snap, bruise or
 * open too early before they reach a bouquet — is added to these only: a vase
 * or a ribbon is not thrown away by the dozen.
 */
export const PERISHABLE: ReadonlySet<CostKind> = new Set<CostKind>(["flower", "greenery"]);

export const isCostKind = (value: unknown): value is CostKind =>
  typeof value === "string" && (COST_KINDS as readonly string[]).includes(value);

export const isUseUnit = (value: unknown): value is UseUnit =>
  typeof value === "string" && (USE_UNITS as readonly string[]).includes(value);

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export type CostSettingsValues = {
  /** The share of what she receives (after VAT) she wants to keep, 1–95. */
  targetMarginPercent: number;
  /** What an hour of a florist's making time costs, in fils. */
  labourRatePerHourFils: number;
  /** The allowance for lost flowers a new recipe starts with, in percent. */
  defaultWastePercent: number;
  /** She claims VAT back on what she buys, so a cost is counted without it. */
  vatReclaimable: boolean;
  vatRatePercent: number;
};

/**
 * Until the owner saves her own, the admin uses these: a 60% margin target,
 * AED 60 an hour, 10% of flowers lost, VAT reclaimed at the UAE's 5%.
 */
export const DEFAULT_COST_SETTINGS: CostSettingsValues = {
  targetMarginPercent: 60,
  labourRatePerHourFils: 6000,
  defaultWastePercent: 10,
  vatReclaimable: true,
  vatRatePercent: 5,
};

/** The bounds every layer agrees on: the collection, the form, the editor. */
export const COST_LIMITS = {
  targetMarginPercent: { min: 1, max: 95 },
  wastePercent: { min: 0, max: 60 },
  makingMinutes: { min: 0, max: 600 },
  vatRatePercent: { min: 0, max: 30 },
  /** AED 10,000 an hour or a stem is a typing mistake, not a price. */
  maxFils: 1_000_000,
  unitsPerPackMin: 0.001,
  quantityMax: 10_000,
  recipeLinesMax: 60,
} as const;

/* ------------------------------------------------------------------ */
/* What the admin screens receive                                      */
/* ------------------------------------------------------------------ */

export type CostItemRow = {
  id: number;
  name: string;
  kind: CostKind;
  useUnit: UseUnit;
  /** How it is bought — "Bunch", "Carton", "Roll" — or null. */
  packName: string | null;
  /** Use-units in one pack: 20 stems a bunch, 50 metres a roll. */
  unitsPerPack: number;
  /** The cost of ONE use-unit, in fils, decimals allowed. */
  currentUnitCostFils: number;
  /** Typed by the owner, or taken from her latest purchase (a later step). */
  costSource: "purchase" | "manual";
  /** An optional `#rrggbb` shown beside the name. */
  swatch: string | null;
  archived: boolean;
  notes: string | null;
  /** Names as printed on suppliers' invoices. */
  aliases: string[];
  /** How many products' recipes use it. */
  usedIn: number;
};

export type RecipeLine = { itemId: number; quantity: number };

export type ProductCostRecipe = {
  lines: RecipeLine[];
  wastePercent: number;
  makingMinutes: number;
};

export type CostEditorData = {
  /** The product's saved recipe, or null for a new product or one without. */
  recipe: ProductCostRecipe | null;
  /** Every item not archived, plus any archived item the recipe still uses. */
  items: CostItemRow[];
  settings: CostSettingsValues;
};

/* ------------------------------------------------------------------ */
/* The arithmetic of a recipe                                          */
/* ------------------------------------------------------------------ */

/** What recipeCost needs of an item. A CostItemRow is one. */
export type RecipeItem = {
  id: number;
  kind: CostKind;
  currentUnitCostFils: number;
  archived?: boolean;
};

export type RecipeCost = {
  /** Flowers and greenery, before the allowance. */
  perishableFils: number;
  /** The allowance for lost flowers, on the perishable part only. */
  wasteFils: number;
  /** Containers, wrapping, cards and the rest. */
  otherFils: number;
  /** Making time at the florist's hourly rate. */
  labourFils: number;
  totalFils: number;
  lines: {
    itemId: number;
    quantity: number;
    unitCostFils: number;
    lineFils: number;
    /** The item is not in the library any more, or is archived: counted as 0. */
    missing: boolean;
  }[];
};

/** A finite, non-negative number, or 0. Never NaN into a sum. */
const nonNegative = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export function recipeCost(
  lines: RecipeLine[],
  items: Map<number, RecipeItem>,
  opts: { wastePercent: number; makingMinutes: number; labourRatePerHourFils: number },
): RecipeCost {
  let perishable = 0;
  let other = 0;
  const out: RecipeCost["lines"] = [];

  for (const line of lines) {
    const quantity = nonNegative(line.quantity);
    const item = items.get(line.itemId);
    /* An archived item is one she no longer buys: its last price is not a
       cost she can rely on, so it counts as nothing and the line says so,
       rather than quietly flattering the margin with an old number. */
    const missing = !item || item.archived === true;
    const unitCostFils = missing ? 0 : nonNegative(item.currentUnitCostFils);
    const raw = quantity * unitCostFils;
    if (!missing && PERISHABLE.has(item.kind)) perishable += raw;
    else other += raw;
    out.push({ itemId: line.itemId, quantity, unitCostFils, lineFils: Math.round(raw), missing });
  }

  const wastePercent = nonNegative(opts.wastePercent);
  const minutes = nonNegative(opts.makingMinutes);
  const perishableFils = Math.round(perishable);
  const wasteFils = Math.round((perishable * wastePercent) / 100);
  const otherFils = Math.round(other);
  const labourFils = Math.round((minutes / 60) * nonNegative(opts.labourRatePerHourFils));

  return {
    perishableFils,
    wasteFils,
    otherFils,
    labourFils,
    /* The sum of the rounded parts, so the summary adds up as she reads it. */
    totalFils: perishableFils + wasteFils + otherFils + labourFils,
    lines: out,
  };
}

/**
 * What a sale at `priceFils` leaves her. A shop price INCLUDES VAT, so the
 * VAT inside it is price × rate / (100 + rate) — AED 105 at 5% is AED 5 of
 * VAT — and what she receives is the rest. The margin is what she keeps as a
 * share of what she receives, or null when she receives nothing (a price of
 * 0 has no margin, not an infinite one).
 */
export function earnings(
  priceFils: number,
  costFils: number,
  vatRatePercent: number,
): { vatFils: number; receiveFils: number; profitFils: number; marginPercent: number | null } {
  const price = nonNegative(priceFils);
  const rate = nonNegative(vatRatePercent);
  const vatFils = Math.round((price * rate) / (100 + rate));
  const receiveFils = Math.round(price) - vatFils;
  const profitFils = receiveFils - Math.round(nonNegative(costFils));
  const marginPercent = receiveFils > 0 ? Math.round((profitFils / receiveFils) * 1000) / 10 : null;
  return { vatFils, receiveFils, profitFils, marginPercent };
}

/** Does this price keep at least the target share? Exact, before any rounding of the margin. */
function reachesTarget(priceFils: number, costFils: number, targetMarginPercent: number, vatRatePercent: number) {
  const { receiveFils, profitFils } = earnings(priceFils, costFils, vatRatePercent);
  return receiveFils > 0 && profitFils * 100 >= targetMarginPercent * receiveFils;
}

/**
 * The smallest shop price (VAT included), rounded UP to a whole AED 5 by
 * default, that keeps at least the target margin. "Charge AED 260 to reach
 * 60%". 0 when there is no cost to cover.
 *
 * The algebraic answer is cost ÷ (1 − target) × (1 + VAT), but VAT is rounded
 * to the fils and floating point is not exact, so the candidate is checked
 * with the same `earnings` the summary shows and moved a step either way
 * until it is the smallest one that truly reaches the target.
 */
export function suggestedPriceFils(
  costFils: number,
  targetMarginPercent: number,
  vatRatePercent: number,
  roundToFils = 500,
): number {
  const cost = nonNegative(costFils);
  if (cost === 0) return 0;
  const target = clamp(nonNegative(targetMarginPercent), 0, 99);
  const rate = nonNegative(vatRatePercent);
  const step = roundToFils > 0 && Number.isFinite(roundToFils) ? roundToFils : 500;

  const exact = (cost / (1 - target / 100)) * (1 + rate / 100);
  let candidate = Math.max(step, Math.ceil(exact / step) * step);
  while (!reachesTarget(candidate, cost, target, rate)) candidate += step;
  while (candidate - step > 0 && reachesTarget(candidate - step, cost, target, rate)) candidate -= step;
  return candidate;
}

/* ------------------------------------------------------------------ */
/* Reading what the browser sends                                      */
/* ------------------------------------------------------------------ */

/**
 * The recipe the product editor puts in its hidden `costRecipe` field, read
 * defensively: it is JSON from a browser, so anything malformed is refused
 * (null) rather than half-saved. Quantities must be positive; the same item
 * twice is merged into one line, as the editor would show it; the allowance
 * and making time are held to the bounds the collection enforces.
 *
 * Returns `undefined` when the field was not sent at all — a form without a
 * Cost section (a florist's) changes nothing.
 */
export function parseCostRecipe(raw: unknown): ProductCostRecipe | null | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw !== "string") return null;
  if (raw.trim() === "") return undefined;

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const record = data as { lines?: unknown; wastePercent?: unknown; makingMinutes?: unknown };
  if (!Array.isArray(record.lines) || record.lines.length > COST_LIMITS.recipeLinesMax) return null;

  const merged = new Map<number, number>();
  for (const entry of record.lines) {
    if (!entry || typeof entry !== "object") return null;
    const { itemId, quantity } = entry as { itemId?: unknown; quantity?: unknown };
    if (typeof itemId !== "number" || !Number.isInteger(itemId) || itemId <= 0) return null;
    if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity <= 0) return null;
    if (quantity > COST_LIMITS.quantityMax) return null;
    merged.set(itemId, (merged.get(itemId) ?? 0) + quantity);
  }

  const number = (value: unknown, fallback: number) =>
    typeof value === "number" && Number.isFinite(value) ? value : fallback;
  const waste = number(record.wastePercent, DEFAULT_COST_SETTINGS.defaultWastePercent);
  const minutes = number(record.makingMinutes, 0);

  return {
    /* Three decimals is a thousandth of a metre: more is noise from a stepper. */
    lines: [...merged].map(([itemId, quantity]) => ({ itemId, quantity: Math.round(quantity * 1000) / 1000 })),
    wastePercent: clamp(waste, COST_LIMITS.wastePercent.min, COST_LIMITS.wastePercent.max),
    makingMinutes: Math.round(clamp(minutes, COST_LIMITS.makingMinutes.min, COST_LIMITS.makingMinutes.max)),
  };
}

/**
 * An amount in AED as she types it — "0.375", "AED 7.50", "1,200" — in fils,
 * decimals kept (37.5 fils). null when empty; NaN when it is not a number,
 * so the caller can say so in a sentence.
 */
export function aedTextToFils(raw: string): number | null {
  const cleaned = raw.replace(/^\s*aed/i, "").replace(/[\s,]/g, "");
  if (cleaned === "") return null;
  if (!/^\d+(\.\d{1,4})?$/.test(cleaned) && !/^\.\d{1,4}$/.test(cleaned)) return Number.NaN;
  /* Rounded to a hundredth of a fils: 0.29 × 100 is 28.999… in floating point. */
  return Math.round(Number(cleaned) * 100 * 100) / 100;
}

/** `#rrggbb`, lower-cased, or null for anything else. */
export function parseSwatch(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(value) ? value : null;
}

/* ------------------------------------------------------------------ */
/* Matching printed names to the library                               */
/* ------------------------------------------------------------------ */

/**
 * The shorthand wholesalers print. Keys are whole words after lower-casing;
 * each side of a comparison is normalised the same way, so a missing entry
 * costs a match, never a wrong one.
 */
const ABBREVIATIONS: Record<string, string> = {
  wht: "white",
  wh: "white",
  slv: "silver",
  sil: "silver",
  blk: "black",
  rd: "red",
  pnk: "pink",
  pk: "pink",
  ylw: "yellow",
  yel: "yellow",
  org: "orange",
  prpl: "purple",
  pur: "purple",
  grn: "green",
  crm: "cream",
  lav: "lavender",
  chrys: "chrysanthemum",
  chrysanth: "chrysanthemum",
  chrysant: "chrysanthemum",
  euc: "eucalyptus",
  eucal: "eucalyptus",
  gyp: "gypsophila",
  gypso: "gypsophila",
  hyd: "hydrangea",
  hydr: "hydrangea",
  carn: "carnation",
  alstro: "alstroemeria",
  lisi: "lisianthus",
  lis: "lisianthus",
  ranun: "ranunculus",
  sp: "spray",
};

/** Words that describe how it was counted or graded, not what it is. */
const NOISE = new Set([
  "pc",
  "pcs",
  "piece",
  "pieces",
  "st",
  "stm",
  "stem",
  "stems",
  "bn",
  "bnch",
  "bunch",
  "bunches",
  "box",
  "ctn",
  "xs",
  "xl",
  "xxl",
  "xxxl",
  "a1",
  "a2",
  "a3",
  "grade",
  "premium",
  "select",
]);

/**
 * Plural to singular, the plain English way: "roses" → "rose", "peonies" →
 * "peony". Latin names ending in -us and -is ("eucalyptus", "iris") and
 * "-ss" words ("glass") are left alone.
 */
function singular(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 3 && word.endsWith("s") && !/(ss|us|is)$/.test(word)) return word.slice(0, -1);
  return word;
}

/**
 * A printed name reduced to the words that say what it is: lower-case,
 * accents and punctuation gone, sizes ("60cm", "50 cm", "1.5m") and grades
 * dropped, shorthand spelled out, plurals folded ("roses" → "rose").
 */
export function normaliseName(text: string): string {
  const words = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    /* Sizes and weights, with or without the space: 60cm, 50 cm, 1.5 m, 250g. */
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:cm|mm|m|g|kg|ml|l|in|inch|")(?![a-z])/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => ABBREVIATIONS[word] ?? word)
    .filter((word) => !NOISE.has(word) && !/^\d+$/.test(word) && !/^x\d+$/.test(word))
    .map(singular);
  return words.join(" ");
}

export type MatchCandidate = { id: number; name: string; aliases: string[] };

/** Two words are the same when equal, or when one is a long prefix of the other ("eucalypt"). */
const sameWord = (a: string, b: string): boolean =>
  a === b || (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a)));

/** Dice similarity of two word lists: 2 × shared ÷ total. */
function similarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const unused = [...b];
  let shared = 0;
  for (const word of a) {
    const at = unused.findIndex((other) => sameWord(word, other));
    if (at >= 0) {
      shared += 1;
      unused.splice(at, 1);
    }
  }
  return (2 * shared) / (a.length + b.length);
}

/**
 * The library item a printed invoice line most likely is.
 *
 * A name she has already confirmed for an item (an alias) is certain: score
 * 1. Otherwise the words are compared with the item's name and every alias,
 * and the closest wins; anything under half the words in common is no match
 * at all, because a wrong match silently costs the wrong flower.
 */
export function matchItem(
  printed: string,
  candidates: MatchCandidate[],
): { id: number; score: number; via: "alias" | "name" } | null {
  const target = normaliseName(printed);
  if (!target) return null;

  for (const candidate of candidates) {
    if (candidate.aliases.some((alias) => normaliseName(alias) === target)) {
      return { id: candidate.id, score: 1, via: "alias" };
    }
  }

  const words = target.split(" ");
  let best: { id: number; score: number; via: "alias" | "name" } | null = null;
  for (const candidate of candidates) {
    const options: { text: string; via: "alias" | "name" }[] = [
      { text: candidate.name, via: "name" },
      ...candidate.aliases.map((text) => ({ text, via: "alias" as const })),
    ];
    for (const option of options) {
      const normalised = normaliseName(option.text);
      if (!normalised) continue;
      const score = similarity(words, normalised.split(" "));
      /* Strictly better only: on a tie the earlier candidate, and its name
         over its alias, keeps the match. */
      if (!best || score > best.score) best = { id: candidate.id, score, via: option.via };
    }
  }
  return best && best.score >= 0.5 ? best : null;
}
