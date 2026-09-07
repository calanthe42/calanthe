import type { NumberField } from "payload";

/**
 * Money fields, everywhere, are integer fils — AED × 100.
 *
 * This is not a preference. Floats cannot represent 0.1 exactly, so a
 * catalogue priced in decimal AED accumulates error the first time a
 * discount or a VAT line is computed, and the error lands in a customer's
 * receipt. CLAUDE.md and docs/DATABASE.md both state the rule; src/lib/money.ts
 * is the only conversion layer and is unit-tested.
 *
 * Field names therefore end in `Fils`, so a value's unit is visible at
 * every call site and nobody has to guess whether `price` means 480 or
 * 48000. Display formatting is `formatFils()` — never arithmetic on the
 * formatted string.
 *
 * KNOWN ADMIN UX GAP: the client types raw fils here. docs/ADMIN.md §4
 * specifies a custom AED input component that stores fils and displays
 * "AED 480.00" — the single biggest source of admin error is entering
 * 48000 when you meant 480. That component needs an importMap entry and is
 * deliberately out of scope for this step; the descriptions below are the
 * interim mitigation.
 */

const DEFAULT_DESCRIPTION =
  "Amount in fils (AED × 100). 48000 = AED 480.00. Whole numbers only.";

type FilsFieldOptions = {
  name: string;
  label?: NumberField["label"];
  required?: boolean;
  index?: boolean;
  access?: NumberField["access"];
  admin?: NumberField["admin"];
};

export function filsField(options: FilsFieldOptions): NumberField {
  const { name, label, required, index, access, admin } = options;

  return {
    name,
    type: "number",
    label,
    required,
    index,
    access,
    min: 0,
    admin: {
      ...admin,
      step: 1,
      description: admin?.description ?? DEFAULT_DESCRIPTION,
    },
    validate: (value: number | null | undefined) => {
      if (value === null || value === undefined) {
        return required ? "This amount is required." : true;
      }
      if (!Number.isInteger(value)) {
        return "Enter whole fils — no decimals. AED 480.00 is 48000.";
      }
      if (value < 0) return "Amount cannot be negative.";
      if (!Number.isSafeInteger(value)) return "Amount is out of range.";
      return true;
    },
  };
}
