/**
 * What the owner's flowers and packaging cost her, what an arrangement costs
 * to make, and what she keeps.
 *
 * PURE. No Payload, no I/O, no server imports: the invoice editor works out
 * "AED 3.23 a stem" in the browser, live as she types, with the same
 * arithmetic the server stores, so the number she sees before pressing Save
 * is the number she gets after it. Everything here is unit-tested in
 * costs.test.ts.
 *
 * MONEY IS FILS (1 AED = 100 fils), as everywhere else in the shop. A price
 * for one stem may carry decimals — 20 stems for AED 64 is 320 fils, but 30
 * for AED 64 is 213.33 — so a price for one is kept to a hundredth of a
 * fils; totals are rounded once, at the end, so the parts she reads add up
 * to the total she reads.
 *
 * THE WORDS. The owner never reads "unit cost", "margin" or "pack": what she
 * buys has a GROUP (flowers, greenery, packaging, something extra), comes as
 * a `packName` ("bunch") of `unitsPerPack` (20), and is used ONE stem, piece
 * or metre at a time; its PRICE FOR ONE comes from her latest invoice. The
 * code uses the same words, so nobody has to translate between the two.
 *
 * NO GUESSES. Step 1 had an allowance for lost flowers, an hourly rate and a
 * VAT rate taken out of every price; all three are gone. Waste is measured
 * later (thrown away, and what didn't go into an order), her time is left
 * out and every "you kept" says so, and VAT follows the shop's own
 * registration (src/lib/business.ts) — which today is none.
 *
 * OWNER ONLY. Nothing in this file decides who may see a cost; the
 * collections, loaders and actions do (backend/data/costs.ts,
 * backend/actions/costs.ts). This file only knows what a cost IS.
 */

/* ------------------------------------------------------------------ */
/* What she buys                                                       */
/* ------------------------------------------------------------------ */

export type CostGroup = "flowers" | "greenery" | "packaging" | "extra";

/** What one is, in "AED 3.23 a stem": a stem, a piece (a box, a vase, a card) or a metre (ribbon). */
export type OneUnit = "stem" | "piece" | "metre";

export const COST_GROUPS: readonly CostGroup[] = ["flowers", "greenery", "packaging", "extra"];
export const ONE_UNITS: readonly OneUnit[] = ["stem", "piece", "metre"];

export const isCostGroup = (value: unknown): value is CostGroup =>
  typeof value === "string" && (COST_GROUPS as readonly string[]).includes(value);

export const isOneUnit = (value: unknown): value is OneUnit =>
  typeof value === "string" && (ONE_UNITS as readonly string[]).includes(value);

/**
 * Where a price for one came from: her latest invoice line, or typed by her
 * because there is no invoice for it yet ("about AED 45 a cake").
 */
export type CostSource = "invoice" | "typed";

/**
 * The florists' own yardstick: flowers, foliage, container and supplies
 * should take no more than 33 of every AED 100 of the selling price (the
 * Society of American Florists; Paul Goodman CPA). A built-in guide, not a
 * setting she has to fill in before she sees anything.
 */
export const FLORIST_GUIDE_PER_100 = 33;

/** Above the guide but not yet alarming: amber up to here, red above it. */
export const WATCH_UP_TO_PER_100 = 40;

/** The bounds every layer agrees on: the collections, the forms, the editors. */
export const COST_LIMITS = {
  /** AED 10,000 for ONE stem or box is a typing mistake, not a price. */
  priceForOneMaxFils: 1_000_000,
  /** AED 100,000 on one invoice line is a typing mistake too. */
  lineTotalMaxFils: 10_000_000,
  /** And AED 50,000 of delivery or VAT on one invoice. */
  extraMaxFils: 5_000_000,
  unitsPerPackMin: 0.001,
  unitsPerPackMax: 100_000,
  packsMin: 0.001,
  packsMax: 10_000,
  invoiceLinesMax: 100,
  quantityMax: 10_000,
  recipeLinesMax: 60,
} as const;

/* ------------------------------------------------------------------ */
/* What the admin screens receive                                      */
/* ------------------------------------------------------------------ */

/** What the arithmetic needs of something she buys. */
export type CostItemPrice = {
  id: number;
  name: string;
  group: CostGroup;
  /** The price for one stem, piece or metre, in fils (decimals allowed); null = no price yet. */
  priceForOneFils: number | null;
};

