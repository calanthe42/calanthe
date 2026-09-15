import { FormInputError } from "@backend/domain/form-error";

/**
 * Reading the product editor into a product record.
 *
 * PURE — no Payload, no request, no database — so every rule below is unit
 * tested, and the server action that calls it is left doing only what needs a
 * server: who is asking, and saving.
 *
 * MONEY: the owner types dirhams. This is the one place they become integer
 * fils, and it reads ONLY the `priceAed` / `compareAtPriceAed` fields. A
 * `priceFils` smuggled into the form is never looked at, so there is no way to
 * write a raw database amount through the editor.
 *
 * Everything that can be wrong is reported as a FormInputError in a sentence
 * the owner can act on, with a code the admin translates. The collection's own
 * hooks re-check the rules that matter (a product cannot go live without a
 * photograph), so this is the friendly first line, not the only one.
 */

export const PRODUCT_CATEGORIES = [
  { label: "Bouquet", value: "bouquet" },
  { label: "Vase arrangement", value: "vase-arrangement" },
  { label: "Box arrangement", value: "box-arrangement" },
  { label: "Basket", value: "basket" },
  { label: "Single stem", value: "single-stem" },
  { label: "Plant", value: "plant" },
  { label: "Event piece", value: "event-piece" },
] as const;

export const PRODUCT_FLOWERS = [
  { label: "Roses", value: "roses" },
  { label: "Peonies", value: "peonies" },
  { label: "Orchids", value: "orchids" },
  { label: "Tulips", value: "tulips" },
  { label: "Lilies", value: "lilies" },
  { label: "Wildflowers", value: "wildflowers" },
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number]["value"];
export type ProductFlower = (typeof PRODUCT_FLOWERS)[number]["value"];

export const MAX_PRODUCT_IMAGES = 8;
export const PUBLISH_NEEDS_PHOTO = "Add at least one product photo before publishing.";

const MAX_PRICE_AED = 1_000_000;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type FormReader = {
  get(name: string): FormDataEntryValue | null;
  getAll(name: string): FormDataEntryValue[];
};

export const readText = (value: FormDataEntryValue | null): string =>
  typeof value === "string" ? value.trim() : "";

export const readChecked = (value: FormDataEntryValue | null): boolean =>
  value === "on" || value === "true";

/**
 * "480", "480.5", "480.50", "1,200" and "AED 480" become fils. Empty is null.
 * Anything else — negative, three decimals, words — is refused rather than
 * guessed at, because a guessed price is a wrong price.
 */
export function parseAedToFils(raw: string, label: string): number | null {
  const cleaned = raw.replace(/^aed/i, "").replace(/[\s,]/g, "");
  if (cleaned === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    throw new FormInputError(
      `${label}: enter an amount in dirhams, like 480 or 480.50.`,
      "amountFormat",
      { label },
    );
  }
  const aed = Number(cleaned);
  if (aed > MAX_PRICE_AED) {
    throw new FormInputError(`${label} looks too high — please check the amount.`, "amountTooHigh", {
      label,
    });
  }
  /* Rounded once, here. 0.29 * 100 is 28.999… in floating point. */
  return Math.round(aed * 100);
}

export function parseWholeNumber(raw: string, label: string, allowNegative = false): number | null {
  if (raw === "") return null;
  const pattern = allowNegative ? /^-?\d+$/ : /^\d+$/;
  if (!pattern.test(raw)) {
    throw new FormInputError(
      `${label} must be a whole number${allowNegative ? "" : ", 0 or more"}.`,
      allowNegative ? "wholeNumberSigned" : "wholeNumber",
      { label },
    );
  }
  return Number(raw);
}

/** Positive integer ids, duplicates removed, first-chosen order kept. */
export function parseIdList(values: readonly FormDataEntryValue[]): number[] {
  const ids: number[] = [];
  for (const value of values) {
    const n = Number(value);
    if (Number.isInteger(n) && n > 0 && !ids.includes(n)) ids.push(n);
  }
  return ids;
}

/** A web address segment, or undefined to keep / generate one. */
export function parseSlug(raw: string): string | undefined {
  const slug = raw.toLowerCase();
  if (slug === "") return undefined;
  if (!SLUG.test(slug)) {
    throw new FormInputError(
      "The web address can only use lowercase letters, numbers and single hyphens — for example amber-hour.",
      "slugFormat",
    );
  }
  return slug;
}

