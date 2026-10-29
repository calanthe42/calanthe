"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { customerRegister } from "@backend/actions/account";
import { AuthField } from "@/components/commerce/auth/AuthField";
import { TermsCheckbox } from "@/components/commerce/auth/TermsCheckbox";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { fieldClasses, fieldErrorClasses, labelClasses } from "@/components/ui/form-classes";
import { cn } from "@/lib/cn";
import { useLocale } from "@/lib/locale";
import { useScrollLock } from "@/lib/useScrollLock";
import { WELCOME_SEEN_KEY, welcomeAmount, type WelcomeGift } from "@/lib/welcome-offer";

/* backend/actions/account.ts refuses anything shorter. */
const MIN_PASSWORD = 10;
/* The exit is quicker than the entrance: she asked for it to go. */
const EXIT_MS = 240;

type Step = "offer" | "form" | "done";
type Phase = "entering" | "open" | "closing";

const remember = (state: "dismissed" | "registered") => {
  try {
    localStorage.setItem(WELCOME_SEEN_KEY, state);
  } catch {
    /* Private mode: the gate already declined to open without storage. */
  }
};

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * THE WELCOME INVITATION — a first-time visitor's one interruption.
 *
 * Three steps in one sheet: the offer, the account form, "check your inbox".
 * The first is short on purpose — the gift, one button, "Not now" — and the
 * form opens only when she asks for it. On a phone it is a bottom sheet with
 * the button in the thumb zone; from the desktop up, a card beside the bag.
 *
 * The client's orchid hang-tag carries the number. It is the one flourish:
 * it settles into place a beat after the sheet, and everything else is
 * still. Reduced motion: both simply fade.
 *
 * NOTHING HERE GRANTS THE GIFT. The account is made by the same server
 * action as /account/register; the gift is decided at checkout, from the
 * orders, once her address is confirmed (backend/data/welcome.ts).
 */
