"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { EASE_BLOOM } from "@/components/motion/constants";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Monogram } from "@/components/ui/Monogram";
import {
  fieldClasses,
  fieldErrorClasses,
  labelClasses,
  optionClasses,
  optionLabelOff,
  optionLabelOn,
  optionOff,
  optionOn,
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
  byoColourSwatches,
  formatAed,
  seasonalDisclaimer,
} from "@/lib/data";

/**
 * Build Your Own, as a consultation rather than a form.
 *
 * The budget comes first because it is the answer that shapes every other —
 * the size of the arrangement, how many stems, which flowers are possible.
 * Each choice lands in "Your arrangement" as it is made — beside the steps on
 * desktop, as a review step on a phone — so the request she sends is one she
 * has already read.
 *
 * THE OCCASION IS NOT ASKED. It was the first question and it was the wrong
 * one: a bouquet for a birthday and a bouquet for an apology are composed
 * from the same brief — a budget, a palette, a few words. The card message
 * and the notes tell the florist what the flowers are for. One question
 * fewer is one more request finished.

 * SENDING RECORDS IT. This used to serialise the brief into a WhatsApp URL
 * and open a tab — if the visitor never pressed send, the atelier never knew
 * the enquiry existed. It now writes a real Enquiry (type BUILD_YOUR_OWN)
 * that appears in /admin, and offers WhatsApp alongside for anyone who would
 * rather talk it through.
 */

