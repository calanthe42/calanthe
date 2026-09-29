"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useId, useState } from "react";
import { Reveal } from "@/components/motion/Reveal";
import { buttonClasses } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Icon360 } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/locale";
import { useReducedMotionPref } from "@/lib/useReducedMotionPref";
import { useScrollLock } from "@/lib/useScrollLock";

/*
 * The viewer's code arrives only when someone asks to step inside. Until
 * then this section costs a poster image and some markup.
 */
const PanoramaViewer = dynamic(
  () => import("./PanoramaViewer").then((m) => m.PanoramaViewer),
  { ssr: false },
);

type View = "pano" | "indoor" | "outdoor" | "set";
const VIEWS: readonly View[] = ["pano", "indoor", "outdoor", "set"];
type Still = Exclude<View, "pano">;

/* PDF pages 5, 6 and 10 of the booth deliverable, taken from the raw renders
   so the vendor's logo, QR code and labels are not on them. */
const STILLS: Record<Still, string> = {
  indoor: "/brand/booth/indoor.webp",
  outdoor: "/brand/booth/outdoor.webp",
  set: "/brand/booth/set-3.webp",
};

/* The booth's panorama, hosted here (see PanoramaViewer for why). */
const PANORAMA = { src: "/brand/booth/pano-4k.webp", large: "/brand/booth/pano-8k.webp" };
/* The same panorama on Chaos Cloud — only as the way out if this device
   cannot draw it. */
const CHAOS = "https://cloud.chaos.com/collaboration/n/Ch9uNFweemZRjr7WhqbaJ4?t=pan";
/* The panelled door, the lamp and the mirror sit this far right of the
   image centre; the camera opens facing them rather than a blank wall. */
const FACING_DEGREES = 95;

const SIZES = "(max-width: 1024px) 94vw, 1216px";

/**
 * The booth, in one frame.
 *
 * Opens on the indoor render with a single action, "Step inside", which
 * turns the frame into the 360° panorama in place. The other three views are
 * the renders the client chose from the booth deliverable. On a phone the
 * frame is taller than the renders, so each still keeps its whole
 * composition and a soft, blurred copy of itself fills the rest — nothing of
 * the booth is cropped away.
 */
