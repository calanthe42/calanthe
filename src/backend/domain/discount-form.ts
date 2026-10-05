import { dubaiDateTimeToIso } from "@backend/domain/dates";
import { FormInputError } from "@backend/domain/form-error";
import {
  PRODUCT_CATEGORIES,
  parseAedToFils,
  parseIdList,
  readChecked,
  readText,
  within,
  type FormReader,
  type ProductCategory,
} from "@backend/domain/product-form";
import {
  CODE_PATTERN,
  MAX_DISCOUNT_PERCENT,
  SALE_LABEL_MAX,
  normaliseCode,
  type DiscountValueType,
  type SaleScope,
} from "@/lib/discounts";

/**
 * Reading the discount editor into a discount record.
 *
 * PURE — no Payload, no request, no database — so every rule is unit tested,
 * and the server action that calls it does only what needs a server.
 *
 * MONEY: the owner types dirhams; this is the one place they become fils. A
 * `amountOffFils` smuggled into the form is never looked at.
 *
 * TIME: the form's date and time inputs are Abu Dhabi wall time and become
 * UTC instants here (backend/domain/dates.ts).
 *
 * ACTIVE IS ONLY A REQUEST. `active` reports what the form asked for and
 * `confirmed` whether the owner confirmed it in the dialog that states what
 * will change. Whether the discount is actually saved live is decided by the
 * action (backend/actions/discounts.ts), never here: a discount is a draft
 * unless she explicitly activates it.
 *
 * The collection's own hook (validateDiscount) re-checks what matters, so
 * this is the friendly first line, not the only one.
 */

export type DiscountKind = "automatic" | "code";

export type ParsedDiscount = {
  kind: DiscountKind;
  title: string;
  /** Uppercase; null for an automatic sale. */
  code: string | null;
  valueType: DiscountValueType;
  percentOff: number | null;
  amountOffFils: number | null;
  appliesTo: SaleScope;
  productIds: number[];
  occasionIds: number[];
  categories: ProductCategory[];
  labelEn: string | null;
  labelAr: string | null;
  /** ISO instants. Null start = from now; null end = no end. */
  startsAt: string | null;
  endsAt: string | null;
  /** What the form asked for — see the note above. */
  active: boolean;
  /** The owner confirmed going live in the dialog. */
  confirmed: boolean;
  minSubtotalFils: number | null;
  usageLimit: number | null;
  oncePerCustomer: boolean;
};

const SCOPES: readonly SaleScope[] = ["all", "products", "occasions", "categories"];

function parseValue(form: FormReader): Pick<ParsedDiscount, "valueType" | "percentOff" | "amountOffFils"> {
  const valueType = readText(form.get("valueType"));

  if (valueType === "percentage") {
    const raw = readText(form.get("percentOff"));
    const percent = Number(raw);
    /* Whole numbers only: "20.5" is refused, not rounded. */
    if (!/^\d+$/.test(raw) || percent < 1 || percent > MAX_DISCOUNT_PERCENT) {
      throw new FormInputError(
        `Percentage off must be a whole number from 1 to ${MAX_DISCOUNT_PERCENT}.`,
        "percentRange",
        { label: "Percentage off" },
      );
    }
    return { valueType, percentOff: percent, amountOffFils: null };
  }

  if (valueType === "fixed") {
    const amount = parseAedToFils(readText(form.get("amountOffAed")), "Amount off");
    if (amount === null || amount < 100) {
      throw new FormInputError("Amount off must be at least AED 1.", "amountMin", {
        label: "Amount off",
      });
    }
    return { valueType, percentOff: null, amountOffFils: amount };
  }

  throw new FormInputError("Choose a percentage or a fixed amount.", "valueTypeRequired");
}

function parseWindow(form: FormReader): Pick<ParsedDiscount, "startsAt" | "endsAt"> {
  const startDate = readText(form.get("startDate"));
  const endDate = readText(form.get("endDate"));
  const startsAt = startDate ? dubaiDateTimeToIso(startDate, readText(form.get("startTime"))) : null;
  /* The form always sends a time with a date. Should one be missing, the
     start of that day is used — and shown back to her as 00:00. */
  const endsAt = endDate ? dubaiDateTimeToIso(endDate, readText(form.get("endTime"))) : null;

  if (startsAt && endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    throw new FormInputError("The end must be after the start.", "endBeforeStart");
  }
  return { startsAt, endsAt };
}

