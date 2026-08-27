"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { EASE_BLOOM } from "@/components/motion/constants";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Monogram } from "@/components/ui/Monogram";
import { cn } from "@/lib/cn";
import { useToast } from "@/lib/toast";

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

export function LoginFlow() {
  const router = useRouter();
  const { toast } = useToast();

  const [stage, setStage] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [resendIn, setResendIn] = useState(RESEND_SECONDS);
  const cellsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (stage !== "otp" || resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [stage, resendIn]);

  function sendCode() {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 8) {
      toast("Enter your full phone number");
      return;
    }
    setStage("otp");
    setResendIn(RESEND_SECONDS);
    setOtp(Array(OTP_LENGTH).fill(""));
    toast("Code sent on WhatsApp (mock: any 6 digits work)");
  }

  function verify(cells: string[]) {
    if (cells.some((c) => c === "")) return;
    /* Mock verification — the backend phase wires the real OTP. */
    try {
      localStorage.setItem("calanthe-auth-v1", JSON.stringify({ phone }));
    } catch {
      /* storage unavailable */
    }
    toast("Welcome back to the atelier");
    router.push("/account");
  }

  function handleCell(index: number, value: string) {
    const digits = value.replace(/\D/g, "");
    const next = [...otp];

    if (digits.length > 1) {
      /* Paste: distribute across cells. */
      for (let i = 0; i < OTP_LENGTH - index; i++) {
        next[index + i] = digits[i] ?? next[index + i] ?? "";
      }
      setOtp(next);
      cellsRef.current[Math.min(index + digits.length, OTP_LENGTH - 1)]?.focus();
    } else {
      next[index] = digits;
      setOtp(next);
      if (digits && index < OTP_LENGTH - 1) {
        cellsRef.current[index + 1]?.focus();
      }
    }
    verify(next);
  }

  return (
    <div className="flex flex-col items-center text-center">
      <Monogram className="w-14 text-olive" />
      <Eyebrow className="mt-6">Your Atelier Account</Eyebrow>

      <AnimatePresence mode="wait" initial={false}>
        {stage === "phone" ? (
          <motion.div
            key="phone"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.4, ease: EASE_BLOOM }}
            className="mt-6 w-full"
          >
            <h1 className="font-display text-3xl font-light text-olive">
              Sign in with your phone.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-sage">
              We&apos;ll send a one-time code to your WhatsApp.
            </p>
            <div className="mt-8 flex w-full items-stretch gap-2">
              <span className="flex items-center rounded-sm border border-hairline bg-cream px-3 text-base text-olive">
                +971
              </span>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^\d\s]/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && sendCode()}
                placeholder="50 123 4567"
                className="min-w-0 flex-1 rounded-sm border border-hairline bg-canvas px-4 py-3 text-base text-olive placeholder:text-sage/70 focus:border-olive focus:outline-none"
              />
            </div>
            <Button variant="primary" className="mt-4 w-full" onClick={sendCode}>
              Continue on WhatsApp
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="otp"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.4, ease: EASE_BLOOM }}
            className="mt-6 w-full"
          >
            <h1 className="font-display text-3xl font-light text-olive">
              Enter the code.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-sage">
              Sent to +971 {phone || "…"} on WhatsApp.
            </p>
            <div className="mt-8 flex justify-center gap-2">
              {otp.map((cell, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    cellsRef.current[i] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={OTP_LENGTH}
                  value={cell}
                  aria-label={`Digit ${i + 1}`}
                  onChange={(e) => handleCell(i, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Backspace" && !otp[i] && i > 0) {
                      cellsRef.current[i - 1]?.focus();
                    }
                  }}
                  onFocus={(e) => e.target.select()}
                  className={cn(
                    "h-14 w-11 rounded-sm border text-center font-display text-2xl text-olive focus:outline-none",
                    cell
                      ? "border-olive bg-cream"
                      : "border-hairline bg-canvas focus:border-olive",
                  )}
                />
              ))}
            </div>
            <div className="mt-6 flex flex-col items-center gap-3">
              {resendIn > 0 ? (
                <p className="text-sm text-sage">Resend code in {resendIn}s</p>
              ) : (
                <button
                  type="button"
                  onClick={sendCode}
                  className="min-h-11 text-sm text-olive underline underline-offset-4 transition-opacity duration-200 ease-bloom hover:opacity-70"
                >
                  Resend code
                </button>
              )}
              <button
                type="button"
                onClick={() => setStage("phone")}
                className="min-h-11 text-sm text-sage transition-colors duration-200 ease-bloom hover:text-olive"
              >
                Use a different number
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
