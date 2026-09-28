"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Monogram } from "@/components/ui/Monogram";
import {
  chipClasses,
  chipOffClasses,
  chipOnClasses,
  fieldClasses,
  fieldErrorClasses,
  labelClasses,
} from "@/components/ui/form-classes";
import { CONTACT } from "@/lib/data";
import { cn } from "@/lib/cn";
import {
  submitMembershipEnquiry,
  type MembershipEnquiryRequest,
} from "@backend/actions/membership-enquiry";
import { useT } from "@/lib/locale";

type Props = {
  /** The tier the visitor pressed "Begin" on — recorded as-is. */
  planName: string;
  /** The same tier in the reader's language, for display only. */
  planLabel: string;
  onClose: () => void;
};

/* Ids only: the words are in the dictionary, keyed by id. */
const FREQUENCIES = ["WEEKLY", "FORTNIGHTLY", "MONTHLY"] as const;

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const PLACES = ["home", "office", "gift"] as const;

/**
 * Membership interest, captured properly.
 *
 * The page's "Begin" button used to open WhatsApp with a single sentence, and
 * the delivery day the visitor had just picked was thrown away with everything
 * else. This asks the few things a florist needs in order to call back
 * prepared, and writes them into Enquiries where the atelier already works.
 *
 * It is DELIBERATELY SHORT. A membership is a conversation, not a checkout —
 * six fields is enough to make the call useful, and every extra one costs
 * completions. Nothing here takes payment or starts anything.
 *
 * WhatsApp stays available underneath, because some people would simply rather
 * talk. It is now the second option rather than the only one.
 */
export function MembershipEnquiryForm({ planName, planLabel, onClose }: Props) {
  const t = useT();
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [frequency, setFrequency] =
    useState<MembershipEnquiryRequest["frequency"]>("WEEKLY");
  const [place, setPlace] =
    useState<MembershipEnquiryRequest["deliveryPreference"]>("home");
  /* The day is asked HERE rather than read from the picker further up the
     page: that picker is marketing illustration with its own local state, and
     lifting it across two server-rendered sections to reach this form would
     be more machinery than the choice is worth. Asked in the form, it is
     actually recorded — which is the whole point. */
  const [day, setDay] = useState<string>("Thu");
  const panelRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await submitMembershipEnquiry({
      contactName: String(formData.get("name") ?? ""),
      contactEmail: String(formData.get("email") ?? ""),
      contactPhone: String(formData.get("phone") ?? ""),
      planName,
      frequency,
      deliveryPreference: place,
      deliveryDay: day,
      preferredStartDate: String(formData.get("startDate") ?? "") || undefined,
      deliveryLocation: String(formData.get("location") ?? "") || undefined,
      notes: String(formData.get("notes") ?? "") || undefined,
    });
    setPending(false);
    if (result.ok) setDone(result.reference);
    else setError({ code: result.code, message: result.message });
  }

  if (done) {
    return (
      <div ref={panelRef} className="py-4 text-center">
        <Monogram className="mx-auto w-12 text-hairline" />
        <p className="mt-5 font-display text-2xl font-light italic text-olive">
          {t.enquiryForm.membershipThanks}
        </p>
        <p className="mx-auto mt-3 max-w-sm text-base text-ink-muted">
          {t.enquiryForm.membershipDone.replace("{plan}", planLabel)}
        </p>
        <p className="mt-4 font-brand text-[0.625rem] uppercase tracking-brand text-ink-muted">
          {t.enquiryForm.reference.replace("{number}", done)}
        </p>
        <Button variant="secondary" onClick={onClose} className="mt-7">
          {t.ui.close}
        </Button>
      </div>
    );
  }

  return (
    <div ref={panelRef}>
      <p className="font-brand text-[0.625rem] font-medium uppercase tracking-brand text-ink-muted">
        {t.tiers.label.replace("{name}", planLabel)}
      </p>
      <h3 className="mt-2 font-display text-2xl font-light text-olive lg:text-3xl">
        {t.enquiryForm.membershipTitle}
      </h3>
      <p className="mt-3 max-w-md text-base leading-relaxed text-ink-muted">
        {t.enquiryForm.membershipIntro}
      </p>

      <form action={onSubmit} className="mt-7 flex flex-col gap-6">
        <fieldset>
          <legend className={labelClasses}>{t.enquiryForm.howOften}</legend>
          <div className="grid grid-cols-3 gap-2">
            {FREQUENCIES.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={frequency === f}
                onClick={() => setFrequency(f)}
                className={cn(
                  chipClasses,
                  frequency === f ? chipOnClasses : chipOffClasses,
                )}
              >
                {t.enquiryForm.frequency[f] ?? f}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className={labelClasses}>{t.enquiryForm.whichDay}</legend>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {DAYS.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={day === d}
                onClick={() => setDay(d)}
                className={cn(chipClasses, day === d ? chipOnClasses : chipOffClasses)}
              >
                {t.enquiryForm.weekdays[d] ?? d}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className={labelClasses}>{t.enquiryForm.whereItGoes}</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {PLACES.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={place === p}
                onClick={() => setPlace(p)}
                className={cn(chipClasses, place === p ? chipOnClasses : chipOffClasses)}
              >
                {t.enquiryForm.place[p] ?? p}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="m-name" className={labelClasses}>
              {t.enquiryForm.yourName}
            </label>
            <input
              ref={firstFieldRef}
              id="m-name"
              name="name"
              required
              autoComplete="name"
              className={fieldClasses}
              aria-invalid={error?.code === "name"}
            />
          </div>
          <div>
            <label htmlFor="m-phone" className={labelClasses}>
              {t.enquiryForm.phone}
            </label>
            <input
              id="m-phone"
              name="phone"
              required
              inputMode="tel"
              autoComplete="tel"
              placeholder="+9715…"
              className={fieldClasses}
              aria-invalid={error?.code === "phone"}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="m-email" className={labelClasses}>
              {t.enquiryForm.email}
            </label>
            <input
              id="m-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className={fieldClasses}
              aria-invalid={error?.code === "email"}
            />
          </div>
          <div>
            <label htmlFor="m-start" className={labelClasses}>
              {t.enquiryForm.startFrom}
            </label>
            <input
              id="m-start"
              name="startDate"
              type="date"
              className={fieldClasses}
              aria-invalid={error?.code === "startDate"}
            />
          </div>
        </div>

        <div>
          <label htmlFor="m-location" className={labelClasses}>
            {t.enquiryForm.areaOrAddress}
          </label>
          <input
            id="m-location"
            name="location"
            autoComplete="address-level2"
            placeholder={t.enquiryForm.areaPlaceholder}
            className={fieldClasses}
          />
        </div>

        <div>
          <label htmlFor="m-notes" className={labelClasses}>
            {t.enquiryForm.anythingToKnow}
          </label>
          <textarea
            id="m-notes"
            name="notes"
            rows={3}
            placeholder={t.enquiryForm.anythingPlaceholder}
            className={fieldClasses}
          />
        </div>

        {error && (
          <p role="alert" className={fieldErrorClasses}>
            <span aria-hidden className="text-burnt-orange">
              ·
            </span>
            {error.message}
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button type="submit" disabled={pending} className="sm:flex-none">
            {pending ? t.enquiryForm.sending : t.enquiryForm.send}
          </Button>
          <a
            href={CONTACT.whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center font-brand text-xs font-medium uppercase tracking-brand text-olive underline decoration-hairline underline-offset-8 transition-colors duration-200 ease-bloom hover:decoration-burnt-orange"
          >
            {t.enquiryForm.preferToTalk}
          </a>
        </div>
      </form>
    </div>
  );
}
