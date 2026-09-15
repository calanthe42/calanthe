import { CutoffCountdown } from "@/components/blocks/CutoffCountdown";

/**
 * Utility trust strip (flowers.ae-style drumbeat, Calanthe voice).
 * Centre line is client-locked copy. The flanking lines state service
 * facts only; the left one used to be an invented customer count.
 */
export function AnnouncementBar() {
  return (
    <div className="flex h-8 items-center bg-olive pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-center px-4 lg:justify-between lg:px-8">
        <p className="hidden font-brand text-[0.625rem] font-medium uppercase tracking-brand text-cream/60 lg:block">
          Delivering across all seven Emirates
        </p>
        <p className="text-center font-brand text-[0.625rem] font-medium uppercase tracking-brand text-cream">
          <CutoffCountdown />
        </p>
        <p className="hidden font-brand text-[0.625rem] font-medium uppercase tracking-brand text-cream/60 lg:block">
          Video approval on every order
        </p>
      </div>
    </div>
  );
}