export function WelcomeOffer({ gift, onClose }: { gift: WelcomeGift; onClose: () => void }) {
  const { t } = useLocale();
  const w = t.welcome;
  const pathname = usePathname();
  const router = useRouter();
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const panelRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const [phase, setPhase] = useState<Phase>("entering");
  const [step, setStep] = useState<Step>("offer");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);
  const [sentTo, setSentTo] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const amount = welcomeAmount(gift);

  useScrollLock(phase !== "closing");

  /* In on the next frame, so the entrance is a transition and not a jump.
     The floating WhatsApp button steps aside while this is open, as it does
     for the menu (globals.css `.overlay-open`). */
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => setPhase("open"));
    document.body.classList.add("overlay-open");
    return () => {
      cancelAnimationFrame(frame);
      document.body.classList.remove("overlay-open");
      previous?.focus?.();
    };
  }, []);

  const close = useCallback(() => {
    if (pending) return;
    if (step !== "done") remember("dismissed");
    setPhase("closing");
    window.setTimeout(onClose, EXIT_MS);
  }, [pending, step, onClose]);

  /* Focus follows the step: the heading of the offer and of "check your
     inbox", the first field of the form. */
  useEffect(() => {
    if (phase !== "open") return;
    if (step === "form") document.getElementById(`${baseId}-name`)?.focus();
    else headingRef.current?.focus();
  }, [step, phase, baseId]);

  /* Escape closes; Tab stays inside the sheet. */
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      const panel = panelRef.current;
      if (event.key !== "Tab" || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      if (!panel.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && (active === first || active === headingRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    /* One password field with Show beside it, instead of typing it twice. */
    form.set("confirmPassword", String(form.get("password") ?? ""));
    setPending(true);
    setError(null);
    try {
      const result = await customerRegister(form);
      if (result.ok) {
        remember("registered");
        setSentTo(result.email);
        setStep("done");
        /* She is signed in now: the header and the basket catch up behind
           the sheet. */
        if (result.signedIn) router.refresh();
      } else {
        setError({ field: result.field, message: result.message });
        if (result.field) document.getElementById(`${baseId}-${result.field}`)?.focus();
      }
    } catch {
      setError({ message: t.server.account.registerFailed });
    } finally {
      setPending(false);
    }
  }

  const fieldError = (field: string) => (error?.field === field ? error.message : undefined);
  const open = phase === "open";
  const signInHref = `/account/login?next=${encodeURIComponent(pathname || "/")}`;

  const signIn = (
    <p className="text-base text-olive">
      {w.haveAccount}{" "}
      <Link
        href={signInHref}
        onClick={() => remember("dismissed")}
        className="underline decoration-hairline underline-offset-4 transition-colors duration-200 ease-bloom hover:decoration-burnt-orange"
      >
        {w.signIn}
      </Link>
    </p>
  );

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center lg:items-center lg:p-6">
      <div
        aria-hidden
        onClick={close}
        className={cn(
          "absolute inset-0 bg-olive/55 transition-opacity ease-bloom",
          open ? "opacity-100 duration-500" : "opacity-0 duration-200",
        )}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative w-full lg:flex lg:w-[56rem] lg:rounded-md lg:shadow-[0_24px_64px_rgba(43,47,27,0.28)]",
          /* Tailwind 4 moves with `translate`/`rotate`/`scale`, not `transform`. */
          "transition-[translate,opacity] ease-bloom motion-reduce:translate-none motion-reduce:transition-opacity",
          open ? "translate-y-0 opacity-100 duration-700" : "translate-y-8 opacity-0 duration-200 lg:translate-y-4",
        )}
      >
        {/* The hang-tag: outside the scrolling sheet so it can hang over
            its edge, and decorative — the sentence says the same. */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute -top-14 start-5 z-10 h-[7.5rem] w-[8.25rem] lg:-top-12 lg:start-[18.5rem]",
            "transition-[translate,rotate,scale,opacity] ease-bloom motion-reduce:rotate-none motion-reduce:scale-none motion-reduce:translate-none motion-reduce:transition-opacity",
            open
              ? "-rotate-[7deg] scale-100 opacity-100 delay-200 duration-[900ms] rtl:rotate-[7deg]"
              : "-rotate-[16deg] scale-90 opacity-0 duration-200 rtl:rotate-[16deg]",
            /* On a phone the form has a Back arrow where the tag hangs: the tag
               steps aside for it. */
            step === "form" && "translate-x-[3.25rem] rtl:-translate-x-[3.25rem] lg:translate-x-0 lg:rtl:translate-x-0",
          )}
        >
          <svg viewBox="0 0 132 48" fill="none" className="absolute -top-8 start-0 h-12 w-[8.25rem] overflow-visible">
            <path
              d="M66 46 C 55 22, 70 2, 87 8 C 104 14, 98 38, 72 46"
              stroke="currentColor"
              strokeWidth="1.1"
              strokeLinecap="round"
              className="text-olive"
            />
          </svg>
          <Image src="/brand/packaging/tag-cream.webp" alt="" fill sizes="132px" className="object-contain" />
          <span
            dir="ltr"
            className={cn(
              "absolute inset-x-0 top-[42%] text-center font-display leading-none text-olive",
              amount.length > 4 ? "text-2xl" : "text-[2.6rem]",
            )}
          >
            {amount}
          </span>
        </div>

        {/* From the desktop up: the bag the flowers arrive in. */}
        <div className="relative hidden w-[21rem] shrink-0 overflow-hidden rounded-s-md bg-cream lg:block">
          <Image
            src="/brand/packaging/bag-olive-tag.webp"
            alt=""
            fill
            sizes="336px"
            className="object-contain object-bottom px-6 pt-16"
          />
        </div>

        <div className="relative max-h-[92svh] flex-1 overflow-y-auto rounded-t-md bg-canvas shadow-[0_-16px_48px_rgba(43,47,27,0.22)] lg:max-h-[88svh] lg:rounded-md lg:rounded-s-none lg:shadow-none">
          <div aria-hidden className="absolute inset-x-0 top-2.5 mx-auto h-1 w-9 rounded-sm bg-hairline lg:hidden" />
          <button
            type="button"
            onClick={close}
            disabled={pending}
            aria-label={w.close}
            className="absolute end-2 top-2 z-10 flex h-11 w-11 items-center justify-center text-olive transition-opacity duration-200 ease-bloom hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-olive disabled:opacity-45"
          >
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden>
              <path d="M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
          {step === "form" ? (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setStep("offer");
              }}
              disabled={pending}
              aria-label={w.back}
              className="absolute start-2 top-2 z-10 flex h-11 w-11 items-center justify-center text-olive transition-opacity duration-200 ease-bloom hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-olive disabled:opacity-45 lg:hidden"
            >
              <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] rtl:-scale-x-100" aria-hidden>
                <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
              </svg>
            </button>
          ) : null}

          <div
            key={step}
            className="flex flex-col gap-6 px-6 pb-[max(env(safe-area-inset-bottom),1.75rem)] pt-[4.5rem] animate-[quiet-fade-in_300ms_cubic-bezier(0.22,1,0.36,1)] motion-reduce:animate-none lg:px-14 lg:pb-10 lg:pt-20"
          >
            {step === "offer" ? (
              <>
                <div className="flex flex-col gap-2.5">
                  <Eyebrow>{w.eyebrow}</Eyebrow>
                  <h2
                    id={titleId}
                    ref={headingRef}
                    tabIndex={-1}
                    className="welcome-heading font-display text-[2.375rem] font-light leading-[1.05] text-olive lg:text-[2.75rem]"
                  >
                    {w.title.replace("{amount}", amount)}
                  </h2>
                  <p className="text-base leading-relaxed text-ink-muted">{w.lead}</p>
                </div>
                <div className="flex flex-col items-stretch gap-1 lg:flex-row lg:items-center lg:gap-5">
                  <Button type="button" variant="primary" onClick={() => setStep("form")} className="w-full lg:w-auto lg:px-8">
                    {w.create}
                  </Button>
                  <Button type="button" variant="text" onClick={close} className="self-center px-3 text-base lg:self-auto">
                    {w.notNow}
                  </Button>
                </div>
                <div className="flex flex-col gap-2 border-t border-hairline pt-4">
                  {signIn}
                  <p className="text-sm leading-relaxed text-ink-muted">{w.terms}</p>
                </div>
              </>
            ) : step === "form" ? (
              <form onSubmit={submit} noValidate className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <Eyebrow>{w.formEyebrow}</Eyebrow>
                  <h2 id={titleId} className="font-display text-[2.125rem] font-light leading-[1.08] text-olive">
                    {w.formTitle}
                  </h2>
                  <p className="text-base leading-relaxed text-ink-muted">{w.formLead.replace("{amount}", amount)}</p>
                </div>

                <AuthField
                  id={`${baseId}-name`}
                  name="name"
                  label={w.name}
                  autoComplete="name"
                  required
                  disabled={pending}
                  error={fieldError("name")}
                />
                <AuthField
                  id={`${baseId}-email`}
                  name="email"
                  type="email"
                  inputMode="email"
                  label={w.email}
                  autoComplete="email"
                  required
                  disabled={pending}
                  error={fieldError("email")}
                />
                <div>
                  <label htmlFor={`${baseId}-password`} className={labelClasses}>
                    {w.password}
                  </label>
                  <div className="relative">
                    <input
                      id={`${baseId}-password`}
                      name="password"
                      type={showPassword ? "text" : "password"}
                      dir="ltr"
                      autoComplete="new-password"
                      minLength={MIN_PASSWORD}
                      required
                      disabled={pending}
                      aria-invalid={fieldError("password") ? true : undefined}
                      aria-describedby={`${baseId}-password-${fieldError("password") ? "error" : "hint"}`}
                      className={cn(fieldClasses, "pe-20 text-start")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((shown) => !shown)}
                      aria-pressed={showPassword}
                      aria-controls={`${baseId}-password`}
                      className="absolute inset-y-0 end-0 flex min-w-16 items-center justify-center px-3 text-sm text-olive underline decoration-hairline underline-offset-4 transition-colors duration-200 ease-bloom hover:decoration-burnt-orange focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-olive"
                    >
                      {showPassword ? w.hide : w.show}
                    </button>
                  </div>
                  {fieldError("password") ? (
                    <p id={`${baseId}-password-error`} role="alert" className={fieldErrorClasses}>
                      <span aria-hidden className="text-burnt-orange">
                        ·
                      </span>
                      {fieldError("password")}
                    </p>
                  ) : (
                    <p id={`${baseId}-password-hint`} className="mt-2 text-xs leading-relaxed text-ink-muted">
                      {w.passwordHint.replace("{min}", String(MIN_PASSWORD))}
                    </p>
                  )}
                </div>

                <TermsCheckbox id={`${baseId}-terms`} error={fieldError("terms")} disabled={pending} />

                {error && !error.field ? (
                  <p role="alert" className="border-s border-burnt-orange ps-4 text-base leading-relaxed text-olive">
                    {error.message}
                  </p>
                ) : null}

                <div className="flex flex-col gap-4">
                  <Button type="submit" variant="primary" disabled={pending} aria-busy={pending || undefined} className="w-full">
                    {pending ? w.creating : w.create}
                  </Button>
                  <div className="text-center">{signIn}</div>
                </div>
              </form>
            ) : (
              <>
                <div className="flex flex-col items-center gap-2.5 text-center lg:items-start lg:text-start">
                  <Eyebrow>{w.doneEyebrow}</Eyebrow>
                  <h2
                    id={titleId}
                    ref={headingRef}
                    tabIndex={-1}
                    className="welcome-heading font-display text-[2.375rem] font-light leading-[1.05] text-olive"
                  >
                    {w.doneTitle}
                  </h2>
                  <p className="max-w-sm text-base leading-relaxed text-ink-muted">
                    {w.doneLead.replace("{amount}", amount).split("{email}").map((part, index, parts) => (
                      <span key={index}>
                        {part}
                        {index < parts.length - 1 ? (
                          <span dir="ltr" className="font-medium text-olive">
                            {sentTo}
                          </span>
                        ) : null}
                      </span>
                    ))}
                  </p>
                </div>
                <Button type="button" variant="primary" onClick={close} className="w-full lg:w-auto lg:self-start lg:px-8">
                  {w.continue}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
