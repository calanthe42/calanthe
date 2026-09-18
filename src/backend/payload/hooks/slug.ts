import type { FieldHook } from "payload";

/**
 * Slugs are public, permanent URLs. A slug that changes breaks live links,
 * past emails and search rankings (docs/DATABASE.md §4), so it is generated
 * once from the name and then validated rather than silently rewritten.
 */

/** Combining diacritical marks, left behind by NFKD normalisation. */
const COMBINING_MARKS = /[̀-ͯ]/g;

/** URL-safe, lowercase, hyphen-separated. Diacritics are folded, not dropped. */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Fills an empty slug from another field so the client never has to think
 * about one. A slug typed by hand is respected — and validated — as-is.
 */
export const generateSlugFrom =
  (sourceField: string): FieldHook =>
  ({ data, value }) => {
    if (typeof value === "string" && value.trim() !== "") return slugify(value);
    const source = data?.[sourceField];
    return typeof source === "string" && source.trim() !== "" ? slugify(source) : value;
  };

export function validateSlug(value: string | null | undefined): true | string {
  if (!value) return "A slug is required — it becomes the page address.";
  if (!SLUG_PATTERN.test(value)) {
    return "Use lowercase letters, numbers and single hyphens only, e.g. amber-hour.";
  }
  if (value.length > 120) return "Slug is too long (120 characters maximum).";
  return true;
}