/** A row of "What you buy", as every costs screen receives it. */
export type CostItemRow = CostItemPrice & {
  /** How it comes — "bunch", "box", "roll", "carton", "single" — or null. */
  packName: string | null;
  /** How many in one: the "of 20" in "a bunch of 20". */
  unitsPerPack: number;
  one: OneUnit;
  costSource: CostSource;
  /** The invoice date of the line its price came from (ISO), or null. */
  lastPaidAt: string | null;
  lastSupplier: { id: number; name: string } | null;
  /** "I don't buy this any more". */
  archived: boolean;
  notes: string | null;
  /** Names as printed on her invoices, learned when she saves one. */
  aliases: string[];
  /** How many arrangements use it. */
  usedIn: number;
};

/** One line of "what goes in" (florists call it a recipe): an item and how many. */
export type RecipeLine = { itemId: number; quantity: number };

export type ProductCostRecipe = { lines: RecipeLine[] };

export type CostEditorData = {
  /** The product's saved "what goes in", or null for a new product or one without. */
  recipe: ProductCostRecipe | null;
  /** Everything she still buys, plus anything she no longer buys that the recipe still uses. */
  items: CostItemRow[];
};

export type SupplierRow = { id: number; name: string; phone: string | null; notes: string | null };

export type InvoiceSource = "typed" | "photo";

/** A row of the Invoices list. */
export type InvoiceListRow = {
  id: number;
  supplier: { id: number; name: string };
  invoiceNumber: string | null;
  /** YYYY-MM-DD, the day printed on the invoice, in the UAE. */
  invoiceDate: string;
  /** The total as printed; when none was typed, the lines plus delivery and VAT. */
  totalFils: number;
  lineCount: number;
  source: InvoiceSource;
  /** When she added it (ISO). */
  createdAt: string;
};

export type InvoiceLineDetail = {
  itemId: number;
  name: string;
  group: CostGroup;
  one: OneUnit;
  printedName: string | null;
  packs: number;
  unitsPerPack: number;
  units: number;
  lineTotalFils: number;
  priceForOneFils: number;
};

/** One invoice, as its editor opens it. */
export type InvoiceDetail = {
  id: number;
  supplier: { id: number; name: string };
  invoiceNumber: string | null;
  invoiceDate: string;
  deliveryFils: number;
  vatFils: number;
  /** As printed, or null when none was typed. */
  totalFils: number | null;
  source: InvoiceSource;
  notes: string | null;
  createdAt: string;
  lines: InvoiceLineDetail[];
};

/* ------------------------------------------------------------------ */
/* What the invoice editor sends, and what it gets back                */
/* ------------------------------------------------------------------ */

/** Something new on an invoice, described in the editor's sentence. */
export type NewItemInput = { name: string; group: CostGroup; packName: string; unitsPerPack: number; one: OneUnit };

export type InvoiceLineInput = {
  /** Something she already buys, or null with `newItem`. */
  itemId: number | null;
  newItem?: NewItemInput;
  /** The name as printed on the invoice; learned as a name of the item it was matched to. */
  printedName?: string;
  /** "5" bunches… */
  packs: number;
  /** …"of 20". */
  unitsPerPack: number;
  /** "for AED 300", as typed. */
  lineTotalAed: string;
};

export type InvoiceInput = {
  /** Set when she is changing an invoice already saved. */
  id?: number;
  /** One of her suppliers, or a new one by name. */
  supplier: { id: number } | { name: string };
  invoiceNumber: string;
  /** YYYY-MM-DD, the day printed on the invoice (UAE). */
  invoiceDate: string;
  /** As typed: "20", "", "AED 41.50". Empty is 0. */
  deliveryAed: string;
  vatAed: string;
  /** The total as printed. Empty when she has none to type. */
  totalAed: string;
  lines: InvoiceLineInput[];
};

/** "Peach Avalanche: AED 3.23 → 3.80 a stem". `beforeFils` null = it had no price before. */
export type PriceChange = { itemId: number; name: string; one: OneUnit; beforeFils: number | null; nowFils: number };

export type InvoiceResult =
  | { ok: true; id: number; message: string; code: string; changes: PriceChange[] }
  | {
      ok: false;
      message: string;
      code: string;
      /** Where to point: "supplier", "invoiceDate", "invoiceNumber", "totalAed", "lines.2.packs"… */
      field?: string;
      vars?: Record<string, string | number>;
    };

