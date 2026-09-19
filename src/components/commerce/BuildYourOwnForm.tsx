"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { EASE_BLOOM } from "@/components/motion/constants";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Monogram } from "@/components/ui/Monogram";
import {
  chipClasses as chip,
  chipOffClasses as chipOff,
  chipOnClasses as chipOn,
  fieldClasses,
  fieldErrorClasses,
  labelClasses,
} from "@/components/ui/form-classes";
import { bespokeTotalAed, bespokeWhatsAppHref, type BespokeRequest } from "@/lib/bespoke";
import { submitBespokeEnquiry } from "@backend/actions/enquiry";
import { cn } from "@/lib/cn";
import { useLenisInstance } from "@/lib/lenis-context";
import {
  BYO_VASE_PRICE_AED,
  byoBudgetNote,
  byoBudgetsAed,
  BYO_MIN_BUDGET_AED,
  byoColours,
  byoOccasionOptions,
  formatAed,
  seasonalDisclaimer,
} from "@/lib/data";

/**
 * Build Your Own, as a consultation rather than a form.
 *
 * The occasion comes first because it is how a person thinks about the gift,
 * and everything after it (budget, colours, vase, card) is shaped by it. Each
 * choice lands in "Your arrangement" as it is made — beside the steps on
 * desktop, as a review step on a phone — so the request she sends is one she
 * has already read.

 * SENDING RECORDS IT. This used to serialise the brief into a WhatsApp URL
 * and open a tab — if the visitor never pressed send, the atelier never knew
 * the enquiry existed. It now writes a real Enquiry (type BUILD_YOUR_OWN)
 * that appears in /admin, and offers WhatsApp alongside for anyone who would
 * rather talk it through.
 */

