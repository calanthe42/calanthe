"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { EASE_BLOOM } from "@/components/motion/constants";
import { cn } from "@/lib/cn";
import { membershipFaq, weekDays } from "@/lib/data";

export function DayPicker() {
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
              "flex h-11 w-12 items-center justify-center rounded-sm border font-brand text-[0.6875rem] font-medium uppercase tracking-[0.08em] transition-colors duration-200 ease-bloom",
              day === d
                ? "border-cream bg-cream text-olive"
                : "border-cream/30 text-cream hover:border-cream/70",
            )}
          >
            {d}
          </button>
        ))}
      </div>
      <p className="mt-4 text-center text-sm text-cream/70">
        Your flowers will arrive every {dayName(day)}.
      </p>
    </div>
  );
}

function dayName(short: string): string {
  const names: Record<string, string> = {
    Sun: "Sunday",
    Mon: "Monday",
    Tue: "Tuesday",
    Wed: "Wednesday",
    Thu: "Thursday",
    Fri: "Friday",
    Sat: "Saturday",
  };
  return names[short] ?? short;
}

export function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <ul className="divide-y divide-hairline border-b border-t border-hairline">
      {membershipFaq.map((item, i) => {
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
                  "shrink-0 text-sage transition-transform duration-300 ease-bloom",
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
                  <p className="max-w-xl pb-5 text-base leading-relaxed text-sage">
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
