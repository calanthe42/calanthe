"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useLenisInstance } from "@/lib/lenis-context";
import { useReducedMotionPref } from "@/lib/useReducedMotionPref";

/**
 * ONE MARK, TRAVELLING — the hero's brand lockup and the navbar's are the
 * same physical object, and scrolling moves it between the two.
 *
 * WHY THIS IS A REWRITE AND NOT A REVIVAL.
 *
 * The previous version rendered a SECOND copy of the lockup as a
 * `position: fixed` element outside the header and flew it upward with a
 * scrubbed GSAP timeline. Measured, its offset from the navigation row ran
 *
 *     223 → 231 → 178 → 18 → 0     (scroll 0 → 60 → 120 → 300 → 800)
 *
 * It moved DOWN before it moved up, because the service strip left the
 * sticky flow at ~32px and shifted the row the mark was aiming at, while
 * the timeline was still interpolating toward the old target. Being fixed
 * and at z-45 against a z-40 header, it also painted straight over the
 * navigation. Two faults, one cause: the mark and its destination were
 * different elements in different stacking contexts, so their positions had
 * to be kept in sync by hand, and every layout change broke the agreement.
 *
 * THE FIX IS STRUCTURAL. There is now exactly one lockup, and it lives IN
 * the header's centre slot permanently. It is never moved to the hero —
 * instead it is TRANSFORMED down into the hero while the page is at the
 * top, and the transform relaxes to identity as you scroll. So:
 *
 *   · Docked is the element's natural position. There is no target to
 *     miss, and nothing to re-measure when the layout changes.
 *   · Horizontal is never computed. Both ends are the centre of the same
 *     row, so the x-offset is identically zero at every width — which is
 *     what "different centering logic on desktop/mobile" came from.
 *   · It is a child of the header, so it cannot paint over it.
 *   · Position is a pure function of scrollY, so scrolling back up runs
 *     the journey backwards exactly, with no state to fall out of sync.
 *   · The service strip can move, the row can change height, the
 *     breakpoint can change — the docked position is still just "where
 *     this element already is".
 *
 * Transform and opacity only, written to custom properties from a single
 * rAF-throttled scroll listener, so the compositor does the work.
 */

/** The artwork's own ratio, from the Illustrator master. */
const STACKED_RATIO = 1080 / 717.91;

/** Breathing room kept between the mark and both the header and the copy. */
const BAND_PADDING = 32;

/**
 * Under this height the mark does not travel at all.
 *
 * A 553px screen with a 102px header and a full copy block leaves under 90px
 * of clear space. A lockup that small over the photograph is not a brand
 * moment — the crisp one already in the navbar says more. So the hero simply
 * opens without it, which is a decision rather than a failed fit.
 */
const MIN_MARK = 72;

/** How much scrolling completes the journey, as a fraction of the hero. */
const TRAVEL = 0.42;

