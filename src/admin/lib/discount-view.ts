import type { Translator } from "@admin/i18n/translate";
import { dubaiDateInputValue, dubaiTimeInputValue } from "@backend/domain/dates";
import type { DiscountKind } from "@backend/domain/discount-form";
import type { DiscountStatus, DiscountValueType, SaleScope } from "@/lib/discounts";
import type { Discount } from "@/payload-types";

/**
 * A discount, in the words the owner reads.
 *
 * PURE. The list (a Server Component) and the editor (a Client Component)
 * both describe a discount — "20% off · 3 products" — and both get the
 * sentence from here, with whichever translator they hold, so the summary
 * she sees while typing is the one the list shows after she saves.
 */

/** What the editor holds: every field as the text its input shows. */
export type DiscountFormValues = {
  id?: number;
  kind: DiscountKind;
  title: string;
  code: string;
  labelEn: string;
  labelAr: string;
  valueType: DiscountValueType;
  percentOff: string;
  amountOffAed: string;
  appliesTo: SaleScope;
  productIds: string[];
  occasionIds: string[];
  categories: string[];
  /** Abu Dhabi wall time, as date and time inputs hold it. */
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  active: boolean;
  minSubtotalAed: string;
  usageLimit: string;
  oncePerCustomer: boolean;
};

export function blankDiscountValues(kind: DiscountKind): DiscountFormValues {
  return {
    kind,
    title: "",
    code: "",
    labelEn: "",
    labelAr: "",
    valueType: "percentage",
    percentOff: "",
    amountOffAed: "",
    appliesTo: "all",
    productIds: [],
    occasionIds: [],
    categories: [],
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    /* A draft, always. Going live is something she does on purpose. */
    active: false,
    minSubtotalAed: "",
    usageLimit: "",
    oncePerCustomer: false,
  };
}

const idsOf = (values: Discount["products"] | Discount["occasions"]): string[] =>
  (values ?? []).map((value) => String(typeof value === "object" && value !== null ? value.id : value));

/** Fils as the dirhams an amount input shows: 5000 → "50", 5050 → "50.50". */
const aedInput = (fils: number | null | undefined): string => {
  if (!fils || fils <= 0) return "";
  return fils % 100 === 0 ? String(fils / 100) : (fils / 100).toFixed(2);
};

export function discountFormValues(doc: Discount): DiscountFormValues {
  return {
    id: doc.id,
    kind: doc.kind,
    title: doc.title,
    code: doc.code ?? "",
    labelEn: doc.labelEn ?? "",
    labelAr: doc.labelAr ?? "",
    valueType: doc.valueType,
    percentOff: doc.percentOff ? String(doc.percentOff) : "",
    amountOffAed: aedInput(doc.amountOffFils),
    appliesTo: doc.appliesTo ?? "all",
    productIds: idsOf(doc.products),
    occasionIds: idsOf(doc.occasions),
    categories: [...(doc.categories ?? [])],
    startDate: dubaiDateInputValue(doc.startsAt),
    startTime: dubaiTimeInputValue(doc.startsAt),
    endDate: dubaiDateInputValue(doc.endsAt),
    endTime: dubaiTimeInputValue(doc.endsAt),
    active: doc.active === true,
    minSubtotalAed: aedInput(doc.minSubtotalFils),
    usageLimit: doc.usageLimit ? String(doc.usageLimit) : "",
    oncePerCustomer: doc.oncePerCustomer === true,
  };
}

/**
 * A copy to start a new discount from — last year's Eid offer, this year.
 *
 * The terms are kept; everything that made the original a particular event
 * is not: it has no dates, a code must be chosen afresh (codes are unique),
 * and it is a DRAFT whatever the original was.
 */
export function duplicateDiscountValues(doc: Discount, title: string): DiscountFormValues {
  return {
    ...discountFormValues(doc),
    id: undefined,
    title,
    code: "",
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    active: false,
  };
}

/** The date and time inputs as one instant, or null. +04:00 all year: no DST. */
export function instantFromInputs(day: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const clock = /^\d{2}:\d{2}$/.test(time) ? time : "00:00";
  const at = new Date(`${day}T${clock}:00+04:00`);
  return Number.isNaN(at.getTime()) ? null : at.toISOString();
}

export type DiscountTerms = {
  kind: DiscountKind;
  valueType: DiscountValueType;
  percentOff: number;
  amountOffFils: number;
  appliesTo: SaleScope;
  productCount: number;
  occasionCount: number;
  categoryCount: number;
  minSubtotalFils: number;
};

export function termsOf(doc: Discount): DiscountTerms {
  return {
    kind: doc.kind,
    valueType: doc.valueType,
    percentOff: Number(doc.percentOff ?? 0),
    amountOffFils: Number(doc.amountOffFils ?? 0),
    appliesTo: doc.appliesTo ?? "all",
    productCount: (doc.products ?? []).length,
    occasionCount: (doc.occasions ?? []).length,
    categoryCount: (doc.categories ?? []).length,
    minSubtotalFils: Number(doc.minSubtotalFils ?? 0),
  };
}

type Words = Pick<Translator, "t" | "plural" | "money">;

/** "20% off" / "AED 50 off". */
export function valueText(i18n: Words, d: Pick<DiscountTerms, "valueType" | "percentOff" | "amountOffFils">): string {
  return d.valueType === "percentage"
    ? i18n.t("discounts.summary.percent", { n: d.percentOff })
    : i18n.t("discounts.summary.fixed", { amount: i18n.money(d.amountOffFils) });
}

/** "All products" / "3 products" / "2 occasions" / "1 category". */
export function scopeText(i18n: Words, d: DiscountTerms): string {
  switch (d.appliesTo) {
    case "products":
      return i18n.plural("discounts.summary.products", d.productCount);
    case "occasions":
      return i18n.plural("discounts.summary.occasions", d.occasionCount);
    case "categories":
      return i18n.plural("discounts.summary.categories", d.categoryCount);
    default:
      return i18n.t("discounts.summary.allProducts");
  }
}

/** The second line of a list row: what it does, to what. */
export function summaryLine(i18n: Words, d: DiscountTerms): string {
  const value = valueText(i18n, d);
  if (d.kind === "automatic") return `${value} · ${scopeText(i18n, d)}`;
  const parts = [i18n.t("discounts.summary.entireOrder", { value })];
  if (d.minSubtotalFils > 0) {
    parts.push(i18n.t("discounts.summary.minimum", { amount: i18n.money(d.minSubtotalFils) }));
  }
  return parts.join(" · ");
}

/** "1 Oct, 18:00 – 10 Oct, 23:59", in Abu Dhabi time. */
export function datesText(
  i18n: Pick<Translator, "t" | "date">,
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
): string {
  const start = startsAt ? i18n.date(startsAt, "datetime") : i18n.t("discounts.fromActivation");
  const end = endsAt ? i18n.date(endsAt, "datetime") : i18n.t("discounts.noEndDate");
  return i18n.t("discounts.dateRange", { start, end });
}

/** The sentence under the Active switch. */
export function statusLine(
  i18n: Pick<Translator, "t" | "date">,
  status: DiscountStatus,
  startsAt: string | null | undefined,
): string {
  if (status === "scheduled") {
    return i18n.t("discounts.statusLine.scheduled", { date: i18n.date(startsAt, "datetime") });
  }
  return i18n.t(`discounts.statusLine.${status}`);
}
