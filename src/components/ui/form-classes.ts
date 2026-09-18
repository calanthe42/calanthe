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
