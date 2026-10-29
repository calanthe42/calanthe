"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { readConsent, writeConsent, type ConsentChoice } from "@/lib/consent";
import { useT } from "@/lib/locale";

/* The exit is quicker than the entrance. */
const EXIT_MS = 240;

/**
 * THE COOKIE NOTICE — once per browser, on the first visit.
 *
 * A small olive card: one sentence that says what the site keeps and that
 * it runs no advertising or tracking, the Privacy Policy, Decline and
 * Accept. It is not a wall: the page stays usable behind it, and nothing on
 * the page moves. The welcome invitation waits
 * until she has answered (WelcomeOfferGate), so the two never stack.
 *
 * Nothing is rendered on the server: whether she has answered lives in this
 * browser, and a band that flashed for everyone and then vanished for
 * returning visitors would be worse than one that arrives a moment late.
 */
export function CookieNotice() {
  const t = useT();
  const c = t.cookies;
  const [phase, setPhase] = useState<"hidden" | "entering" | "open" | "closing">("hidden");

  useEffect(() => {
    if (readConsent()) return;
    /* Storage blocked: there is nowhere to keep an answer, so do not ask. */
    try {
      localStorage.getItem("calanthe-consent-probe");
    } catch {
      return;
    }
    setPhase("entering");
    const frame = requestAnimationFrame(() => setPhase("open"));
    return () => cancelAnimationFrame(frame);
  }, []);

  /* The floating WhatsApp button steps aside while the band is up. */
  useEffect(() => {
    const showing = phase === "entering" || phase === "open";
    document.body.classList.toggle("consent-open", showing);
    return () => document.body.classList.remove("consent-open");
  }, [phase]);

  function answer(choice: ConsentChoice) {
    writeConsent(choice);
    setPhase("closing");
    window.setTimeout(() => setPhase("hidden"), EXIT_MS);
  }

  if (phase === "hidden") return null;
  const open = phase === "open";

  /* A small card, not a slab: on a phone it floats just above the foot of
     the screen; from a tablet up it keeps to the far corner, clear of the
     hero's buttons. Accept is cream, not burnt orange — the page's one
     orange button stays the one that sells flowers. */
  return (
    <section
      aria-label={c.label}
      className={cn(
        "fixed inset-x-3 bottom-[max(env(safe-area-inset-bottom),0.75rem)] z-[75] rounded-md bg-olive p-4 text-cream",
        "shadow-[0_16px_40px_rgba(43,47,27,0.35)] sm:inset-x-auto sm:end-6 sm:bottom-6 sm:w-[24rem] sm:p-5",
        "transition-[translate,opacity] ease-bloom motion-reduce:translate-none motion-reduce:transition-opacity",
        open ? "translate-y-0 opacity-100 duration-500" : "translate-y-4 opacity-0 duration-200",
      )}
    >
      <p className="text-sm leading-relaxed">
        {c.text}{" "}
        <Link
          href="/privacy"
          className="whitespace-nowrap underline decoration-cream/50 underline-offset-4 transition-colors duration-200 ease-bloom hover:decoration-cream"
        >
          {c.privacy}
        </Link>
      </p>
      <div className="mt-3 flex gap-3">
        <Button type="button" variant="secondary-cream" size="compact" onClick={() => answer("declined")} className="flex-1">
          {c.decline}
        </Button>
        <Button
          type="button"
          variant="secondary-cream"
          size="compact"
          onClick={() => answer("accepted")}
          className="flex-1 bg-cream text-olive hover:opacity-90"
        >
          {c.accept}
        </Button>
      </div>
    </section>
  );
}
