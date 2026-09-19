"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Monogram } from "@/components/ui/Monogram";
import {
  chipClasses,
  fieldClasses,
  fieldErrorClasses,
  labelClasses,
} from "@/components/ui/form-classes";
import { CONTACT } from "@/lib/data";
import { cn } from "@/lib/cn";
import { submitEventEnquiry } from "@backend/actions/enquiry";

const KINDS = [
  "Wedding",
  "Private celebration",
  "Corporate",
  "Launch or opening",
  "Something else",
] as const;

/**
 * Events, captured.
 *
 * The Events page had no form at all — two buttons that opened WhatsApp, and
 * nothing recorded anywhere. Events are the atelier's largest and most
 * date-sensitive orders, so an enquiry that leaves no trace is the most
 * expensive thing on the site to lose.
 *
 * This writes a real Enquiry (type EVENT, priority HIGH — an event should not
 * queue behind a single bouquet). It stays deliberately short: an event is a
 * conversation, and six fields are enough for a florist to call back prepared.
 * WhatsApp remains underneath for anyone who would rather talk.
 */
export function EventEnquiryForm() {
  const [kind, setKind] = useState<string>("Wedding");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await submitEventEnquiry({
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      company: String(formData.get("company") ?? "") || undefined,
      eventType: kind,
      eventDate: String(formData.get("date") ?? "") || undefined,
      guests: String(formData.get("guests") ?? "") || undefined,
      venue: String(formData.get("venue") ?? "") || undefined,
      notes: String(formData.get("notes") ?? "") || undefined,
    });
    setPending(false);
    if (result.ok) setDone(result.reference);
    else setError({ code: result.code, message: result.message });
  }

  if (done) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <Monogram className="mx-auto w-12 text-cream/40" />
        <p className="mt-6 font-display text-3xl font-light italic text-cream">
          Thank you — we have your event.
        </p>
        <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-cream/80">
          A florist will be in touch to talk through the venue, the palette and
          the scale. Nothing is committed and nothing has been charged.
        </p>
        <p className="mt-5 font-brand text-[0.625rem] uppercase tracking-brand text-cream/60">
          Reference {done}
        </p>
      </div>
    );
  }

  return (
    <form action={onSubmit} className="mx-auto flex max-w-xl flex-col gap-6">
      <fieldset>
        <legend className={cn(labelClasses, "text-cream/70")}>
          What kind of occasion
        </legend>
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              className={cn(
                chipClasses,
                kind === k
                  ? "border-cream bg-cream text-olive"
                  : "border-cream/30 text-cream hover:border-cream/60",
              )}
            >
              {k}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field id="ev-name" name="name" label="Your name" required autoComplete="name" invalid={error?.code === "name"} />
        <Field id="ev-phone" name="phone" label="Phone" required inputMode="tel" autoComplete="tel" placeholder="+9715…" invalid={error?.code === "phone"} />
        <Field id="ev-email" name="email" label="Email" type="email" required autoComplete="email" invalid={error?.code === "email"} />
        <Field id="ev-company" name="company" label="Company (optional)" autoComplete="organization" />
        <Field id="ev-date" name="date" label="Date (optional)" type="date" invalid={error?.code === "eventDate"} />
        <Field id="ev-guests" name="guests" label="Guests (optional)" inputMode="numeric" placeholder="120" />
      </div>

      <Field id="ev-venue" name="venue" label="Venue or area (optional)" placeholder="Four Seasons, Jumeirah" />

      <div>
        <label htmlFor="ev-notes" className={cn(labelClasses, "text-cream/70")}>
          Anything you already know (optional)
        </label>
        <textarea
          id="ev-notes"
          name="notes"
          rows={3}
          placeholder="Palette, style, the feeling of the day…"
          className={cn(fieldClasses, "border-cream/25 bg-cream/[0.06] text-cream placeholder:text-cream/40 focus:border-cream focus:shadow-none")}
        />
      </div>

      {error && (
        <p role="alert" className={cn(fieldErrorClasses, "text-cream")}>
          <span aria-hidden className="text-burnt-orange">·</span>
          {error.message}
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" disabled={pending} className="sm:flex-none">
          {pending ? "Sending…" : "Send enquiry"}
        </Button>
        <a
          href={CONTACT.whatsappHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center font-brand text-xs font-medium uppercase tracking-brand text-cream underline decoration-cream/30 underline-offset-8 transition-colors duration-200 ease-bloom hover:decoration-burnt-orange"
        >
          Prefer to talk? Message a florist
        </a>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  invalid,
  ...rest
}: React.ComponentPropsWithoutRef<"input"> & { id: string; label: string; invalid?: boolean }) {
  return (
    <div>
      <label htmlFor={id} className={cn(labelClasses, "text-cream/70")}>
        {label}
      </label>
      <input
        id={id}
        aria-invalid={invalid}
        className={cn(
          fieldClasses,
          "border-cream/25 bg-cream/[0.06] text-cream placeholder:text-cream/40 focus:border-cream focus:shadow-none",
        )}
        {...rest}
      />
    </div>
  );
}