export function within(value: string, max: number, label: string): string {
  if (value.length > max) {
    throw new FormInputError(`${label} is too long — keep it under ${max} characters.`, "tooLong", {
      label,
      max,
    });
  }
  return value;
}

export type ParsedProduct = {
  name: string;
  slug?: string;
  shortDescription: string | null;
  descriptionText: string;
  priceFils: number;
  compareAtPriceFils: number | null;
  category: ProductCategory;
  flowers: ProductFlower[];
  occasions: number[];
  imageIds: number[];
  available: boolean;
  featured: boolean;
  bestseller: boolean;
  newArrival: boolean;
  seasonal: boolean;
  trackStock: boolean;
  stock?: number;
  sortOrder: number;
  seoTitle: string | null;
  seoDescription: string | null;
  noIndex: boolean;
};

export function parseProductForm(form: FormReader): ParsedProduct {
  const name = within(readText(form.get("name")), 140, "The name");
  if (!name) throw new FormInputError("Give the product a name.", "nameRequired");

  const priceFils = parseAedToFils(readText(form.get("priceAed")), "Price");
  if (priceFils === null) throw new FormInputError("Enter the price in dirhams.", "priceRequired");
  if (priceFils === 0) throw new FormInputError("The price cannot be zero.", "priceZero");

  /* Empty means "not on offer" and CLEARS a previous compare-at price. It
     used to mean "leave it alone", which made an offer impossible to end. */
  const compareAtPriceFils = parseAedToFils(
    readText(form.get("compareAtPriceAed")),
    "Compare-at price",
  );
  if (compareAtPriceFils !== null && compareAtPriceFils <= priceFils) {
    throw new FormInputError(
      "The compare-at price must be higher than the price. Leave it empty if the product is not on offer.",
      "compareAtLow",
    );
  }

  const categoryRaw = readText(form.get("category"));
  const category = PRODUCT_CATEGORIES.find((c) => c.value === categoryRaw)?.value;
  if (categoryRaw && !category) {
    throw new FormInputError("Choose a category from the list.", "categoryUnknown");
  }

  const knownFlowers = new Set<string>(PRODUCT_FLOWERS.map((f) => f.value));
  const flowers = [...new Set(form.getAll("flowers").map(String))].filter(
    (f): f is ProductFlower => knownFlowers.has(f),
  );

  const imageIds = parseIdList(form.getAll("imageIds"));
  if (imageIds.length > MAX_PRODUCT_IMAGES) {
    throw new FormInputError(
      `A product can have up to ${MAX_PRODUCT_IMAGES} photos.`,
      "tooManyPhotos",
      { max: MAX_PRODUCT_IMAGES },
    );
  }

  const available = readChecked(form.get("available"));
  if (available && imageIds.length === 0) {
    throw new FormInputError(PUBLISH_NEEDS_PHOTO, "publishNeedsPhoto");
  }

  const trackStock = readChecked(form.get("trackStock"));
  const stock = parseWholeNumber(readText(form.get("stock")), "Stock") ?? undefined;
  if (trackStock && available && (stock ?? 0) <= 0) {
    throw new FormInputError(
      "This product tracks stock but has none. Add stock, stop tracking stock, or keep it hidden.",
      "stockNone",
    );
  }

  return {
    name,
    slug: parseSlug(readText(form.get("slug"))),
    shortDescription:
      within(readText(form.get("shortDescription")), 200, "The short description") || null,
    descriptionText: within(readText(form.get("descriptionText")), 10_000, "The full description"),
    priceFils,
    compareAtPriceFils,
    category: category ?? "bouquet",
    flowers,
    occasions: parseIdList(form.getAll("occasions")),
    imageIds,
    available,
    featured: readChecked(form.get("featured")),
    bestseller: readChecked(form.get("bestseller")),
    newArrival: readChecked(form.get("newArrival")),
    seasonal: readChecked(form.get("seasonal")),
    trackStock,
    stock,
    sortOrder: parseWholeNumber(readText(form.get("sortOrder")), "Shop order", true) ?? 0,
    seoTitle: within(readText(form.get("seoTitle")), 70, "The search title") || null,
    seoDescription:
      within(readText(form.get("seoDescription")), 180, "The search description") || null,
    noIndex: readChecked(form.get("noIndex")),
  };
}