export function HeroMarkTravel() {
  const pathname = usePathname();
  const reduced = useReducedMotionPref();
  const lenis = useLenisInstance();

  useEffect(() => {
    /* Only the homepage has a full-bleed hero for the mark to sit in.
       Everywhere else it simply stays in the bar, which is its home. */
    if (pathname !== "/" || reduced) return;

    const mark = document.querySelector<HTMLElement>("[data-travel-mark]");
    const hero = document.querySelector<HTMLElement>("[data-hero-root]");
    if (!mark || !hero) return;

    let frame = 0;
    /* Null until Lenis reports a position; `apply` then prefers it. */
    const scrollRef: { current: number | null } = { current: null };
    let navCentre = 0;
    let heroCentre = 0;
    let distance = 1;
    let heroShrink = 1;
    let tooShort = false;
    let naturalH = 0;
    let headerH = 0;
    let bandBottom = 0;
    let dockShrink = 0.25;

    /**
     * Measured, never assumed: the docked centre is read with the travel
     * transform genuinely cleared.
     *
     * THE VARIABLES THAT MUST BE CLEARED ARE `--travel-y` AND
     * `--travel-shrink`, because those are the two the transform actually
     * reads. Clearing `--travel` alone looks right but changes nothing, so
     * the element is still expanded out in the hero when it is measured —
     * and the "docked centre" comes back as the hero centre. The difference
     * between them is then zero and the mark never moves at all.
     *
     * That was harmless while measure() only ever ran once, before the first
     * transform was applied. The moment anything re-measures — a rotate, a
     * width change, a second pass after load — it silently kills the
     * animation.
     */
    const headerEl = document.querySelector<HTMLElement>("header");
    const copyEl = document.querySelector<HTMLElement>("[data-hero-copy]");

    const dockShrinkOf = (navW: number, heroW: number) =>
      heroW && navW ? navW / heroW : 0.25;

    const measure = () => {
      mark.style.setProperty("--travel-y", "0px");
      mark.style.setProperty("--travel-shrink", "1");
      const rect = mark.getBoundingClientRect();
      navCentre = rect.top + rect.height / 2;

      const heroBox = hero.getBoundingClientRect();
      const heroHeight = heroBox.height || window.innerHeight;
      distance = Math.max(1, heroHeight * TRAVEL);

      /**
       * THE MARK IS CENTRED IN THE CLEAR BAND, NOT AT A FIXED FRACTION.
       *
       * It used to sit at 46% of the hero's height while the words were
       * anchored to the hero's bottom. Two unrelated anchoring systems: as
       * the viewport shortens they converge, and nothing in the layout
       * prevents it. Measured on real phone viewports with Safari's toolbars
       * showing, the lockup overlapped the eyebrow on 16 of 18 cases — by
       * 136px on an iPhone SE. The only case that passed was 390x844 with no
       * browser chrome, which is exactly the viewport a desktop test uses.
       *
       * The band is the space between the header and the top of the copy.
       * Centring the mark inside it means the relationship is defined by the
       * layout rather than by a constant that happens to work at one height.
       */
      /* `--logo-hero-w` is `min(78vw, 330px)` — a calc expression, not a
         number, so parseFloat returns NaN and the whole animation silently
         fell back to a hardcoded 4x. Measuring a throwaway element that
         carries the property lets the browser resolve it, which keeps the
         CSS the single source of truth for how large the hero mark is. */
      const probe = document.createElement("div");
      probe.style.cssText =
        "position:absolute;visibility:hidden;pointer-events:none;width:var(--logo-hero-w)";
      document.body.appendChild(probe);
      const heroWidth = probe.getBoundingClientRect().width;
      probe.remove();

      /**
       * A CONSTRAINT, NOT A FORMULA.
       *
       * Three attempts at this failed the same way: each computed where the
       * mark should go, and each could be wrong if the copy's height changed
       * after the sum was done. The mark then either sat on the headline or
       * was cropped behind the header, and which one depended on the
       * language and on timing.
       *
       * So the band is now solved rather than estimated. Both edges come
       * from ONE number — the space left over once the header and the copy
       * have taken theirs — and the mark is sized to fit inside it:
       *
       *     top    = headerHeight + padding + (band - markHeight) / 2
       *     bottom = top + markHeight
       *
       * Because `markHeight <= band` by construction, the top can never rise
       * above the header and the bottom can never reach the copy. A stale
       * measurement changes how BIG the mark is, never whether it collides —
       * and the observers below correct the size on the next frame.
       */
      const headerHeight = headerEl
        ? headerEl.getBoundingClientRect().height
        : rect.height * 2;

      const copyHeight = copyEl
        ? copyEl.getBoundingClientRect().height
        : heroHeight * 0.5;

      /* COMPOSE AGAINST WHAT IS VISIBLE, not against the hero's box.
         The hero carries `min-h-[600px]`, so on a 553px iPhone SE with
         Safari's chrome showing it is TALLER than the screen — and sizing
         the mark to space below the fold is what put it back on the
         headline at exactly those two viewports. */
      const visible = Math.min(heroHeight, window.innerHeight);
      const band = visible - copyHeight - headerHeight - BAND_PADDING * 2;

      /* The artwork is laid out at `--logo-hero-w`; this is the height that
         width implies, and the height it may actually occupy. */
      const naturalHeight = heroWidth / STACKED_RATIO;
      naturalH = naturalHeight;
      headerH = headerHeight;
      bandBottom = headerHeight + BAND_PADDING + band;
      const markHeight = Math.max(0, Math.min(naturalHeight, band));

      /* Below this there is genuinely no room to compose: a 40px lockup
         floating over the photograph says less than the one already sitting
         in the bar. It stays docked, which is a deliberate state rather than
         a shrunken one — and it is still fully visible, just in the header. */
      tooShort = markHeight < MIN_MARK;

      /* When there is no room to compose, the hero end of the journey IS
         the docked position: same centre, same size, nothing to travel. */
      heroCentre = tooShort
        ? navCentre
        : headerHeight + BAND_PADDING + band / 2;

      const navWidth = rect.width;
      heroShrink = naturalHeight && !tooShort ? markHeight / naturalHeight : dockShrinkOf(rect.width, heroWidth);
      dockShrink = dockShrinkOf(navWidth, heroWidth);
    };

    const apply = () => {
      frame = 0;
      /* 0 = fully in the hero, 1 = fully docked in the navbar.

         `scrollRef.current` rather than `window.scrollY`: while Lenis is
         driving, the authoritative position is the one Lenis just wrote in
         the GSAP ticker. Reading the window instead meant this ran off a
         second, unsynchronised clock — see the listener block below. */
      const y = scrollRef.current ?? window.scrollY;
      const progress = Math.min(1, Math.max(0, y / distance));
      const eased = progress * progress * (3 - 2 * progress); // smoothstep

      mark.style.setProperty("--travel", String(eased));
      /* ROUNDED TO WHOLE PIXELS. The lockup is a bitmap; a translate of
         190.83px leaves it straddling a pixel boundary, and the browser
         re-samples it every frame. Over a scroll that is a continuous
         shimmer — the "shaky logo" on a phone, where the device pixel
         ratio makes the resampling coarser and the momentum scroll makes
         it constant. Whole pixels cost nothing visually at this size. */
      /**
       * THE TOP EDGE IS ENFORCED HERE, EVERY FRAME.
       *
       * measure() computes a band that cannot collide — but only while its
       * inputs are current, and the copy's height changes when a webfont
       * swaps or Arabic rewraps. Three rounds of observers narrowed that
       * window without closing it, and the mark still cropped behind the
       * header on a handful of Arabic viewports.
       *
       * So the constraint is applied where it can never be stale: whatever
       * measure() decided, the mark is pushed back down if its top would
       * rise above the header. A stale band now costs a few pixels of
       * position, never a clipped logo.
       */
      let travelY = (1 - eased) * (heroCentre - navCentre);
      const currentH = naturalH * (heroShrink + eased * (dockShrink - heroShrink));
      const top = navCentre + travelY - currentH / 2;
      const minTop = headerH + BAND_PADDING;
      if (!tooShort && top < minTop) travelY += minTop - top;

      /* And the same bound on the other side. Clamping only the top fixed
         the crop and left the opposite failure: a band measured too tall put
         the mark 180px BELOW where it belonged, straight through the
         headline. Both edges are bounded, and because the mark is never
         taller than the band the two can always be satisfied at once. */
      /* Bounded against the band measured at rest, NOT against a live
         `getBoundingClientRect()` of the copy: that value is
         viewport-relative, so reading it inside a scroll handler made the
         bound shrink as the page scrolled and dragged the mark 250px up the
         screen. The cached band is occasionally stale; a scroll-dependent
         one is wrong on every frame. */
      const bottom = navCentre + travelY + currentH / 2;
      if (!tooShort && bottom > bandBottom) travelY -= bottom - bandBottom;

      mark.style.setProperty("--travel-y", `${Math.round(travelY)}px`);
      /* SHRINK, never grow: the artwork is laid out at the hero width (see
         `.travel-mark .stacked-logo` in globals.css) so it is rasterised at
         its largest and only ever scaled down. `heroShrink` is whatever fits
         the clear band above the copy; `dockShrink` is the navbar. */
      mark.style.setProperty(
        "--travel-shrink",
        String(heroShrink + eased * (dockShrink - heroShrink)),
      );
      /* Cream nearly the whole way, olive only as it lands. Turning at 62%
         left the mark mid-dissolve while it was still out over the
         photograph — and olive on a dark bouquet is invisible, so it read
         as the logo ghosting out rather than travelling. It now holds
         cream until it is essentially on the bar. */
      mark.style.setProperty(
        "--travel-cream",
        String(1 - Math.max(0, (eased - 0.86) / 0.14)),
      );
      /* While it is out over the hero it is decoration, not a target —
         a 560px link must not swallow taps meant for the photograph. */
      mark.dataset.travelling = eased < 0.98 ? "true" : "false";
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(apply);
    };

    /**
     * ONLY A WIDTH CHANGE IS A REAL LAYOUT CHANGE — ON A PHONE.
     *
     * A desktop browser fires `resize` when you drag the window. A phone
     * fires it CONSTANTLY WHILE YOU SCROLL, because the address bar
     * collapses and expands and the viewport height changes with it. The
     * hero is `h-svh`, so re-measuring on every one of those events moved
     * the target mid-journey and the mark visibly jumped — on a real
     * handset only, which is why no desktop test could ever see it.
     *
     * Width (and orientation) genuinely change the layout. Height alone,
     * during a scroll, is browser chrome and must be ignored.
     */
    let lastWidth = window.innerWidth;
    const onResize = () => {
      if (window.innerWidth === lastWidth) return;
      lastWidth = window.innerWidth;
      measure();
      apply();
    };

    measure();
    apply();

    /* The first measure runs before the brand image has necessarily laid
       out, which on a phone can leave the docked centre a few pixels off
       for the whole journey. Measuring again once everything has loaded
       costs nothing and makes the landing exact. */
    const remeasure = () => {
      measure();
      apply();
    };
    if (document.readyState !== "complete") {
      window.addEventListener("load", remeasure, { once: true });
    }

    /**
     * THE COPY DECIDES THE BAND, SO THE COPY MUST BE WATCHED.
     *
     * The band is measured against `[data-hero-copy]`, and that block
     * changes height after the first measure: a webfont swaps, or the
     * headline rewraps. In Arabic it rewraps to a different number of lines
     * entirely, which measured as the mark sitting 149px lower than its
     * English counterpart and overlapping the eyebrow on a tall phone —
     * a stale band from before the text settled.
     *
     * Observing the block re-derives the band whenever it actually changes,
     * which covers font loading, a language switch and any reflow, without
     * polling for any of them.
     */
    /* THE LAST RACE IS FONT LOADING. The copy's height is what sets the
       band, and it changes the moment Cormorant and the Arabic face swap in
       — after first paint, and after `load` on a cold cache. This is the
       precise event for "the text has settled"; without it the band is
       derived from fallback-font metrics and the mark lands a little wrong,
       differently in each language. */
    if (document.fonts?.ready) void document.fonts.ready.then(remeasure);

    const copyObserver = copyEl ? new ResizeObserver(remeasure) : null;
    copyObserver?.observe(copyEl!);

    /**
     * ONE CLOCK, NOT TWO.
     *
     * Lenis owns the scroll position and writes it inside the GSAP ticker
     * (see SmoothScroll.tsx). This component used to run its OWN rAF and
     * read `window.scrollY`, so the two loops were never guaranteed to be
     * in the same frame: the mark was positioned from a scroll value that
     * could be one update stale. On a laptop the frames happen to line up
     * and it looks fine. On a phone — irregular momentum-scroll timing, a
     * toolbar resizing the viewport mid-gesture — the read lands mid-update
     * and the mark lags a frame, catches up, lags again. That is the shake.
     *
     * Subscribing to Lenis puts the mark on the same clock as the scroll it
     * is following. The window listener stays as the fallback for the
     * moments Lenis is not driving: before it finishes booting (it is
     * created on idle), and under prefers-reduced-motion, where it never
     * starts at all.
     */
    const onLenisScroll = ({ scroll }: { scroll: number }) => {
      scrollRef.current = scroll;
      apply();
    };
    if (lenis) lenis.on("scroll", onLenisScroll);

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    /* Rotating a handset changes the layout for real, and on iOS it does
       not always arrive as a width change in time. */
    window.addEventListener("orientationchange", remeasure);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      if (lenis) lenis.off("scroll", onLenisScroll);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      copyObserver?.disconnect();
      window.removeEventListener("load", remeasure);
      window.removeEventListener("orientationchange", remeasure);
      mark.style.removeProperty("--travel");
      mark.style.removeProperty("--travel-y");
      mark.style.removeProperty("--travel-shrink");
      mark.style.removeProperty("--travel-cream");
      delete mark.dataset.travelling;
    };
  }, [pathname, reduced, lenis]);

  return null;
}
