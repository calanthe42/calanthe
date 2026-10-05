"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { DateField } from "@/components/ui/DateField";
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
import { useT } from "@/lib/locale";

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
 * "Message us" (WhatsApp) remains beside the button for anyone who would
 * rather talk.
 */
export function EventEnquiryForm() {
  const t = useT();
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
      eventDate: String(formData.get("date") ?? ""),
      guests: String(formData.get("guests") ?? ""),
      venue: String(formData.get("venue") ?? ""),
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
          {t.enquiryForm.eventThanks}
        </p>
        <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-cream/80">
          {t.enquiryForm.eventDone}
        </p>
        <p className="mt-5 font-brand text-[0.625rem] uppercase tracking-brand text-cream/60">
          {t.enquiryForm.reference.replace("{number}", done)}
        </p>
      </div>
    );
  }

  return (
    <form action={onSubmit} className="mx-auto flex max-w-xl flex-col gap-6">
      <fieldset>
        <legend className={cn(labelClasses, "text-cream/70")}>
          {t.enquiryForm.whatKind}
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
              {t.enquiryForm.eventKinds[k] ?? k}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field
          id="ev-name"
          name="name"
          label={t.enquiryForm.yourName}
          required
          autoComplete="name"
          invalid={error?.code === "name"}
        />
        <Field
          id="ev-phone"
          name="phone"
          label={t.enquiryForm.phone}
          required
          inputMode="tel"
          autoComplete="tel"
          placeholder="+9715…"
          invalid={error?.code === "phone"}
        />
        <Field
          id="ev-email"
          name="email"
          label={t.enquiryForm.email}
          type="email"
          required
          autoComplete="email"
          invalid={error?.code === "email"}
        />
        <Field
          id="ev-company"
          name="company"
          label={t.enquiryForm.company}
          autoComplete="organization"
        />
        <Field
          id="ev-date"
          name="date"
          label={t.enquiryForm.date}
          type="date"
          required
          invalid={error?.code === "eventDate"}
        />
        <Field
          id="ev-guests"
          name="guests"
          label={t.enquiryForm.guests}
          required
          inputMode="numeric"
          placeholder="120"
          invalid={error?.code === "guests"}
        />
      </div>

      <Field
        id="ev-venue"
        name="venue"
        label={t.enquiryForm.venue}
        required
        placeholder={t.enquiryForm.venuePlaceholder}
        invalid={error?.code === "venue"}
      />

      <div>
        <label htmlFor="ev-notes" className={cn(labelClasses, "text-cream/70")}>
          {t.enquiryForm.alreadyKnow}
        </label>
        <textarea
          id="ev-notes"
          name="notes"
          rows={3}
          placeholder={t.enquiryForm.alreadyKnowPlaceholder}
          className={cn(
            fieldClasses,
            "border-cream/25 bg-cream/[0.06] text-cream placeholder:text-cream/40 focus:border-cream focus:shadow-none",
          )}
        />
      </div>

      {error && (
        <p role="alert" className={cn(fieldErrorClasses, "text-cream")}>
          <span aria-hidden className="text-burnt-orange">
            ·
          </span>
          {error.message}
        </p>
      )}

      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <Button type="submit" disabled={pending} className="sm:flex-none">
          {pending ? t.enquiryForm.sending : t.enquiryForm.send}
        </Button>
        <a
          href={CONTACT.whatsappHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center font-brand text-xs font-medium uppercase tracking-brand text-cream underline decoration-cream/30 underline-offset-8 transition-colors duration-200 ease-bloom hover:decoration-burnt-orange"
        >
          {t.enquiryForm.messageUs}
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
}: React.ComponentPropsWithoutRef<"input"> & {
  id: string;
  label: string;
  invalid?: boolean;
}) {
  const t = useT();
  if (rest.type === "date") {
    return (
      <div>
        <label htmlFor={id} className={cn(labelClasses, "text-cream/70")}>
          {label}
        </label>
        {/* The browser writes "mm/dd/yyyy" in ITS language; this field reads in the page's. */}
        <DateField
          id={id}
          tone="dark"
          invalid={invalid}
          onInvalid={(e) => {
            if (e.currentTarget.validity.valueMissing)
              e.currentTarget.setCustomValidity(t.ui.requiredField);
          }}
          onInput={(e) => e.currentTarget.setCustomValidity("")}
          name={rest.name}
          required={rest.required}
        />
      </div>
    );
  }
  return (
    <div>
      <label htmlFor={id} className={cn(labelClasses, "text-cream/70")}>
        {label}
      </label>
      <input
        id={id}
        aria-invalid={invalid}
        /* The browser's own "Please fill out this field" bubble is in the
           browser's language, not the page's; say it in the page's. */
        onInvalid={(e) => {
          if (e.currentTarget.validity.valueMissing)
            e.currentTarget.setCustomValidity(t.ui.requiredField);
        }}
        onInput={(e) => e.currentTarget.setCustomValidity("")}
        className={cn(
          fieldClasses,
          "border-cream/25 bg-cream/[0.06] text-cream placeholder:text-cream/40 focus:border-cream focus:shadow-none",
        )}
        {...rest}
      />
    </div>
  );
}
