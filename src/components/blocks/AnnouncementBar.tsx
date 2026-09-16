"use client";

import { CutoffCountdown } from "@/components/blocks/CutoffCountdown";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/locale";

/**
 * The service strip at the very top of the header.
 *
 * It no longer paints its own olive band. Over the homepage photograph that
 * band met the transparent navigation row in a hard horizontal edge that
 * read as a stray rule across the hero — the "strange line near the top of
 * the header". The header now paints one continuous surface behind both
 * rows and this strip only sets type, so there is nothing left to seam.
 *
 * Type was 10px at 60% opacity, which is unreadable at arm's length and
 * below the project's own minimum. It is 12px at full strength now, and the
 * flanking service facts step back by being smaller in the hierarchy rather
 * than by being faded into the background.
 */
export function AnnouncementBar({ onDark }: { onDark: boolean }) {
  const t = useT();
  const side = cn(
    "hidden font-brand text-[0.6875rem] font-medium uppercase tracking-brand lg:block",
    onDark ? "text-cream/75" : "text-ink-muted",
  );

  return (
    <div className="flex h-9 items-center">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-center px-4 lg:justify-between lg:px-8">
        <p className={side}>{t.strip.emirates}</p>
        {/* 11px on a phone, 12px from lg. The old 10px at 60% opacity was
            unreadable; full-strength 12px caps across the whole width made
            a service note the loudest line on the screen. This is legible
            without outranking the hero. */}
        <p
          className={cn(
            "text-center font-brand text-[0.6875rem] font-medium uppercase tracking-brand lg:text-xs",
            onDark ? "text-cream/90" : "text-olive",
          )}
        >
          <CutoffCountdown />
        </p>
        <p className={side}>{t.strip.video}</p>
      </div>
    </div>
  );
}