export function BoothShowcase() {
  const b = useT().booth;
  const reduced = useReducedMotionPref();
  const id = useId();
  const [view, setView] = useState<View>("pano");
  const [started, setStarted] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  /* A still is only fetched once it has been asked for. */
  const [seen, setSeen] = useState<ReadonlySet<Still>>(() => new Set<Still>(["indoor"]));

  useScrollLock(expanded);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  const select = useCallback((next: View) => {
    setView(next);
    if (next === "pano") setStarted(true);
    else {
      setReady(false);
      setExpanded(false);
      setSeen((prev) => (prev.has(next) ? prev : new Set([...prev, next])));
    }
  }, []);

  const onTabKey = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const rtl = document.documentElement.dir === "rtl";
    const step =
      e.key === "ArrowRight"
        ? rtl
          ? -1
          : 1
        : e.key === "ArrowLeft"
          ? rtl
            ? 1
            : -1
          : 0;
    if (!step) return;
    e.preventDefault();
    const next = VIEWS[(VIEWS.indexOf(view) + step + VIEWS.length) % VIEWS.length]!;
    select(next);
    document.getElementById(`${id}-tab-${next}`)?.focus();
  };

  const showPanorama = view === "pano" && started && !failed;
  const stillVisible = (k: Still) =>
    view === k || (k === "indoor" && view === "pano" && !ready);

  return (
    <section id="booth" className="relative scroll-mt-16 bg-burgundy section-pad">
      <div className="mx-auto max-w-7xl gutter">
        <Reveal className="grid gap-5 lg:grid-cols-2 lg:items-end lg:gap-16">
          <div>
            <Eyebrow className="text-cream/60">{b.eyebrow}</Eyebrow>
            <h2 className="display-2 mt-3 font-display font-light text-cream">
              {b.title}
            </h2>
          </div>
          <p className="max-w-md text-base leading-relaxed text-cream/80 lg:justify-self-end">
            {b.body}
          </p>
        </Reveal>

        {/* THE FRAME. A thin cream moulding round a single stage. It sits
            outside every reveal wrapper on purpose: a transformed ancestor
            would pin the full-screen view to the section instead of the
            screen. */}
        <div className="mt-10 rounded-[4px] border border-cream/25 p-2 sm:p-3 lg:mt-14">
          {/* Keeps its size while the stage is lifted to full screen, so the
              page behind does not jump. */}
          <div className="relative aspect-[4/5] sm:aspect-[4/3] lg:aspect-[16/9]">
            <div
              id={`${id}-panel`}
              role="tabpanel"
              aria-labelledby={`${id}-tab-${view}`}
              data-lenis-prevent={expanded || undefined}
              className={cn(
                "overflow-hidden bg-burgundy",
                expanded
                  ? "fixed inset-0 z-[90] h-[100svh] w-full shadow-[0_0_0_100vmax_var(--color-burgundy)]"
                  : "absolute inset-0 rounded-[2px]",
              )}
            >
              {(Object.keys(STILLS) as Still[]).map((k) =>
                seen.has(k) ? (
                  <div
                    key={k}
                    aria-hidden={!stillVisible(k)}
                    className={cn(
                      /* On a phone the frame is taller than the render, so the
                         render sits whole on a cream mat, like a print — never
                         cropped. From a laptop up it fills the frame. */
                      "absolute inset-0 bg-canvas transition-opacity duration-700 ease-bloom",
                      stillVisible(k) ? "opacity-100" : "opacity-0",
                    )}
                  >
                    <div className="absolute inset-3 lg:inset-0">
                      <Image
                        src={STILLS[k]}
                        alt={b.alts[k]}
                        fill
                        sizes={SIZES}
                        className={cn("object-contain", k !== "set" && "lg:object-cover")}
                      />
                    </div>
                  </div>
                ) : null,
              )}

              {showPanorama && (
                <div
                  className={cn(
                    "absolute inset-0 transition-opacity duration-700 ease-bloom",
                    ready ? "opacity-100" : "pointer-events-none opacity-0",
                  )}
                >
                  <PanoramaViewer
                    src={PANORAMA.src}
                    srcLarge={PANORAMA.large}
                    initialLongitude={FACING_DEGREES}
                    reducedMotion={reduced}
                    immersive={expanded}
                    labels={{
                      view: b.viewLabel,
                      hint: b.hint,
                      turnLeft: b.turnLeft,
                      turnRight: b.turnRight,
                    }}
                    onReady={() => setReady(true)}
                    onFail={() => setFailed(true)}
                  />
                </div>
              )}

              {/* The one action, until it is taken. */}
              {view === "pano" && !started && (
                <div className="absolute inset-0 flex items-end justify-center pb-8 sm:items-center sm:pb-0">
                  <button
                    type="button"
                    onClick={() => setStarted(true)}
                    className={buttonClasses("primary", "gap-3")}
                  >
                    <Icon360 className="h-4 w-4" />
                    {b.stepInside}
                  </button>
                </div>
              )}

              {view === "pano" && started && !ready && !failed && (
                <p
                  role="status"
                  className="absolute inset-x-0 bottom-8 text-center font-brand text-[0.6875rem] font-medium uppercase tracking-brand text-cream [text-shadow:0_1px_12px_rgb(46_19_27/0.6)]"
                >
                  {b.opening}
                </p>
              )}

              {view === "pano" && failed && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-burgundy/80 px-6 text-center">
                  <p className="max-w-xs text-base text-cream">{b.unsupported}</p>
                  <a
                    href={CHAOS}
                    target="_blank"
                    rel="noreferrer"
                    className={buttonClasses("secondary-cream")}
                  >
                    {b.openExternal}
                  </a>
                </div>
              )}

              {view === "pano" && ready && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  aria-label={expanded ? b.collapse : b.expand}
                  className="absolute end-3 top-3 flex h-11 w-11 items-center justify-center rounded-[3px] border border-cream/40 bg-burgundy/55 text-cream backdrop-blur-sm transition-colors duration-200 ease-bloom hover:border-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream"
                  style={
                    expanded
                      ? { top: "max(env(safe-area-inset-top), 0.75rem)" }
                      : undefined
                  }
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
                    <path
                      d={
                        expanded
                          ? "M6 6l12 12M18 6L6 18"
                          : "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"
                      }
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* The views. A tab list: one panel, four ways of showing it. */}
        <div
          role="tablist"
          aria-label={b.viewsLabel}
          className="mt-5 flex flex-wrap items-center justify-center gap-x-7 gap-y-1"
        >
          {VIEWS.map((k) => (
            <button
              key={k}
              id={`${id}-tab-${k}`}
              type="button"
              role="tab"
              aria-selected={view === k}
              aria-controls={`${id}-panel`}
              tabIndex={view === k ? 0 : -1}
              onClick={() => select(k)}
              onKeyDown={onTabKey}
              className={cn(
                "min-h-11 border-b font-brand text-xs font-medium uppercase tracking-brand transition-colors duration-200 ease-bloom focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cream",
                view === k
                  ? "border-burnt-orange text-cream"
                  : "border-transparent text-cream/55 hover:text-cream",
              )}
            >
              {b.views[k]}
            </button>
          ))}
        </div>
        <p
          aria-live="polite"
          className="mt-2 text-center text-base text-cream/70 lg:text-sm"
        >
          {b.captions[view]}
        </p>
      </div>
    </section>
  );
}