const STEPS = [
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

  const [budget, setBudget] = useState<number | "other" | null>(null);
  const [customBudget, setCustomBudget] = useState("");
  const [colours, setColours] = useState<readonly string[]>([]);
  /* Her own words about colour — the florist reads these before the swatches. */
  const [colourNote, setColourNote] = useState("");
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
    colourNote,
    cardMessage: message,
    leaveCardBlank: leaveBlank,
    notes,
  };
  const totalAed = bespokeTotalAed(request);
  const whatsappHref = bespokeWhatsAppHref(request);

  /* The monogram on the rail sits at the first step still waiting on you. */
  const activeIndex = useMemo(() => {
    if (budgetValue === 0) return 0;
    if (colours.length === 0 && !colourOther && !colourNote.trim()) return 1;
    if (vase === null) return 2;
    if (!message.trim() && !leaveBlank) return 3;
    /* The rail's marker rests on "For the florist" until there is something
       to reach the customer by — contact is the last thing still waiting. */
    if (!notes.trim()) return 4;
    if (isGift === null) return 5;
    return 6;
  }, [budgetValue, colours, colourOther, colourNote, vase, message, leaveBlank, notes, isGift]);

  const errors: Partial<Record<StepId, string>> = attempted
    ? {
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
    const missing: StepId | null = budgetValue === 0
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
      colourNote,
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
      colourNote={colourNote}
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
        {/*
          THE MARK IS THE FLORIST'S ATTENTION.

          There used to be two rails: the steps' own, and a second track
          beside it with a 15px monogram sliding down by percentage. Two
          parallel lines and a glyph too small to read as the brand: the
          client's words were "not understandable". Now there is one rail,
          and the monogram lives INSIDE the marker of the question being
          answered, large enough to be the mark. Answer it, and it travels
          down the rail to the next question (a shared-layout move, so the
          same element genuinely leaves one marker and arrives in the next),
          leaving a small seal behind and filling the segment it crossed.
          Under each answered heading the answer is written in one line, so
          scrolling back up reads as a receipt.
        */}
        <ol className="flex flex-col gap-14 lg:gap-16">
          <Step
            index={0}
            active={activeIndex === 0}
            done={activeIndex > 0}
            answer={budgetValue > 0 ? formatAed(budgetValue) : undefined}
            error={errors.budget}
            stepRef={(el) => {
              stepRefs.current.budget = el;
            }}
          >
            {/* Figures read down a column, not across a row of boxes — the
                eye compares amounts far more easily in a list. */}
            <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
              {byoBudgetsAed.map((b) => (
                <Option
                  key={b}
                  label={formatAed(b)}
                  selected={budget === b}
                  onSelect={() => setBudget(b)}
                />
              ))}
              <Option
                label="Another amount"
                selected={budget === "other"}
                onSelect={() => setBudget("other")}
              />
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
            <p className="mt-3 max-w-md text-base italic leading-relaxed text-ink-muted lg:text-sm">
              {byoBudgetNote}
            </p>
          </Step>

          <Step
            index={1}
            active={activeIndex === 1}
            done={activeIndex > 1}
            answer={
              [
                ...colours,
                ...(colourOther ? ["Florist's choice"] : []),
                ...(colourNote.trim() ? [colourNote.trim()] : []),
              ].join(", ") || undefined
            }
            hint="Choose as many as you like."
          >
            {/* THE PALETTE LEADS, THE WORDS FOLLOW. "Peach & Apricot" in a
                grey box asks someone to read a name and imagine the stems.
                The three stops beside each name are what a florist would
                actually put on the table. */}
            <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
              {byoColours.map((c) => {
                const on = colours.includes(c);
                return (
                  <Option
                    key={c}
                    label={c}
                    swatch={byoColourSwatches[c]}
                    selected={on}
                    onSelect={() =>
                      setColours((prev) =>
                        on ? prev.filter((x) => x !== c) : [...prev, c],
                      )
                    }
                  />
                );
              })}
              <Option
                label="Let the florist choose"
                note="A palette picked on the morning"
                selected={colourOther}
                onSelect={() => setColourOther((v) => !v)}
              />
            </div>

            {/*
              THE LAST WORD ON COLOUR IS HERS.

              Six swatches cannot hold "the dusty blue from my wedding" or
              "nothing yellow, please". This is where that goes, and it is
              last on purpose: the swatches are the quick answer, this is the
              one the florist reads twice. The line underneath is a promise,
              not a disclaimer — flowers are grown, not stocked, and the
              honest thing is to say who calls whom when a colour cannot be
              had that morning.
            */}
            <div className="mt-6">
              <label htmlFor="byo-colour-note" className={labelClasses}>
                Anything else about the colours?
              </label>
              <textarea
                id="byo-colour-note"
                value={colourNote}
                onChange={(e) => setColourNote(e.target.value.slice(0, 240))}
                rows={2}
                placeholder="A shade you love, a colour to avoid, something to match…"
                className={cn(fieldClasses, "mt-2")}
              />
              <p className="mt-2 flex items-start gap-2 text-base leading-relaxed text-ink-muted lg:text-sm">
                <span aria-hidden className="mt-2.5 h-px w-4 shrink-0 bg-burnt-orange" />
                <span>
                  If a colour is not in season on the day, we will contact you
                  before composing and agree the closest thing to it.
                </span>
              </p>
            </div>
          </Step>

          <Step index={2} active={activeIndex === 2} done={activeIndex > 2} answer={vase === null ? undefined : vase ? "With a vase" : "Hand-tied, no vase"}>
            <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
              <Option
                label="Yes, in a vase"
                note={`+${formatAed(BYO_VASE_PRICE_AED)}`}
                selected={vase === true}
                onSelect={() => setVase(true)}
              />
              <Option
                label="No, hand-tied"
                note="Wrapped in paper"
                selected={vase === false}
                onSelect={() => setVase(false)}
              />
            </div>
          </Step>

          <Step index={3} active={activeIndex === 3} done={activeIndex > 3} answer={leaveBlank ? "Left blank" : message.trim() ? "Written" : undefined}>
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

          <Step index={4} active={activeIndex === 4} done={activeIndex > 4} answer={notes.trim() ? "Noted" : undefined} hint="Optional.">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 400))}
              rows={3}
              aria-label="Notes for the florist"
              placeholder="Allergies, flowers to avoid, a style you love — anything that helps."
              className={fieldClasses}
            />
          </Step>

          <Step index={5} active={activeIndex === 5} done={activeIndex > 5} answer={isGift === null ? undefined : isGift ? "A gift" : "For yourself"}>
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
                  placeholder="Al Reem Island, Abu Dhabi"
                  className={fieldClasses}
                />
                <p className="mt-2 text-base leading-relaxed text-ink-muted lg:text-sm">
                  An area is enough for now — Delivery confirms the exact
                  address with you.
                </p>
              </div>
            )}
          </Step>

          <Step index={6} active={activeIndex === 6} done={activeIndex > 6}>
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

        <p className="mt-10 max-w-md ps-14 text-base leading-relaxed text-ink-muted lg:ps-[4.25rem] lg:text-sm">
          {seasonalDisclaimer}
        </p>

        {/* Phone: review before the sticky send button. */}
        <div className="mt-12 lg:hidden">{summary}</div>
      </div>

      {/* Desktop: the arrangement builds beside the steps, with the send
          button where she reads the total. */}
      <aside className="hidden lg:sticky lg:top-28 lg:block lg:self-start">
        {summary}
        {/* Sized to its words, not to the column — the summary above is the
            subject here, and the action belongs to it rather than over it. */}
        <Button
          variant="primary"
          size="compact"
          className="mt-6"
          onClick={handleSubmit}
          loading={sending}
          loadingText="Sending…"
        >
          Send to a Florist
        </Button>
        <SendNote />
      </aside>

      {/*
        THE BAR REPORTS, THE BUTTON ACTS.

        This was a full-bleed burnt-orange slab pinned across the bottom of
        the screen — the loudest object on a page whose subject is a bouquet,
        and the first thing the eye landed on instead of the choices being
        made. It is now a quiet cream bar carrying the RUNNING TOTAL on the
        reading edge, with the action sized to its own words beside it. The
        total is the useful thing to keep on screen while choosing; the
        button only needs to be findable, not dominant.
      */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-canvas/95 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur-sm lg:hidden">
        {/* Progress, as the rail's own line laid along the bar's top edge:
            it fills as questions are answered, so the thumb zone always
            says how far along this is without a word. */}
        <span
          aria-hidden
          className="absolute inset-x-0 top-[-1px] h-px origin-left bg-burnt-orange transition-transform duration-700 ease-bloom rtl:origin-right motion-reduce:transition-none"
          style={{ transform: `scaleX(${activeIndex / STEPS.length})` }}
        />
        <div className="mx-auto flex max-w-xl items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-brand text-[0.5625rem] uppercase tracking-brand text-ink-muted">
              Estimated total
            </p>
            <p className="font-display text-xl font-light leading-none text-olive">
              {totalAed > 0 ? formatAed(totalAed) : "—"}
            </p>
            <p className="sr-only" aria-live="polite">
              {activeIndex} of {STEPS.length} questions answered
            </p>
          </div>
          <Button
            variant="primary"
            size="compact"
            className="shrink-0"
            onClick={handleSubmit}
            loading={sending}
            loadingText="Sending…"
          >
            Send to a Florist
          </Button>
        </div>
      </div>
    </div>
  );
}

