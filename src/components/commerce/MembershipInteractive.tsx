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
      <div className="flex flex-wrap justify-center gap-2">
        {weekDays.map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={day === d}
            onClick={() => setDay(d)}
            className={cn(
              "flex h-11 min-w-12 items-center justify-center rounded-sm border px-2 font-brand text-[0.6875rem] font-medium uppercase tracking-[0.08em] transition-colors duration-200 ease-bloom",
              day === d
                ? "border-cream bg-cream text-olive"
                : "border-cream/30 text-cream hover:border-cream/70",
            )}
          >
            {t.enquiryForm.weekdays[d] ?? d}
          </button>
        ))}
      </div>
      <p className="mt-4 text-center text-sm text-cream/70">
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
              className="flex min-h-14 w-full items-center justify-between gap-4 py-4 text-left"
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