/* ------------------------------------------------------------------ */
/* An invoice: the price for one stem                                  */
/* ------------------------------------------------------------------ */

/** A finite, non-negative number, or 0. Never NaN into a sum. */
const nonNegative = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;

/** A hundredth of a fils: enough for a price for one, and no floating-point noise (0.29 × 100). */
const toHundredthFils = (fils: number): number => Math.round(fils * 100) / 100;

/**
 * What the invoice's extras add to the cost of what is on it.
 *
 * Delivery always does: she paid it to get the flowers. Supplier VAT does
 * while the shop is NOT VAT-registered (src/lib/business.ts), because she
 * cannot claim it back — it is simply part of what the flowers cost her. The
 * day the shop registers, the same invoices stop counting their VAT, with no
 * setting inside Costs.
 */
export function invoiceExtrasFils(deliveryFils: number, vatFils: number, vatRegistered: boolean): number {
  return nonNegative(deliveryFils) + (vatRegistered ? 0 : nonNegative(vatFils));
}

/**
 * The price for one stem, piece or metre on each line of an invoice:
 *
 *   share of extras = extras × line total ÷ all line totals
 *   price for one   = (line total + its share of extras) ÷ units
 *
 * Lines AED 800, extras AED 61: the AED 300 line of 100 stems takes 37.5% of
 * the extras, AED 22.88, and a stem costs (300 + 22.88) ÷ 100 = AED 3.23.
 *
 * When every line is AED 0 there is no value to share by, so the extras are
 * shared equally. A line with no units is 0, never NaN or Infinity.
 */
export function invoicePricesForOne(lines: { lineTotalFils: number; units: number }[], extrasFils: number): number[] {
  const extras = nonNegative(extrasFils);
  const totals = lines.map((line) => nonNegative(line.lineTotalFils));
  const sum = totals.reduce((a, b) => a + b, 0);
  return lines.map((line, i) => {
    const units = nonNegative(line.units);
    if (units === 0) return 0;
    const share = sum > 0 ? (extras * totals[i]!) / sum : extras / lines.length;
    return toHundredthFils((totals[i]! + share) / units);
  });
}

/**
 * Do the lines, delivery and VAT add up to the total printed on the
 * invoice? `differenceFils` is printed − worked out: above 0 when the total
 * says more than the lines do ("Is a page missing?"), below 0 when less.
 * `matches` is null when there is no printed total to check against. A fils
 * per line is allowed for the supplier's own rounding.
 */
export function invoiceTotalsCheck(
  lineTotalsFils: number[],
  deliveryFils: number,
  vatFils: number,
  printedTotalFils: number | null,
): { sumFils: number; linesFils: number; matches: boolean | null; differenceFils: number } {
  const linesFils = Math.round(lineTotalsFils.reduce((sum, fils) => sum + nonNegative(fils), 0));
  const sumFils = linesFils + Math.round(nonNegative(deliveryFils)) + Math.round(nonNegative(vatFils));
  if (printedTotalFils === null || !Number.isFinite(printedTotalFils)) {
    return { sumFils, linesFils, matches: null, differenceFils: 0 };
  }
  const differenceFils = Math.round(printedTotalFils) - sumFils;
  const tolerance = Math.max(1, lineTotalsFils.length);
  return { sumFils, linesFils, matches: Math.abs(differenceFils) <= tolerance, differenceFils };
}

/** Units on a line: 5 bunches of 20 = 100 stems. Kept to a thousandth (half a metre of ribbon is fine). */
export function invoiceUnits(packs: number, unitsPerPack: number): number {
  return Math.round(nonNegative(packs) * nonNegative(unitsPerPack) * 1000) / 1000;
}

/** One invoice line, as the price of the thing on it is worked out from. */
export type PricedLine = {
  itemId: number;
  invoiceId: number;
  /** ISO, as stored: every invoice date is midday in the UAE, so they compare as text. */
  invoiceDate: string;
  supplierId: number;
  units: number;
  priceForOneFils: number;
};

export type LatestPrice = { priceForOneFils: number; invoiceId: number; invoiceDate: string; supplierId: number };