function SendNote() {
  return (
    <p className="mt-3 text-base leading-relaxed text-ink-muted lg:text-sm">
      Sends your request to the atelier. Nothing is ordered and nothing is
      charged until a florist confirms it with you.
    </p>
  );
}


/**
 * One way of choosing, used by every step.
 *
 * Every option on this page used to be the same bordered rectangle — eight
 * ways of describing an arrangement arriving as identical grey buttons. This
 * is the storefront's own grammar instead: a label on a hairline, and
 * choosing draws that hairline in burnt orange from the reading edge. The
 * same movement the shop's category row and the occasion band already use.
 *
 * `swatch` is optional and only the colour step passes it — there the
 * palette itself is the point, so it leads and the words follow.
 */
function Option({
  label,
  note,
  selected,
  onSelect,
  swatch,
}: {
  label: string;
  note?: string;
  selected: boolean;
  onSelect: () => void;
  swatch?: readonly [string, string, string];
}) {
  const reduced = useReducedMotion();
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(optionClasses, selected ? optionOn : optionOff)}
    >
      <span className="flex min-w-0 items-center gap-3">
        {swatch && (
          <span
            aria-hidden
            className={cn(
              "flex shrink-0 overflow-hidden rounded-[2px] ring-1 transition-colors duration-200",
              selected ? "ring-cream/40" : "ring-hairline",
            )}
          >
            {swatch.map((c) => (
              <span key={c} style={{ background: c }} className="h-7 w-3" />
            ))}
          </span>
        )}
        <span className="min-w-0">
          <span className={cn("block truncate", selected ? optionLabelOn : optionLabelOff)}>
            {label}
          </span>
          {note && (
            <span
              className={cn(
                "mt-0.5 block text-sm transition-colors duration-200",
                selected ? "text-cream/70" : "text-ink-muted",
              )}
            >
              {note}
            </span>
          )}
        </span>
      </span>

      {/*
        THE SEAL, NOT A TICK.

        Chosen used to be the word "Chosen" in small caps. The brand already
        owns a gesture for "this is settled" — its monogram, pressed into
        paper — so that is what confirms a choice here: the mark blooms open
        on the end of the chip. It is never colour alone; the fill, the
        label's colour and this mark all change together.
      */}
      <AnimatePresence initial={false}>
        {selected && (
          <motion.span
            aria-hidden
            initial={reduced ? false : { scale: 0.4, opacity: 0, rotate: -25 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={reduced ? { opacity: 0 } : { scale: 0.4, opacity: 0 }}
            transition={{ duration: 0.45, ease: EASE_BLOOM }}
            className="shrink-0 text-cream"
          >
            <Monogram className="w-5" />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

function Step({
  index,
  active,
  done = false,
  answer,
  hint,
  error,
  stepRef,
  children,
}: {
  index: number;
  active: boolean;
  /** Answered: the segment above fills and the number becomes the mark. */
  done?: boolean;
  /** The answer, in a few words, written under the heading once given. */
  answer?: string;
  hint?: string;
  error?: string;
  stepRef?: (el: HTMLLIElement | null) => void;
  children: React.ReactNode;
}) {
  const step = STEPS[index];
  const headingId = `byo-${step.id}`;
  const last = index === STEPS.length - 1;
  const reduced = useReducedMotion();
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
      className="group/step relative scroll-mt-32 ps-14 pb-2 lg:ps-[4.25rem]"
    >
      {/* The line. Sits under the marker and stops at the last step. */}
      {!last && (
        <span
          aria-hidden
          className="absolute bottom-0 start-[1.25rem] top-12 w-px bg-hairline lg:start-[1.5rem] lg:top-14"
        >
          <span
            className={cn(
              "block h-full w-px origin-top bg-burnt-orange/45 transition-transform duration-700 ease-bloom motion-reduce:transition-none",
              done ? "scale-y-100" : "scale-y-0",
            )}
          />
        </span>
      )}

      {/* The marker: the mark while this is the question, a seal once
          answered, a number while it waits its turn. */}
      <span
        aria-hidden
        className={cn(
          "absolute start-0 top-0 grid h-10 w-10 place-items-center rounded-full border bg-canvas transition-colors duration-500 ease-bloom lg:h-12 lg:w-12",
          done
            ? "border-burnt-orange/50 text-burnt-orange"
            : active
              ? "border-olive text-olive"
              : "border-hairline text-ink-muted",
        )}
      >
        {active ? (
          /* One element, moving: `layoutId` carries this mark from the
             marker it leaves to the one it arrives in. */
          <motion.span
            /* Keys keep these three as three ELEMENTS. Without them React
               reuses the one <span> across states, and the shared-layout
               engine then mistakes the seal for the departing mark and
               projects it away, invisible. */
            key="mark"
            layoutId="byo-mark"
            transition={reduced ? { duration: 0 } : { layout: { duration: 0.7, ease: EASE_BLOOM } }}
            className="grid h-full w-full place-items-center"
          >
            <Monogram className="w-7 lg:w-8" />
          </motion.span>
        ) : done ? (
          <motion.span
            key="seal"
            initial={reduced ? false : { scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, ease: EASE_BLOOM, delay: reduced ? 0 : 0.25 }}
            className="grid place-items-center"
          >
            <Monogram className="w-4 lg:w-[1.125rem]" />
          </motion.span>
        ) : (
          <span key="number" className="font-sans text-sm lg:text-base">
            {index + 1}
          </span>
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
      {done && answer ? (
        <p className="mt-1 text-sm text-burnt-orange">{answer}</p>
      ) : (
        hint && <p className="mt-1 text-sm text-ink-muted">{hint}</p>
      )}
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
  colourNote,
  budgetAed,
  colours,
  vase,
  message,
  leaveBlank,
  notes,
  totalAed,
}: {
  colourNote: string;
  budgetAed: number;
  colours: readonly string[];
  vase: boolean | null;
  message: string;
  leaveBlank: boolean;
  notes: string;
  totalAed: number;
}) {
  const rows: { label: string; value: string | null; optional?: boolean }[] = [
    { label: "Budget", value: budgetAed > 0 ? formatAed(budgetAed) : null },
    { label: "Colours", value: colours.length > 0 ? colours.join(", ") : null },
    /* Straight after the swatches, because it qualifies them. */
    { label: "Colour note", value: colourNote.trim() || null, optional: true },
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
      <p className="mt-3 text-base leading-relaxed text-ink-muted lg:hidden">
        Sends your request to the atelier. Nothing is ordered and nothing is
        charged until a florist confirms it with you.
      </p>
    </section>
  );
}
