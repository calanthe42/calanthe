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

type Props = {
  /** The tier the visitor pressed "Begin" on. */
  planName: string;
  onClose: () => void;
};

const FREQUENCIES = [
  { id: "WEEKLY", label: "Weekly" },
  { id: "FORTNIGHTLY", label: "Fortnightly" },
  { id: "MONTHLY", label: "Monthly" },
] as const;

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const PLACES = [
  { id: "home", label: "Home" },
  { id: "office", label: "Office" },
  { id: "gift", label: "A gift for someone" },
] as const;

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
export function MembershipEnquiryForm({ planName, onClose }: Props) {
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
          Thank you — a florist will be in touch.
        </p>
        <p className="mx-auto mt-3 max-w-sm text-base text-ink-muted">
          We have your {planName} enquiry. Nothing has been charged and no
          membership has started — we will agree the details with you first.
        </p>
        <p className="mt-4 font-brand text-[0.625rem] uppercase tracking-brand text-ink-muted">
          Reference {done}
        </p>
        <Button variant="secondary" onClick={onClose} className="mt-7">
          Close
        </Button>
      </div>
    );
  }

  return (
    <div ref={panelRef}>
      <p className="font-brand text-[0.625rem] font-medium uppercase tracking-brand text-ink-muted">
        {planName}
      </p>
      <h3 className="mt-2 font-display text-2xl font-light text-olive lg:text-3xl">
        Begin your ritual.
      </h3>
      <p className="mt-3 max-w-md text-base leading-relaxed text-ink-muted">
        Tell us how you would like it to arrive and a florist will call to agree
        the details. Nothing is charged here.
      </p>

      <form action={onSubmit} className="mt-7 flex flex-col gap-6">
        <fieldset>
          <legend className={labelClasses}>How often</legend>
          <div className="grid grid-cols-3 gap-2">
            {FREQUENCIES.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={frequency === f.id}
                onClick={() => setFrequency(f.id)}
                className={cn(
                  chipClasses,
                  frequency === f.id ? chipOnClasses : chipOffClasses,
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className={labelClasses}>Which day suits you</legend>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {DAYS.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={day === d}
                onClick={() => setDay(d)}
                className={cn(chipClasses, day === d ? chipOnClasses : chipOffClasses)}
              >
                {d}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className={labelClasses}>Where it should go</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {PLACES.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={place === p.id}
                onClick={() => setPlace(p.id)}
                className={cn(
                  chipClasses,
                  place === p.id ? chipOnClasses : chipOffClasses,
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="m-name" className={labelClasses}>
              Your name
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
              Phone
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
              Email
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
              Start from (optional)
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
            Area or address (optional)
          </label>
          <input
            id="m-location"
            name="location"
            autoComplete="address-level2"
            placeholder="Jumeirah, Dubai"
            className={fieldClasses}
          />
        </div>

        <div>
          <label htmlFor="m-notes" className={labelClasses}>
            Anything we should know (optional)
          </label>
          <textarea
            id="m-notes"
            name="notes"
            rows={3}
            placeholder="Colours you love, anything to avoid, where to leave them…"
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
            {pending ? "Sending…" : "Send enquiry"}
          </Button>
          <a
            href={CONTACT.whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center font-brand text-xs font-medium uppercase tracking-brand text-olive underline decoration-hairline underline-offset-8 transition-colors duration-200 ease-bloom hover:decoration-burnt-orange"
          >
            Prefer to talk? Message a florist
          </a>
        </div>
      </form>
    </div>
  );
}
