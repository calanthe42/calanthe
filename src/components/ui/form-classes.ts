/** Shared form styling — one source of truth for inputs, labels, chips. */

/* Focus is a border change PLUS a 1px olive ring: a hairline turning olive on
   its own is too slight to find with a keyboard. `aria-[invalid=true]` gives
   every field the same error treatment without a second class list. */
export const fieldClasses =
  "w-full rounded-sm border border-hairline bg-canvas px-4 py-3 text-base text-olive placeholder:text-sage/70 transition-[border-color,box-shadow] duration-200 ease-bloom focus:border-olive focus:shadow-[0_0_0_1px_var(--color-olive)] focus:outline-none aria-[invalid=true]:border-burnt-orange";

/** The line under a field that stops the order. */
export const fieldErrorClasses = "mt-2 flex gap-2 text-sm leading-snug text-olive";

export const labelClasses =
  "mb-2 block font-brand text-[0.625rem] font-medium uppercase tracking-brand text-sage";

export const chipClasses =
  "flex min-h-11 items-center justify-center rounded-sm border px-4 text-center text-sm transition-colors duration-200 ease-bloom";

export const chipOffClasses = "border-hairline text-olive hover:border-sage";

export const chipOnClasses = "border-olive bg-cream text-olive";

/* ------------------------------------------------------------------ */
/* Choosing, the Calanthe way                                          */
/* ------------------------------------------------------------------ */

/**
 * AN OPTION IS A LINE, NOT A BOX.
 *
 * Build Your Own used `chipClasses` for everything — occasion, budget,
 * colour, vase — so eight ways of describing an arrangement all arrived as
 * the same bordered rectangle. That is a form, and the point of this page is
 * that it is a consultation.
 *
 * The treatment here is the storefront's own grammar, which is already used
 * by the shop's category row and the occasion band: the label sits on a
 * hairline, and choosing draws that hairline in burnt orange from the
 * reading edge. Nothing fills, nothing shadows, nothing rounds. The
 * difference between chosen and not is a line and a weight, which is how the
 * rest of the site already speaks.
 *
 * `group/opt` is on the button so the rule can respond to hover and focus
 * without JavaScript.
 */
export const optionClasses =
  "group/opt relative flex min-h-12 w-full items-baseline justify-between gap-3 " +
  "px-1 pb-2.5 pt-3 text-start transition-colors duration-200 ease-bloom " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-olive";

export const optionLabelOff = "font-display text-lg font-light text-olive/70 lg:text-xl";
export const optionLabelOn = "font-display text-lg font-light text-olive lg:text-xl";

/** The rule under an option. Grows from the reading edge when chosen. */
export const optionRule =
  "pointer-events-none absolute inset-x-0 bottom-0 h-px bg-hairline";
export const optionRuleFill =
  "block h-px origin-[left_center] bg-burnt-orange transition-transform duration-300 ease-bloom rtl:origin-[right_center]";

/** The small mark that confirms a choice, so it is never colour alone. */
export const optionTick =
  "shrink-0 font-brand text-[0.5625rem] uppercase tracking-brand transition-opacity duration-200";
