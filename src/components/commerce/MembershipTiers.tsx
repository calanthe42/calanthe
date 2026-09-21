"use client";

import { useState } from "react";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { buttonClasses } from "@/components/ui/Button";
import { MembershipEnquiryForm } from "@/components/commerce/MembershipEnquiryForm";
import { formatAed, membershipTiers } from "@/lib/data";
import { useScrollLock } from "@/lib/useScrollLock";
import { cn } from "@/lib/cn";

/**
 * The membership tiers, and the enquiry that begins one.
 *
 * "Begin" used to be a link to WhatsApp carrying one sentence of text, so the
 * atelier had no record that anyone had asked. It now opens a short form that
 * writes a real Enquiry (type MEMBERSHIP) into the system, which is where the
 * owner already works — she can see who wants a membership, which tier, which
 * day, and follow up. No payment is taken and no membership starts; that stays
 * a conversation, as it was always meant to be.
 */
export function MembershipTiers() {
  const [openTier, setOpenTier] = useState<string | null>(null);
  useScrollLock(openTier !== null);

  return (
    <>
      <Stagger className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
        {membershipTiers.map((tier) => (
          <StaggerItem key={tier.id} className="h-full">
            <article
              className={cn(
                "relative flex h-full flex-col rounded-media-sm border p-7 lg:p-8",
                tier.mostLoved ? "border-olive bg-cream" : "border-hairline bg-canvas",
              )}
            >
              {tier.mostLoved && (
                <p className="absolute -top-3 left-7 bg-burnt-orange px-3 py-1 font-brand text-[0.6875rem] font-medium uppercase tracking-brand text-cream">
                  Most loved
                </p>
              )}
              <h2 className="font-brand text-sm font-medium uppercase tracking-brand text-olive">
                {tier.name}
              </h2>
              <p className="mt-4 font-display text-3xl font-light text-olive">
                from {formatAed(tier.fromAedPerDelivery)}
                <span className="ml-1 text-base text-ink-muted">/ delivery</span>
              </p>
              <p className="mt-1 text-sm text-ink-muted">4 deliveries a month</p>
              <p className="mt-4 text-base leading-relaxed text-olive">{tier.blurb}</p>
              <ul className="mt-5 flex flex-1 flex-col gap-2">
                {tier.includes.map((line) => (
                  <li key={line} className="flex gap-2 text-sm text-ink-muted">
                    <span aria-hidden className="text-burnt-orange">
                      ·
                    </span>
                    {line}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => setOpenTier(tier.name)}
                className={cn(
                  buttonClasses(tier.mostLoved ? "primary" : "secondary"),
                  "mt-7 w-full",
                )}
              >
                Begin {tier.name}
              </button>
            </article>
          </StaggerItem>
        ))}
      </Stagger>

      {openTier && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Begin the ${openTier} membership`}
          /* Scrolls while Lenis is stopped — see the mobile menu in Header.tsx. */
          data-lenis-prevent
          className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-olive/45 p-4 pt-[max(env(safe-area-inset-top),2rem)] pb-16 shadow-[0_0_0_100vmax_rgb(43_47_27/0.45)] backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpenTier(null);
          }}
        >
          <div className="relative w-full max-w-xl rounded-sm border border-hairline bg-canvas p-6 shadow-[0_24px_60px_-24px_rgba(43,47,27,0.5)] lg:p-9">
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpenTier(null)}
              className="absolute end-3 top-3 flex h-11 w-11 items-center justify-center text-olive transition-opacity duration-200 ease-bloom hover:opacity-60"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <MembershipEnquiryForm
              planName={openTier}
              onClose={() => setOpenTier(null)}
            />
          </div>
        </div>
      )}
    </>
  );
}