export function parseDiscountForm(form: FormReader, kind: DiscountKind): ParsedDiscount {
  const value = parseValue(form);
  const window = parseWindow(form);
  const active = readChecked(form.get("active"));
  const confirmed = readChecked(form.get("confirmActivation"));

  if (kind === "code") {
    const code = normaliseCode(readText(form.get("code")));
    if (!CODE_PATTERN.test(code)) {
      throw new FormInputError(
        "Use 3 to 24 letters and numbers for the code, with no spaces.",
        "codeFormat",
      );
    }

    const minimum = parseAedToFils(readText(form.get("minSubtotalAed")), "Minimum purchase");

    const limitRaw = readText(form.get("usageLimit"));
    let usageLimit: number | null = null;
    if (limitRaw !== "") {
      if (!/^\d+$/.test(limitRaw) || Number(limitRaw) < 1) {
        throw new FormInputError("Usage limit must be a whole number, 1 or more.", "usageLimitMin", {
          label: "Usage limit",
        });
      }
      usageLimit = Number(limitRaw);
    }

    return {
      kind,
      /* The internal name defaults to the code itself. */
      title: within(readText(form.get("title")), 80, "The title") || code,
      code,
      ...value,
      /* A code applies to the whole order in this version. */
      appliesTo: "all",
      productIds: [],
      occasionIds: [],
      categories: [],
      labelEn: null,
      labelAr: null,
      ...window,
      active,
      confirmed,
      minSubtotalFils: minimum && minimum > 0 ? minimum : null,
      usageLimit,
      oncePerCustomer: readChecked(form.get("oncePerCustomer")),
    };
  }

  /* ---------- automatic sale ---------- */
  const title = within(readText(form.get("title")), 80, "The title");
  if (!title) throw new FormInputError("Give the discount a name.", "discountTitle");

  const labelEn = within(readText(form.get("labelEn")), SALE_LABEL_MAX, "The label");
  const labelAr = within(readText(form.get("labelAr")), SALE_LABEL_MAX, "The label");
  if (!labelEn || !labelAr) {
    throw new FormInputError("Add the customer label in both English and Arabic.", "labelRequired");
  }

  const scopeRaw = readText(form.get("appliesTo")) || "all";
  const appliesTo = SCOPES.find((s) => s === scopeRaw);
  if (!appliesTo) {
    throw new FormInputError("Choose what the sale applies to.", "appliesToUnknown");
  }

  const known = new Set<string>(PRODUCT_CATEGORIES.map((c) => c.value));
  const productIds = appliesTo === "products" ? parseIdList(form.getAll("productIds")) : [];
  const occasionIds = appliesTo === "occasions" ? parseIdList(form.getAll("occasionIds")) : [];
  const categories =
    appliesTo === "categories"
      ? [...new Set(form.getAll("categories").map(String))].filter((c): c is ProductCategory =>
          known.has(c),
        )
      : [];

  const chosen: Record<Exclude<SaleScope, "all">, [number, string]> = {
    products: [productIds.length, "Products"],
    occasions: [occasionIds.length, "Occasions"],
    categories: [categories.length, "Categories"],
  };
  if (appliesTo !== "all") {
    const [count, label] = chosen[appliesTo];
    if (count === 0) {
      throw new FormInputError(`Choose at least one item for “${label}”.`, "pickAtLeastOne", {
        label,
      });
    }
  }

  return {
    kind,
    title,
    code: null,
    ...value,
    appliesTo,
    productIds,
    occasionIds,
    categories,
    labelEn,
    labelAr,
    ...window,
    active,
    confirmed,
    /* Code-only fields are dropped for a sale, whatever the form sent. */
    minSubtotalFils: null,
    usageLimit: null,
    oncePerCustomer: false,
  };
}

/** The parsed form as the `discounts` collection stores it. */
export function discountFields(parsed: ParsedDiscount, active: boolean) {
  return {
    title: parsed.title,
    code: parsed.code,
    valueType: parsed.valueType,
    percentOff: parsed.percentOff,
    amountOffFils: parsed.amountOffFils,
    appliesTo: parsed.appliesTo,
    products: parsed.productIds,
    occasions: parsed.occasionIds,
    categories: parsed.categories,
    labelEn: parsed.labelEn,
    labelAr: parsed.labelAr,
    startsAt: parsed.startsAt,
    endsAt: parsed.endsAt,
    active,
    minSubtotalFils: parsed.minSubtotalFils,
    usageLimit: parsed.usageLimit,
    oncePerCustomer: parsed.oncePerCustomer,
  };
}