/**
 * The price for one of each thing, from its LATEST invoice: the latest
 * invoice date, and on the same day the invoice added last (the higher id).
 * It is what she will pay tomorrow, and flowers do not sit long enough for
 * an average over weeks to mean anything.
 *
 * The same thing twice on that one invoice (two lines of the same rose) is
 * one price: the lines' prices weighted by their units, as if bought on one
 * line. Older invoices do not count.
 */
export function latestPrices(lines: PricedLine[]): Map<number, LatestPrice> {
  const newest = new Map<number, { invoiceId: number; invoiceDate: string }>();
  for (const line of lines) {
    const seen = newest.get(line.itemId);
    if (
      !seen ||
      line.invoiceDate > seen.invoiceDate ||
      (line.invoiceDate === seen.invoiceDate && line.invoiceId > seen.invoiceId)
    ) {
      newest.set(line.itemId, { invoiceId: line.invoiceId, invoiceDate: line.invoiceDate });
    }
  }

  const sums = new Map<number, { value: number; units: number; supplierId: number }>();
  for (const line of lines) {
    if (newest.get(line.itemId)?.invoiceId !== line.invoiceId) continue;
    const units = nonNegative(line.units);
    const sum = sums.get(line.itemId) ?? { value: 0, units: 0, supplierId: line.supplierId };
    sum.value += nonNegative(line.priceForOneFils) * units;
    sum.units += units;
    sums.set(line.itemId, sum);
  }

  const out = new Map<number, LatestPrice>();
  for (const [itemId, { invoiceId, invoiceDate }] of newest) {
    const sum = sums.get(itemId)!;
    out.set(itemId, {
      priceForOneFils: sum.units > 0 ? toHundredthFils(sum.value / sum.units) : 0,
      invoiceId,
      invoiceDate,
      supplierId: sum.supplierId,
    });
  }
  return out;
}

/**
 * How much a price for one moved, in whole percent: 3.23 → 3.80 is +18.
 * null when there was no price before (it is new, not "up ∞%").
 */
export function priceChangePercent(beforeFils: number | null, nowFils: number): number | null {
  if (beforeFils === null || !Number.isFinite(beforeFils) || beforeFils <= 0) return null;
  return Math.round(((nonNegative(nowFils) - beforeFils) / beforeFils) * 100);
}

/* ------------------------------------------------------------------ */
/* An arrangement: what it costs to make                               */
/* ------------------------------------------------------------------ */

/**
 * What one arrangement costs to make:
 *
 *   costs you = Σ (how many × price for one)
 *
 * A line whose item has NO PRICE YET is never counted as zero in silence:
 * its `lineFils` is null, `atLeast` is true and its name is in
 * `missingNames`, so the screen says "at least AED 69 — the hat box has no
 * price yet". An item that is not in `items` at all (it left the list) is
 * the same, without a name to give.
 *
 * Each line is rounded to the fils and the cost is their sum, so the lines
 * she reads add up to the cost she reads.
 */
export function arrangementCost(
  lines: RecipeLine[],
  items: Map<number, CostItemPrice>,
): {
  costFils: number;
  atLeast: boolean;
  missingNames: string[];
  lines: { itemId: number; quantity: number; lineFils: number | null }[];
} {
  let costFils = 0;
  let atLeast = false;
  const missingNames: string[] = [];
  const out: { itemId: number; quantity: number; lineFils: number | null }[] = [];

  for (const line of lines) {
    const quantity = nonNegative(line.quantity);
    const item = items.get(line.itemId);
    const price = item?.priceForOneFils;
    if (!item || typeof price !== "number" || !Number.isFinite(price) || price < 0) {
      atLeast = true;
      if (item && !missingNames.includes(item.name)) missingNames.push(item.name);
      out.push({ itemId: line.itemId, quantity, lineFils: null });
      continue;
    }
    const lineFils = Math.round(quantity * price);
    costFils += lineFils;
    out.push({ itemId: line.itemId, quantity, lineFils });
  }

  return { costFils, atLeast, missingNames, lines: out };
}

/**
 * The one percentage she is shown: how many dirhams of every AED 100 of the
 * price go on flowers and packaging. AED 91 of AED 450 is 20.2. One decimal;
 * null when the price is 0 (nothing to take a share of).
 */
export function per100(costFils: number, priceFils: number): number | null {
  const price = nonNegative(priceFils);
  if (price === 0) return null;
  return Math.round((nonNegative(costFils) / price) * 1000) / 10;
}

export type GuideBand = "healthy" | "watch" | "tooMuch";

