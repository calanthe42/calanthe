"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { EASE_BLOOM } from "@/components/motion/constants";
import { Reveal } from "@/components/motion/Reveal";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Monogram } from "@/components/ui/Monogram";
import { cn } from "@/lib/cn";
import { useToast } from "@/lib/toast";
import {
  BYO_VASE_PRICE_AED,
  byoBudgetNote,
  byoBudgetsAed,
  byoColours,
  byoOccasionOptions,
  formatAed,
  seasonalDisclaimer,
} from "@/lib/data";

const STEPS = [
  "Budget",
  "Colours",
  "Vase",
  "Occasion",
  "Card Message",
  "For the Florist",
] as const;

import {
  chipClasses as chip,
  chipOffClasses as chipOff,
  chipOnClasses as chipOn,
  fieldClasses,
} from "@/components/ui/form-classes";

export function BuildYourOwnForm() {
  const { toast } = useToast();

  const [budget, setBudget] = useState<number | "other" | null>(null);
  const [customBudget, setCustomBudget] = useState("");
  const [colours, setColours] = useState<readonly string[]>([]);
  const [colourOther, setColourOther] = useState(false);
  const [vase, setVase] = useState<boolean | null>(null);
  const [occasion, setOccasion] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [leaveBlank, setLeaveBlank] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const budgetValue = useMemo(() => {
    if (budget === "other") {
      const n = Number.parseInt(customBudget, 10);
      return Number.isFinite(n) && n > 0 ? n : 0;
    }
    return budget ?? 0;
  }, [budget, customBudget]);

  const totalAed = budgetValue + (vase ? BYO_VASE_PRICE_AED : 0);

  /* The monogram dot sits at the first step still waiting on you. */
  const activeStep = useMemo(() => {
    if (budgetValue === 0) return 0;
    if (colours.length === 0 && !colourOther) return 1;
    if (vase === null) return 2;
    if (!occasion) return 3;
    if (!message.trim() && !leaveBlank) return 4;
    return 5;
  }, [budgetValue, colours, colourOther, vase, occasion, message, leaveBlank]);

  function handleSubmit() {
    if (budgetValue === 0) {
      toast("Choose a budget so our florists know where to begin");
      return;
    }
    if (!occasion) {
      toast("Tell us the occasion — it shapes the arrangement");
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="flex min-h-[60svh] flex-col items-center justify-center gap-6 px-6 text-center">
        <Monogram className="w-16 text-burnt-orange" />
        <h2 className="max-w-md font-display text-3xl font-light text-olive lg:text-4xl">
          Your arrangement is in our hands.
        </h2>
        <p className="max-w-sm text-base leading-relaxed text-sage">
          A florist will review your preferences and confirm on WhatsApp before composing.
          Total {formatAed(totalAed)}.
        </p>
        <p className="max-w-sm text-xs leading-relaxed text-sage">
          (UI preview — this will create a real request once the backend arrives.)
        </p>
        <Link href="/shop" className={cn(buttonClasses("secondary"), "mt-2")}>
          Continue Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="relative pb-32">
      {/* Olive progress line + travelling monogram dot */}
      <div aria-hidden className="absolute bottom-0 left-[7px] top-2 w-px bg-hairline">
        <motion.div
          className="absolute -left-[7px] flex h-[15px] w-[15px] items-center justify-center"
          animate={{ top: `${(activeStep / (STEPS.length - 1)) * 92}%` }}
          transition={{ duration: 0.6, ease: EASE_BLOOM }}
        >
          <Monogram className="w-full text-burnt-orange" />
        </motion.div>
      </div>

      <ol className="flex flex-col gap-14 pl-10 lg:gap-16">
        {/* 01 — Budget */}
        <Reveal>
          <li>
            <StepHeading index={1} active={activeStep === 0}>
              {STEPS[0]}
            </StepHeading>
            <div className="mt-4 flex flex-wrap gap-3">
              {byoBudgetsAed.map((b) => (
                <button
                  key={b}
                  type="button"
                  aria-pressed={budget === b}
                  onClick={() => setBudget(b)}
                  className={cn(chip, budget === b ? chipOn : chipOff)}
                >
                  {formatAed(b)}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={budget === "other"}
                onClick={() => setBudget("other")}
                className={cn(chip, budget === "other" ? chipOn : chipOff)}
              >
                Other
              </button>
            </div>
            <AnimatePresence>
              {budget === "other" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35, ease: EASE_BLOOM }}
                  className="mt-3"
                >
                  <label className="flex items-center gap-3 text-sm text-sage">
                    AED
                    <input
                      type="number"
                      inputMode="numeric"
                      min={150}
                      value={customBudget}
                      onChange={(e) => setCustomBudget(e.target.value)}
                      placeholder="Your budget"
                      className={cn(fieldClasses, "w-36 px-3 py-2.5")}
                    />
                  </label>
                </motion.div>
              )}
            </AnimatePresence>
            <p className="mt-3 max-w-md text-sm italic leading-relaxed text-sage">
              {byoBudgetNote}
            </p>
          </li>
        </Reveal>

        {/* 02 — Colours */}
        <Reveal>
          <li>
            <StepHeading index={2} active={activeStep === 1}>
              {STEPS[1]}
            </StepHeading>
            <p className="mt-1 text-sm text-sage">Choose as many as you like.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {byoColours.map((c) => {
                const on = colours.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setColours((prev) =>
                        on ? prev.filter((x) => x !== c) : [...prev, c],
                      )
                    }
                    className={cn(chip, on ? chipOn : chipOff)}
                  >
                    {c}
                  </button>
                );
              })}
              <button
                type="button"
                aria-pressed={colourOther}
                onClick={() => setColourOther((v) => !v)}
                className={cn(chip, colourOther ? chipOn : chipOff)}
              >
                Other — florist&apos;s choice
              </button>
            </div>
          </li>
        </Reveal>

        {/* 03 — Vase */}
        <Reveal>
          <li>
            <StepHeading index={3} active={activeStep === 2}>
              {STEPS[2]}
            </StepHeading>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                aria-pressed={vase === true}
                onClick={() => setVase(true)}
                className={cn(
                  chip,
                  "flex-col gap-0.5 px-6 py-3",
                  vase === true ? chipOn : chipOff,
                )}
              >
                <span>Yes, include a vase</span>
                <span className="text-xs text-sage">
                  +{formatAed(BYO_VASE_PRICE_AED)}
                </span>
              </button>
              <button
                type="button"
                aria-pressed={vase === false}
                onClick={() => setVase(false)}
                className={cn(chip, "px-6", vase === false ? chipOn : chipOff)}
              >
                No, hand-tied only
              </button>
            </div>
          </li>
        </Reveal>

        {/* 04 — Occasion */}
        <Reveal>
          <li>
            <StepHeading index={4} active={activeStep === 3}>
              {STEPS[3]}
            </StepHeading>
            <div className="mt-4 flex flex-wrap gap-3">
              {byoOccasionOptions.map((o) => (
                <button
                  key={o}
                  type="button"
                  aria-pressed={occasion === o}
                  onClick={() => setOccasion(o)}
                  className={cn(chip, occasion === o ? chipOn : chipOff)}
                >
                  {o}
                </button>
              ))}
            </div>
          </li>
        </Reveal>

        {/* 05 — Card message */}
        <Reveal>
          <li>
            <StepHeading index={5} active={activeStep === 4}>
              {STEPS[4]}
            </StepHeading>
            <textarea
              value={message}
              onChange={(e) => {
                setMessage(e.target.value.slice(0, 220));
                if (e.target.value) setLeaveBlank(false);
              }}
              rows={3}
              disabled={leaveBlank}
              placeholder="Write the words they'll keep…"
              className={cn(fieldClasses, "mt-4 disabled:opacity-50")}
            />
            <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 text-sm text-sage">
              <input
                type="checkbox"
                checked={leaveBlank}
                onChange={(e) => {
                  setLeaveBlank(e.target.checked);
                  if (e.target.checked) setMessage("");
                }}
                className="h-4 w-4 accent-[#2b2f1b]"
              />
              Leave the card blank
            </label>
          </li>
        </Reveal>

        {/* 06 — Florist notes */}
        <Reveal>
          <li>
            <StepHeading index={6} active={activeStep === 5}>
              {STEPS[5]}
            </StepHeading>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 400))}
              rows={3}
              placeholder="Allergies, flowers to avoid, a style you love — anything that helps."
              className={cn(fieldClasses, "mt-4")}
            />
          </li>
        </Reveal>
      </ol>

      <p className="mt-10 max-w-md pl-10 text-xs leading-relaxed text-sage">
        {seasonalDisclaimer}
      </p>

      {/* Sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-canvas px-6 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3">
        <div className="mx-auto max-w-3xl">
          <Button variant="primary" className="w-full" onClick={handleSubmit}>
            Create My Arrangement{totalAed > 0 && <> — {formatAed(totalAed)}</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

function StepHeading({
  index,
  active,
  children,
}: {
  index: number;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <h2
      className={cn(
        "font-brand text-xs font-medium uppercase tracking-brand transition-colors duration-300 ease-bloom",
        active ? "text-burnt-orange" : "text-olive",
      )}
    >
      <span className="mr-2 text-sage">0{index}</span>
      {children}
    </h2>
  );
}
