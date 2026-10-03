"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { EASE_BLOOM } from "@/components/motion/constants";
import { cn } from "@/lib/cn";
import { weekDays, type FaqItem } from "@/lib/data";
import { useT } from "@/lib/locale";

export function DayPicker() {
  const t = useT();
  const [day, setDay] = useState<string>("Thu");

  return (
    <div>
      {/* Phone: an even 4 + 3, the short row centred (an 8-column grid,
          each day two columns wide, the fifth day starting one column in).
          Wider screens: one row of seven. */}
      <div className="mx-auto grid max-w-sm grid-cols-8 gap-2 [&>*]:col-span-2 [&>*:nth-child(5)]:col-start-2 sm:flex sm:max-w-none sm:flex-wrap sm:justify-center">
        {weekDays.map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={day === d}
            onClick={() => setDay(d)}
            className={cn(
              /* Styled for the cream section it sits on. It was written for
                 a dark ground — cream text on a cream band — so six of the
                 seven days and the line below were invisible, and the
                 section read as an empty space with one word in it. */
              "flex h-12 min-w-[3.25rem] items-center justify-center rounded-sm border px-2.5 font-brand text-xs font-medium uppercase tracking-[0.08em] transition-colors duration-200 ease-bloom focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-olive",
              day === d
                ? "border-olive bg-olive text-cream"
                : "border-hairline bg-canvas/70 text-olive hover:border-sage",
            )}
          >
            {t.enquiryForm.weekdays[d] ?? d}
          </button>
        ))}
      </div>
      <p aria-live="polite" className="mt-7 text-center font-display text-2xl font-light text-olive lg:text-3xl">
        {t.membership.arrivesEvery.replace("{day}", t.membership.dayFull[day] ?? day)}
      </p>
    </div>
  );
}
export function FaqAccordion({ items }: { items: readonly FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <ul className="divide-y divide-hairline border-b border-t border-hairline">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <li key={item.q}>
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex min-h-14 w-full items-center justify-between gap-4 py-4 text-start"
            >
              <span className="font-display text-lg font-normal text-olive lg:text-xl">
                {item.q}
              </span>
              <span
                aria-hidden
                className={cn(
                  "shrink-0 text-ink-muted transition-transform duration-300 ease-bloom",
                  isOpen && "rotate-45",
                )}
              >
                +
              </span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.4, ease: EASE_BLOOM }}
                  className="overflow-hidden"
                >
                  <p className="max-w-xl pb-5 text-base leading-relaxed text-ink-muted">
                    {item.a}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        );
      })}
    </ul>
  );
}
