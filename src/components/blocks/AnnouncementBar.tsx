import { TRUST } from "@/lib/data";

/**
 * Utility trust strip (flowers.ae-style drumbeat, Calanthe voice).
 * Centre line is client-locked copy; the flanking counts are flagged
 * placeholders awaiting the client's real numbers.
 */
export function AnnouncementBar() {
  return (
    <div className="bg-olive pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex max-w-7xl items-center justify-center px-4 py-2 lg:justify-between lg:px-8">
        <p className="hidden font-brand text-[0.625rem] font-medium uppercase tracking-brand text-cream/60 lg:block">
          {TRUST.customersLine}
        </p>
        <p className="text-center font-brand text-[0.625rem] font-medium uppercase tracking-brand text-cream">
          Same-day delivery across the UAE
        </p>
        <p className="hidden font-brand text-[0.625rem] font-medium uppercase tracking-brand text-cream/60 lg:block">
          Video approval on every order
        </p>
      </div>
    </div>
  );
}
