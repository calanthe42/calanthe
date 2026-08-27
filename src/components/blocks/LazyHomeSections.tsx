"use client";

import dynamic from "next/dynamic";

/*
 * Below-the-fold GSAP scenes load as separate chunks after hydration —
 * they carry no SEO content beyond client-approved copy that also lives
 * in the fallback shells, and deferring them cuts main-thread work on
 * first load (Lighthouse TBT). Fallbacks reserve the section's height
 * so lazy-loading can never shift layout.
 */

export const LazyBuildYourOwnBanner = dynamic(
  () =>
    import("@/components/blocks/BuildYourOwnBanner").then((m) => m.BuildYourOwnBanner),
  {
    ssr: false,
    loading: () => <div aria-hidden className="h-svh bg-burgundy" />,
  },
);

export const LazyWeeklyRitual = dynamic(
  () => import("@/components/blocks/WeeklyRitual").then((m) => m.WeeklyRitual),
  {
    ssr: false,
    loading: () => <div aria-hidden className="min-h-[28rem] lg:min-h-[34rem]" />,
  },
);