/**
 * Green, amber or red against the florists' guide: 33 or less is healthy,
 * over 33 up to 40 is one to watch, over 40 costs too much to make. null
 * when there is no share to judge (no price).
 */
export function guideBand(share: number | null): GuideBand | null {
  if (share === null || !Number.isFinite(share)) return null;
  if (share <= FLORIST_GUIDE_PER_100) return "healthy";
  if (share <= WATCH_UP_TO_PER_100) return "watch";
  return "tooMuch";
}

/**
 * The price at which the cost would be `per100Target` of every AED 100,
 * rounded UP to a whole AED 5 by default: "At AED 33 of every 100 the price
 * would be AED 280." Shown as a sentence, never written into the price for
 * her — the price is her decision. 0 when there is no cost.
 *
 * The algebra is cost × 100 ÷ target; floating point is not exact, so the
 * candidate is checked without dividing and moved a step either way until
 * it is the smallest one that truly reaches the target.
 */
export function priceForGuide(
  costFils: number,
  per100Target: number = FLORIST_GUIDE_PER_100,
  roundToFils = 500,
): number {
  const cost = nonNegative(costFils);
  if (cost === 0) return 0;
  const target =
    Number.isFinite(per100Target) && per100Target > 0 && per100Target <= 100 ? per100Target : FLORIST_GUIDE_PER_100;
  const step = Number.isFinite(roundToFils) && roundToFils > 0 ? roundToFils : 500;
  /* cost ÷ price ≤ target ÷ 100, without dividing. */
  const reaches = (price: number) => cost * 100 <= target * price;

  let candidate = Math.max(step, Math.ceil((cost * 100) / target / step) * step);
  while (!reaches(candidate)) candidate += step;
  while (candidate - step > 0 && reaches(candidate - step)) candidate -= step;
  return candidate;
}

/**
 * What a card payment costs her, as an estimate: Stripe's UAE price for a
 * domestic card, 2.9% + AED 1 (stripe.com/ae/pricing, checked 30 Oct 2026).
 * A foreign card costs a little more; the real fee replaces this estimate
 * once each order records it (a later step). 0 for nothing paid.
 */
export function cardFeeEstimateFils(paidFils: number): number {
  const paid = nonNegative(paidFils);
  if (paid === 0) return 0;
  return Math.round(paid * 0.029 + 100);
}

/* ------------------------------------------------------------------ */
/* Reading what the browser sends                                      */
/* ------------------------------------------------------------------ */

/**
 * "What goes in" as the product editor puts it in its hidden `costRecipe`
 * field, read defensively: it is JSON from a browser, so anything malformed
 * is refused (null) rather than half-saved. Quantities must be positive; the
 * same item twice is merged into one line, as the editor would show it.
 * Anything else in the object — the allowance and minutes an older editor
 * sent — is ignored.
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
  const record = data as { lines?: unknown };
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

  /* Three decimals is a thousandth of a metre: more is noise from a stepper. */
  return { lines: [...merged].map(([itemId, quantity]) => ({ itemId, quantity: Math.round(quantity * 1000) / 1000 })) };
}

/**
 * Arabic-Indic (٠–٩) and Persian (۰–۹) digits as 0–9, and the Arabic decimal
 * and thousands marks as "." and ",": a phone keyboard in Arabic types them,
 * and "٣٠٠" is AED 300 all the same.
 */
export function westernDigits(text: string): string {
  return text
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, ".")
    .replace(/٬/g, ",");
}

/**
 * An amount in AED as she types it — "300", "AED 7.50", "1,200", "٣٠٠" — in
 * fils, decimals kept to a hundredth of a fils. null when empty; NaN when it
 * is not a number, so the caller can say so in a sentence.
 */
export function aedTextToFils(raw: string): number | null {
  const cleaned = westernDigits(raw)
    .trim()
    .replace(/^(aed|د\.?\s?إ\.?)/i, "")
    .replace(/[\s,]/g, "");
  if (cleaned === "") return null;
  if (!/^\d+(\.\d{1,4})?$/.test(cleaned) && !/^\.\d{1,4}$/.test(cleaned)) return Number.NaN;
  return toHundredthFils(Number(cleaned) * 100);
}

/* ------------------------------------------------------------------ */
/* Matching printed names to what she buys                             */
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
 * The thing she buys that a printed invoice line most likely is.
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
