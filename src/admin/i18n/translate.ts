import { formatFils } from "@/lib/money";
import { directionFor, type AdminLocale, type Direction } from "@admin/preferences";
import type { en } from "./en";

/**
 * The admin's translator.
 *
 * PURE: it takes a dictionary and a locale and returns functions. The server
 * builds one per request from the cookie; the client builds the same thing
 * from the dictionary the layout hands it. There is exactly one set of rules
 * for looking up words, pluralising and formatting money and dates.
 *
 * THE ENGLISH DICTIONARY IS THE SCHEMA. `Messages` is derived from en.ts, so
 * the Arabic dictionary fails to compile if it misses a key, and `t()` fails
 * to compile if a component asks for a key that does not exist. A typo in a
 * translation key is a build error, not a blank label in production.
 */

/** CLDR plural categories. Arabic uses all six; English uses one and other. */
export type PluralForms = {
  one: string;
  other: string;
  zero?: string;
  two?: string;
  few?: string;
  many?: string;
};

type Widen<T> = T extends string
  ? string
  : T extends { one: string; other: string }
    ? PluralForms
    : { [K in keyof T]: Widen<T[K]> };

export type Messages = Widen<typeof en>;

type Join<P extends string, K extends string> = P extends "" ? K : `${P}.${K}`;

type StringKeys<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? Join<P, K>
    : T[K] extends { one: string; other: string }
      ? never
      : T[K] extends object
        ? StringKeys<T[K], Join<P, K>>
        : never;
}[keyof T & string];

type PluralKeys<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? never
    : T[K] extends { one: string; other: string }
      ? Join<P, K>
      : T[K] extends object
        ? PluralKeys<T[K], Join<P, K>>
        : never;
}[keyof T & string];

/** Every plain string, except the enumeration tables (use `label()` for those). */
export type MessageKey = StringKeys<Omit<typeof en, "labels">>;
export type PluralKey = PluralKeys<typeof en>;
export type LabelGroup = keyof typeof en.labels;

export type Vars = Record<string, string | number>;
export type DateStyle = "short" | "long" | "weekday" | "datetime" | "monthYear" | "time";

export type Translator = {
  locale: AdminLocale;
  dir: Direction;
  t: (key: MessageKey, vars?: Vars) => string;
  plural: (key: PluralKey, count: number, vars?: Vars) => string;
  /** A stored value (a status, an emirate, a category) in the reader's words. */
  label: (group: LabelGroup, value: string | null | undefined) => string;
  money: (fils: number) => string;
  number: (value: number) => string;
  date: (iso: string | null | undefined, style?: DateStyle) => string;
  /**
   * A server result in the reader's language: `code` is a dictionary path
   * returned by an action; `fallback` is its English message, used when the
   * code is absent or unknown.
   */
  resolve: (code: string | undefined, vars: Vars | undefined, fallback: string) => string;
};

export function interpolate(text: string, vars?: Vars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match,
  );
}

function lookup(tree: unknown, key: string): unknown {
  let node: unknown = tree;
  for (const part of key.split(".")) {
    if (!node || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

/** SCREAMING_SNAKE or kebab-case, as a last resort for a value with no translation. */
export function humanize(value: string): string {
  return value
    .toLowerCase()
    .split(/[_-]/)
    .filter(Boolean)
    .join(" ")
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * Western (Latin) digits in both languages. UAE business software, receipts
 * and phone numbers use them, and a price must read identically to the owner
 * whichever language her admin is in.
 */
export function intlLocale(locale: AdminLocale): string {
  return locale === "ar" ? "ar-AE-u-nu-latn" : "en-AE";
}

const DATE_OPTIONS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  short: { day: "numeric", month: "short" },
  long: { day: "numeric", month: "long", year: "numeric" },
  weekday: { weekday: "short", day: "numeric", month: "short" },
  datetime: { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" },
  monthYear: { month: "long", year: "numeric" },
  time: { hour: "2-digit", minute: "2-digit" },
};

export function createTranslator(locale: AdminLocale, messages: Messages): Translator {
  const intl = intlLocale(locale);
  const pluralRules = new Intl.PluralRules(intl);
  const numberFormat = new Intl.NumberFormat(intl);

  const t = (key: MessageKey, vars?: Vars): string => {
    const value = lookup(messages, key);
    return typeof value === "string" ? interpolate(value, vars) : key;
  };

  const plural = (key: PluralKey, count: number, vars?: Vars): string => {
    const forms = lookup(messages, key) as PluralForms | undefined;
    if (!forms || typeof forms !== "object") return key;
    /* Exact zero first where a language has a dedicated form for it. */
    const category = count === 0 && forms.zero ? "zero" : pluralRules.select(count);
    const text = forms[category as keyof PluralForms] ?? forms.other;
    return interpolate(text, { count: numberFormat.format(count), ...vars });
  };

  const label = (group: LabelGroup, value: string | null | undefined): string => {
    if (!value) return "";
    const table = messages.labels[group] as Record<string, string> | undefined;
    return table?.[value] ?? humanize(value);
  };

  const date = (iso: string | null | undefined, style: DateStyle = "short"): string => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    /* The business is in the UAE, whatever the server's clock says. */
    return d.toLocaleString(intl, { ...DATE_OPTIONS[style], timeZone: "Asia/Dubai" });
  };

  const resolve = (code: string | undefined, vars: Vars | undefined, fallback: string): string => {
    if (!code) return fallback;
    const node = lookup(messages, code);
    const local: Vars | undefined = vars ? { ...vars } : undefined;
    /* Field names inside validation messages arrive in English from the
       domain ("Price"); show them in the reader's language. */
    if (local && typeof local.label === "string") {
      const translated = (messages.actions.fieldLabels as Record<string, string>)[local.label];
      if (translated) local.label = translated;
    }
    if (typeof node === "string") return interpolate(node, local);
    if (node && typeof node === "object" && "other" in node && typeof local?.count === "number") {
      const forms = node as PluralForms;
      const count = local.count;
      const category = count === 0 && forms.zero ? "zero" : pluralRules.select(count);
      const text = forms[category as keyof PluralForms] ?? forms.other;
      return interpolate(text, { ...local, count: numberFormat.format(count) });
    }
    return fallback;
  };

  return {
    locale,
    dir: directionFor(locale),
    t,
    plural,
    label,
    resolve,
    /* "AED 1,234.50" in both languages: the currency code is how prices are
       printed on UAE receipts, and it keeps money unambiguous in RTL text. */
    money: (fils) => formatFils(Math.max(0, Math.round(fils))),
    number: (value) => numberFormat.format(value),
    date,
  };
}