const STEPS = [
  { id: "occasion", title: "What is the occasion?" },
  { id: "budget", title: "Your budget" },
  { id: "colours", title: "Colours" },
  { id: "vase", title: "A vase?" },
  { id: "card", title: "The card" },
  { id: "notes", title: "For the florist" },
  /* WHO RECEIVES THEM decides which details the atelier needs next, so it
     is asked before the details rather than after. A gift needs a second
     name and number to deliver to; an arrangement for yourself needs one
     address and no recipient at all. */
  { id: "gift", title: "Who is it for?" },
  /* A brief without a name is a brief the atelier cannot answer. This step
     is what turns Build Your Own from a WhatsApp draft into a real enquiry
     the florist can call back on. */
  { id: "contact", title: "Where to reach you" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

export function BuildYourOwnForm() {
  const lenis = useLenisInstance();

  const [occasion, setOccasion] = useState<string | null>(null);
  const [budget, setBudget] = useState<number | "other" | null>(null);
  const [customBudget, setCustomBudget] = useState("");
  const [colours, setColours] = useState<readonly string[]>([]);
  const [colourOther, setColourOther] = useState(false);
  const [vase, setVase] = useState<boolean | null>(null);
  const [message, setMessage] = useState("");
  const [leaveBlank, setLeaveBlank] = useState(false);
  const [notes, setNotes] = useState("");
  const [isGift, setIsGift] = useState<boolean | null>(null);
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const stepRefs = useRef<Partial<Record<StepId, HTMLLIElement | null>>>({});

  const budgetValue = useMemo(() => {
    if (budget === "other") {
      const n = Number.parseInt(customBudget, 10);
      /* Below the floor counts as no budget, so the form blocks and
         explains rather than silently accepting an order we can't make. */
      return Number.isFinite(n) && n >= BYO_MIN_BUDGET_AED ? n : 0;
    }
    return budget ?? 0;
  }, [budget, customBudget]);

  const request: BespokeRequest = {
    budgetAed: budgetValue,
    colours,
    floristChoosesColours: colourOther,
    vase,
    vasePriceAed: BYO_VASE_PRICE_AED,
    occasion: occasion ?? "",
    cardMessage: message,
    leaveCardBlank: leaveBlank,
    notes,
  };
  const totalAed = bespokeTotalAed(request);
  const whatsappHref = bespokeWhatsAppHref(request);

  /* The monogram on the rail sits at the first step still waiting on you. */
  const activeIndex = useMemo(() => {
    if (!occasion) return 0;
    if (budgetValue === 0) return 1;
    if (colours.length === 0 && !colourOther) return 2;
    if (vase === null) return 3;
    if (!message.trim() && !leaveBlank) return 4;
    /* The rail's marker rests on "For the florist" until there is something
       to reach the customer by — contact is the last thing still waiting. */
    if (!notes.trim()) return 5;
    if (isGift === null) return 6;
    return 7;
  }, [occasion, budgetValue, colours, colourOther, vase, message, leaveBlank, notes, isGift]);

  const errors: Partial<Record<StepId, string>> = attempted
    ? {
        ...(!occasion
          ? { occasion: "Choose the occasion. It shapes the arrangement." }
          : {}),
        ...(budgetValue === 0
          ? {
              budget:
                budget === "other" && customBudget
                  ? `The smallest arrangement we compose is ${formatAed(BYO_MIN_BUDGET_AED)}.`
                  : "Choose a budget so the florist knows where to begin.",
            }
          : {}),
      }
    : {};

  async function handleSubmit() {
    setAttempted(true);
    const missing: StepId | null = !occasion
      ? "occasion"
      : budgetValue === 0
        ? "budget"
        : isGift === null
        ? "gift"
        : !name.trim() || !phone.trim() || !email.trim()
          ? "contact"
          : null;
    if (missing) {
      const step = stepRefs.current[missing];
      step?.scrollIntoView({ block: "center" });
      step?.querySelector<HTMLElement>("button, input")?.focus({ preventScroll: true });
      return;
    }

    setSending(true);
    setError(null);
    const result = await submitBespokeEnquiry({
      name,
      email,
      phone,
      isGift: isGift === true,
      recipientName: isGift ? recipientName : undefined,
      recipientPhone: isGift ? recipientPhone : undefined,
      deliveryLocation: deliveryLocation || undefined,
      occasion: occasion ?? "",
      budgetAed: budgetValue,
      colours,
      floristChoosesColours: colourOther,
      vase,
      cardMessage: message,
      leaveCardBlank: leaveBlank,
      notes,
      totalAed,
    });
    setSending(false);

    if (!result.ok) {
      setError({ code: result.code, message: result.message });
      const step = stepRefs.current[result.code === "budget" ? "budget" : "contact"];
      step?.scrollIntoView({ block: "center" });
      return;
    }
    setReference(result.reference);
    setSubmitted(true);
  }

  /* The send button sits at the foot of a long form, and the confirmation
     that replaces it is short — without this a phone is left looking at the
     footer. Instant jump: the view changed, not the page's position in it. */
  useEffect(() => {
    if (!submitted) return;
    if (lenis) lenis.scrollTo(0, { immediate: true });
    else window.scrollTo({ top: 0 });
  }, [submitted, lenis]);

  if (submitted) {
    /* pb clears the floating WhatsApp button, which is fixed bottom-end and
       was landing on top of this screen's own WhatsApp link. */
    return (
      <div className="mx-auto flex min-h-[60svh] max-w-xl flex-col items-center justify-center gap-6 pb-24 text-center lg:pb-12">
        <Monogram className="w-16 text-burnt-orange" />
        <h2 className="font-display text-3xl font-light leading-tight text-olive lg:text-4xl">
          Your request is with the atelier.
        </h2>
        <p className="max-w-md text-base leading-relaxed text-ink-muted">
          A florist will be in touch to confirm the arrangement, the delivery and
          the total of {formatAed(totalAed)} before composing. Nothing has been
          charged.
        </p>
        {reference && (
          <p className="font-brand text-[0.625rem] uppercase tracking-brand text-ink-muted">
            Reference {reference}
          </p>
        )}
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            className={buttonClasses("secondary", "whitespace-nowrap")}
          >
            Also message on WhatsApp
          </a>
          <button
            type="button"
            onClick={() => setSubmitted(false)}
            className={buttonClasses("secondary", "whitespace-nowrap")}
          >
            Edit My Choices
          </button>
        </div>
        <Link
          href="/shop"
          className="min-h-11 content-center text-sm text-ink-muted underline decoration-hairline underline-offset-4 hover:text-olive"
        >
          Continue shopping
        </Link>
      </div>
    );
  }

  const summary = (
    <Summary
      occasion={occasion}
      budgetAed={budgetValue}
      colours={colourOther ? [...colours, "Florist's choice"] : colours}
      vase={vase}
      message={message}
      leaveBlank={leaveBlank}
      notes={notes}
      totalAed={totalAed}
    />
  );

  return (
    <div className="grid grid-cols-1 gap-12 pb-28 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-16 lg:pb-0">
      <div className="relative">
        {/* The rail and the monogram travelling down it. */}
        <div aria-hidden className="absolute bottom-6 left-[7px] top-3 w-px bg-hairline">
          <motion.div
            className="absolute -left-[7px] flex h-[15px] w-[15px] items-center justify-center"
            animate={{ top: `${(activeIndex / (STEPS.length - 1)) * 96}%` }}
            transition={{ duration: 0.6, ease: EASE_BLOOM }}
          >
            <Monogram className="w-full text-burnt-orange" />
          </motion.div>
        </div>

        <ol className="flex flex-col gap-14 pl-10 lg:gap-16">
          <Step
            index={0}
            active={activeIndex === 0}
            done={activeIndex > 0}
            error={errors.occasion}
            stepRef={(el) => {
              stepRefs.current.occasion = el;
            }}
          >
            <div className="flex flex-wrap gap-2.5">
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
          </Step>

          <Step
            index={1}
            active={activeIndex === 1}
            done={activeIndex > 1}
            error={errors.budget}
            stepRef={(el) => {
              stepRefs.current.budget = el;
            }}
          >
            <div className="flex flex-wrap gap-2.5">
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
                Another amount
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
                  <label className="flex items-center gap-3 text-sm text-ink-muted">
                    AED
                    <input
                      type="number"
                      inputMode="numeric"
                      min={BYO_MIN_BUDGET_AED}
                      value={customBudget}
                      onChange={(e) => setCustomBudget(e.target.value)}
                      placeholder={`From ${BYO_MIN_BUDGET_AED}`}
                      aria-label="Your budget in AED"
                      className={cn(fieldClasses, "w-36 px-3 py-2.5")}
                    />
                  </label>
                </motion.div>
              )}
            </AnimatePresence>
            <p className="mt-3 max-w-md text-sm italic leading-relaxed text-ink-muted">
              {byoBudgetNote}
            </p>
          </Step>

          <Step index={2} active={activeIndex === 2} done={activeIndex > 2} hint="Choose as many as you like.">
            <div className="flex flex-wrap gap-2.5">
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
                Let the florist choose
              </button>
            </div>
          </Step>

          <Step index={3} active={activeIndex === 3} done={activeIndex > 3}>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <button
                type="button"
                aria-pressed={vase === true}
                onClick={() => setVase(true)}
                className={cn(
                  chip,
                  "flex-col gap-0.5 py-3",
                  vase === true ? chipOn : chipOff,
                )}
              >
                <span>Yes, in a vase</span>
                <span className="text-xs text-ink-muted">
                  +{formatAed(BYO_VASE_PRICE_AED)}
                </span>
              </button>
              <button
                type="button"
                aria-pressed={vase === false}
                onClick={() => setVase(false)}
                className={cn(
                  chip,
                  "flex-col gap-0.5 py-3",
                  vase === false ? chipOn : chipOff,
                )}
              >
                <span>No, hand-tied</span>
                <span className="text-xs text-ink-muted">Wrapped in paper</span>
              </button>
            </div>
          </Step>

          <Step index={4} active={activeIndex === 4} done={activeIndex > 4}>
            <textarea
              value={message}
              onChange={(e) => {
                setMessage(e.target.value.slice(0, 220));
                if (e.target.value) setLeaveBlank(false);
              }}
              rows={3}
              disabled={leaveBlank}
              aria-label="Card message"
              placeholder="Write the words they'll keep…"
              className={cn(fieldClasses, "disabled:opacity-50")}
            />
            <div className="mt-2 flex items-center justify-between gap-4">
              <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink-muted">
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
              <span className="text-xs text-ink-muted">{message.length}/220</span>
            </div>
          </Step>

          <Step index={5} active={activeIndex === 5} done={activeIndex > 5} hint="Optional.">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 400))}
              rows={3}
              aria-label="Notes for the florist"
              placeholder="Allergies, flowers to avoid, a style you love — anything that helps."
              className={fieldClasses}
            />
          </Step>

          <Step index={6} active={activeIndex === 6} done={activeIndex > 6}>
            <div
              className="grid grid-cols-2 gap-3"
              role="group"
              aria-label="Who is it for?"
            >
              {[
                { value: true, label: "It's a gift", note: "Sent to someone else" },
                { value: false, label: "For myself", note: "Delivered to me" },
              ].map((choice) => (
                <button
                  key={String(choice.value)}
                  type="button"
                  aria-pressed={isGift === choice.value}
                  onClick={() => setIsGift(choice.value)}
                  className={cn(
                    "flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-sm border px-3 text-center transition-colors duration-200 ease-bloom",
                    isGift === choice.value
                      ? "border-olive bg-cream text-olive"
                      : "border-hairline text-olive hover:border-sage",
                  )}
                >
                  <span className="text-sm">{choice.label}</span>
                  <span className="text-xs text-ink-muted">{choice.note}</span>
                </button>
              ))}
            </div>

            {/* Only a gift needs a second person's details. Asking for them
                when the flowers are for the buyer is asking someone to write
                their own name twice. */}
            {isGift === true && (
              <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="byo-rec-name" className={labelClasses}>
                    Recipient name
                  </label>
                  <input
                    id="byo-rec-name"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value.slice(0, 140))}
                    className={fieldClasses}
                  />
                </div>
                <div>
                  <label htmlFor="byo-rec-phone" className={labelClasses}>
                    Recipient phone
                  </label>
                  <input
                    id="byo-rec-phone"
                    dir="ltr"
                    inputMode="tel"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value.slice(0, 40))}
                    placeholder="+9715…"
                    className={cn(fieldClasses, "text-start")}
                  />
                </div>
              </div>
            )}

            {isGift !== null && (
              <div className="mt-5">
                <label htmlFor="byo-location" className={labelClasses}>
                  {isGift ? "Where should it go?" : "Your delivery address"}
                </label>
                <input
                  id="byo-location"
                  value={deliveryLocation}
                  onChange={(e) => setDeliveryLocation(e.target.value.slice(0, 240))}
                  placeholder="Jumeirah, Dubai"
                  className={fieldClasses}
                />
                <p className="mt-2 text-xs leading-relaxed text-ink-muted">
                  An area is enough for now — a florist confirms the exact
                  address with you.
                </p>
              </div>
            )}
          </Step>

          <Step index={7} active={activeIndex === 7} done={activeIndex > 7}>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="byo-name" className={labelClasses}>
                  Your name
                </label>
                <input
                  id="byo-name"
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, 140))}
                  autoComplete="name"
                  className={fieldClasses}
                  aria-invalid={error?.code === "name" || (attempted && !name.trim())}
                />
              </div>
              <div>
                <label htmlFor="byo-phone" className={labelClasses}>
                  Phone
                </label>
                <input
                  id="byo-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.slice(0, 40))}
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+9715…"
                  className={fieldClasses}
                  aria-invalid={error?.code === "phone" || (attempted && !phone.trim())}
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="byo-email" className={labelClasses}>
                  Email
                </label>
                <input
                  id="byo-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.slice(0, 200))}
                  autoComplete="email"
                  className={fieldClasses}
                  aria-invalid={error?.code === "email" || (attempted && !email.trim())}
                />
              </div>
            </div>
            {error && (
              <p role="alert" className={fieldErrorClasses}>
                <span aria-hidden className="text-burnt-orange">
                  ·
                </span>
                {error.message}
              </p>
            )}
          </Step>
        </ol>

        <p className="mt-10 max-w-md pl-10 text-xs leading-relaxed text-ink-muted">
          {seasonalDisclaimer}
        </p>

        {/* Phone: review before the sticky send button. */}
        <div className="mt-12 lg:hidden">{summary}</div>
      </div>

      {/* Desktop: the arrangement builds beside the steps, with the send
          button where she reads the total. */}
      <aside className="hidden lg:sticky lg:top-28 lg:block lg:self-start">
        {summary}
        <Button
          variant="primary"
          className="mt-5 w-full"
          onClick={handleSubmit}
          disabled={sending}
        >
          {sending ? "Sending…" : "Send to a Florist"}
        </Button>
        <SendNote />
      </aside>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-canvas px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 lg:hidden">
        <div className="mx-auto max-w-xl">
          <Button
            variant="primary"
            className="w-full"
            onClick={handleSubmit}
            disabled={sending}
          >
            {sending ? (
              "Sending…"
            ) : (
              <>
                Send to a Florist{totalAed > 0 && <> — {formatAed(totalAed)}</>}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SendNote() {
  return (
    <p className="mt-3 text-sm leading-relaxed text-ink-muted">
      Sends your request to the atelier. Nothing is ordered and nothing is
      charged until a florist confirms it with you.
    </p>
  );
}

function Step({
  index,
  active,
  done = false,
  hint,
  error,
  stepRef,
  children,
}: {
  index: number;
  active: boolean;
  /** Answered: the segment above fills and the number becomes the mark. */
  done?: boolean;
  hint?: string;
  error?: string;
  stepRef?: (el: HTMLLIElement | null) => void;
  children: React.ReactNode;
}) {
  const step = STEPS[index];
  const headingId = `byo-${step.id}`;
  const last = index === STEPS.length - 1;
  return (
    /*
     * THE EDITORIAL RAIL.
     *
     * A single hairline runs down the consultation, and each step is a
     * marker on it. The line is drawn with `scaleY` from the top, so a
     * completed step's segment is filled and a future one's is pale — the
     * rail reads as progress made rather than as a decoration.
     *
     * The rail lives in PADDING, not in a floating column: `ps-10` on the
     * item and the marker positioned at `start-0` inside it. That is why it
     * cannot push anything sideways — there is no second track to overflow,
     * and the whole thing mirrors for Arabic because every inset is logical.
     *
     * COMPLETED shows the flower mark instead of the number. It is the one
     * moment the brand's own glyph does the talking, and it earns its place:
     * "this one is answered" is exactly what a mark means here.
     */
    <li
      ref={stepRef}
      aria-labelledby={headingId}
      data-state={done ? "done" : active ? "active" : "future"}
      className="group/step relative scroll-mt-32 ps-10 pb-2 lg:ps-14"
    >
      {/* The line. Sits under the marker and stops at the last step. */}
      {!last && (
        <span
          aria-hidden
          className="absolute bottom-0 start-[0.6875rem] top-8 w-px bg-hairline lg:start-[0.9375rem]"
        >
          <span
            className={cn(
              "block h-full w-px origin-top bg-burnt-orange/45 transition-transform duration-700 ease-bloom motion-reduce:transition-none",
              done ? "scale-y-100" : "scale-y-0",
            )}
          />
        </span>
      )}

      {/* The marker: number while pending, the mark once answered. */}
      <span
        aria-hidden
        className={cn(
          "absolute start-0 top-[0.1875rem] grid h-6 w-6 place-items-center rounded-full border bg-canvas transition-colors duration-500 ease-bloom lg:h-8 lg:w-8",
          done
            ? "border-burnt-orange/40 text-burnt-orange"
            : active
              ? "border-olive text-olive"
              : "border-hairline text-ink-muted",
        )}
      >
        {done ? (
          <Monogram className="w-3 lg:w-3.5" />
        ) : (
          <span className="font-sans text-[0.6875rem] lg:text-xs">{index + 1}</span>
        )}
      </span>

      <h2
        id={headingId}
        className={cn(
          "font-display text-2xl font-light transition-colors duration-300 ease-bloom lg:text-[1.75rem]",
          active || done ? "text-olive" : "text-olive/55",
        )}
      >
        {step.title}
      </h2>
      {hint && <p className="mt-1 text-sm text-ink-muted">{hint}</p>}
      <div className="mt-4">{children}</div>
      {error && (
        <p role="alert" className={fieldErrorClasses}>
          <span aria-hidden className="mt-2 h-px w-3 shrink-0 bg-burnt-orange" />
          {error}
        </p>
      )}
    </li>
  );
}

function Summary({
  occasion,
  budgetAed,
  colours,
  vase,
  message,
  leaveBlank,
  notes,
  totalAed,
}: {
  occasion: string | null;
  budgetAed: number;
  colours: readonly string[];
  vase: boolean | null;
  message: string;
  leaveBlank: boolean;
  notes: string;
  totalAed: number;
}) {
  const rows: { label: string; value: string | null; optional?: boolean }[] = [
    { label: "Occasion", value: occasion },
    { label: "Budget", value: budgetAed > 0 ? formatAed(budgetAed) : null },
    { label: "Colours", value: colours.length > 0 ? colours.join(", ") : null },
    {
      label: "Vase",
      value:
        vase === null
          ? null
          : vase
            ? `In a vase, +${formatAed(BYO_VASE_PRICE_AED)}`
            : "Hand-tied",
    },
    {
      label: "Card",
      value: leaveBlank ? "Left blank" : message.trim() ? `“${message.trim()}”` : null,
    },
    { label: "Notes", value: notes.trim() || null, optional: true },
  ];

  return (
    <section
      aria-labelledby="byo-summary"
      className="rounded-sm border border-hairline bg-cream/70 p-6"
    >
      <h2 id="byo-summary" className="font-display text-2xl font-light text-olive">
        Your arrangement
      </h2>
      <dl className="mt-5 flex flex-col divide-y divide-hairline/70">
        {rows.map((row) => (
          <div key={row.label} className="flex gap-4 py-3">
            <dt className="w-20 shrink-0 font-brand text-[0.625rem] font-medium uppercase leading-6 tracking-brand text-ink-muted">
              {row.label}
            </dt>
            <dd
              className={cn(
                "min-w-0 flex-1 break-words text-base leading-6",
                row.value ? "text-olive" : "text-ink-muted/80",
              )}
            >
              {row.value ?? (row.optional ? "None" : "Not chosen yet")}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-2 flex items-baseline justify-between border-t border-hairline pt-4">
        <p className="font-brand text-xs font-medium uppercase tracking-brand text-olive">
          Estimated total
        </p>
        <p className="font-display text-3xl text-olive" aria-live="polite">
          {totalAed > 0 ? formatAed(totalAed) : "—"}
        </p>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-ink-muted lg:hidden">
        Sends your request to the atelier. Nothing is ordered and nothing is
        charged until a florist confirms it with you.
      </p>
    </section>
  );
}
