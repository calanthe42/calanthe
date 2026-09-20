"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useLenisInstance } from "@/lib/lenis-context";
import { useReducedMotionPref } from "@/lib/useReducedMotionPref";

/**
 * ONE MARK, TRAVELLING — the hero's brand lockup and the navbar's are the
 * same physical object, and scrolling moves it between the two.
 *
 * THE STRUCTURE. There is exactly one lockup in the header, and it lives in
 * the header's centre slot permanently. On the homepage it is TRANSFORMED
 * down onto the hero while the page is at the top, and the transform
 * relaxes to identity as you scroll. Docked is the element's natural
 * position, so there is no target to miss; position is a pure function of
 * scroll, so scrolling back up runs the journey backwards exactly.
 *
 * WHAT THIS VERSION STOPS DOING. Every previous version computed where the
 * mark should sit in the hero: header height plus padding plus half of
 * whatever was left after the copy block took its share, clamped at both
 * ends, re-measured on load, on fonts, on resize and by observers. Four
 * separately measured boxes, each able to settle at a different moment —
 * and on a real phone, in Arabic, they did. Measured on both engines at ten
 * viewports the same code put the mark on the headline in one run and
 * behind the header in the next.
 *
 * NOW THE BROWSER LAYS OUT THE DESTINATION. Hero.tsx carries a real copy of
 * the lockup in a flex slot that fills the band between header and copy
 * (`.hero-mark-slot` in globals.css). CSS centres it and sizes it to fit.
 * This driver reads THAT ONE BOX and puts the header's mark exactly on it.
 * There is nothing to sum and nothing to clamp: if the copy grows, the slot
 * shrinks, the artwork shrinks with it, and the next measurement is right
 * because the layout is.
 *
 * AND THE FIRST PAINT IS ALREADY CORRECT. Until this runs, the hero's copy
 * is what the visitor sees — composed by CSS, no JavaScript needed — and
 * the header's mark is hidden (`data-pending`). On Safari that can be
 * several seconds. The old approach server-rendered the header's mark in a
 * half-state (travelling attribute, no numbers), which CSS resolved to hero
 * size at the navbar: a 330px lockup cropped behind the header, for exactly
 * as long as hydration took. That was the fault seen on a real iPhone, and
 * no amount of measuring after the fact could have fixed it.
 *
 * Transform and opacity only, written to custom properties from the same
 * clock that moves the page (Lenis, when it is driving), so the compositor
 * does the work.
 */

/** How much scrolling completes the journey, as a fraction of the hero. */
const TRAVEL = 0.42;

/**
 * Under this artwork width the mark does not travel at all.
 *
 * `.hero-mark-slot`'s container query hides the placeholder below 72px of
 * artwork, and this reads that decision back: a slot too short to hold a
 * lockup worth showing leaves the header's mark docked. That is a
 * deliberate state — on a 553px screen the crisp mark in the bar says more
 * than a 40px one floating over the photograph.
 */
const MIN_MARK = 1;

export function HeroMarkTravel() {
  const pathname = usePathname();
  const reduced = useReducedMotionPref();
  const lenis = useLenisInstance();

  useEffect(() => {
    const mark = document.querySelector<HTMLElement>("[data-travel-mark]");
    if (!mark) return;

    /* Whatever happens next, the header's mark is ours to show now: docked
       by default, which is correct on every route and under reduced
       motion. Only a driven homepage changes it from here. */
    delete mark.dataset.pending;

    const artwork = mark.querySelector<HTMLElement>(".stacked-logo");

    /* Under reduced motion the hero keeps its own copy of the mark and the
       navbar keeps its own: two still marks, no journey. Simple fades only. */
    if (pathname !== "/" || reduced || !artwork) return;

    /*
     * NOTHING IN THE HERO IS HELD ACROSS A FRAME.
     *
     * Hero is an async server component, so it is STREAMED: its markup
     * arrives in a later chunk and React moves those nodes into place,
     * discarding whatever stood there before. An element captured before
     * that moment is detached for the rest of the page's life — and a
     * detached element measures zero wide, which this driver read as "the
     * slot is too short to be worth a journey", cleared the transform, and
     * never reconsidered, because the ResizeObserver it was waiting on was
     * watching the orphan too. That was the mark stuck in the navbar: the
     * effect and the stream racing, with no way back when the effect won.
     *
     * So the hero's parts are resolved fresh at every measurement, and the
     * observers follow whichever nodes are in the document right now.
     */
    type Parts = { hero: HTMLElement; slot: HTMLElement; art: HTMLElement; row: HTMLElement };
    const resolve = (): Parts | null => {
      const hero = document.querySelector<HTMLElement>("[data-hero-root]");
      const slot = hero?.querySelector<HTMLElement>("[data-hero-mark-slot]") ?? null;
      const art = hero?.querySelector<HTMLElement>("[data-hero-mark-art]") ?? null;
      /* The link is absolutely positioned inside the navbar row; the row is
         what we read each frame to know where "docked" is right now. */
      const row = mark.offsetParent as HTMLElement | null;
      return hero && slot && art && row ? { hero, slot, art, row } : null;
    };

    let parts: Parts | null = null;
    let frame = 0;
    /* Null until Lenis reports a position; `apply` then prefers it. */
    const scrollRef: { current: number | null } = { current: null };

    /* Where the mark stands in the hero, in PAGE coordinates, and how big. */
    let heroCX = 0;
    let heroCY = 0;
    let heroShrink = 1;
    let dockShrink = 0.25;
    let distance = 1;
    let tooShort = true;

    const clearDriven = () => {
      delete mark.dataset.travelling;
      if (parts) delete parts.hero.dataset.markLive;
      mark.style.removeProperty("--travel-x");
      mark.style.removeProperty("--travel-y");
      mark.style.removeProperty("--travel-shrink");
      mark.style.removeProperty("--travel-cream");
    };

    const observer = new ResizeObserver(() => remeasure());
    let watchedSlot: Element | null = null;
    let watchedArt: Element | null = null;
    /* Re-point the size observer when the stream hands us new nodes. */
    const watch = (p: Parts) => {
      if (p.slot === watchedSlot && p.art === watchedArt) return;
      observer.disconnect();
      observer.observe(p.slot);
      observer.observe(p.art);
      watchedSlot = p.slot;
      watchedArt = p.art;
    };

    /**
     * ONE BOX. The placeholder's rect is the whole answer: its centre is
     * where the mark goes, its width is how large the mark is there.
     */
    const measure = () => {
      const p = resolve();
      parts = p;

      if (!p) {
        /* The hero's chunk has not landed yet. Docked is the honest thing
           to show meanwhile, and the mutation observer below brings us
           straight back when its nodes appear. */
        tooShort = true;
        clearDriven();
        return;
      }

      /* Before the read, so a slot that is merely late is still watched and
         can call us back once it has a size. */
      watch(p);

      const a = p.art.getBoundingClientRect();
      tooShort = a.width < MIN_MARK;

      if (tooShort) {
        clearDriven();
        return;
      }

      /* The header's artwork is laid out at the hero width only while the
         driven rules apply, so the attribute goes on before the read. */
      mark.dataset.travelling ??= "true";
      p.hero.dataset.markLive = "";

      const y = scrollRef.current ?? window.scrollY;
      heroCX = a.left + a.width / 2;
      heroCY = a.top + a.height / 2 + y;

      /* `offsetWidth` is the untransformed layout width — the size the
         artwork is rasterised at. Both ends of the journey are expressed as
         a fraction of it, so it is only ever scaled down. */
      const layoutW = artwork.offsetWidth || a.width;
      heroShrink = a.width / layoutW;
      dockShrink = mark.offsetWidth / layoutW;

      distance = Math.max(1, p.hero.getBoundingClientRect().height * TRAVEL);
    };

    const apply = () => {
      frame = 0;
      if (tooShort || !parts) return;

      /* `scrollRef.current` rather than `window.scrollY`: while Lenis is
         driving, the authoritative position is the one it just wrote in the
         GSAP ticker. Reading the window would run this off a second clock,
         one frame behind — which on a phone is the shake. */
      const y = scrollRef.current ?? window.scrollY;
      const progress = Math.min(1, Math.max(0, y / distance));
      const eased = progress * progress * (3 - 2 * progress); // smoothstep

      let dx = 0;
      let dy = 0;
      if (eased < 1) {
        /*
         * WHERE "DOCKED" IS RIGHT NOW, not where it was at rest.
         *
         * The header is sticky, and the service strip above the navbar row
         * scrolls away during the first few dozen pixels — so the row, and
         * the docked mark with it, moves while the journey is under way. A
         * docked centre measured once at the top is wrong by the strip's
         * height for the rest of the journey; the earlier version measured
         * it once and hoped. Reading the row each frame costs one layout
         * read while the mark is travelling and nothing once it has landed.
         *
         * `offsetLeft`/`offsetTop` are the link's UNTRANSFORMED position —
         * `left: 50%; top: 50%` — which is its centre once the base
         * `translate(-50%, -50%)` is applied. Reading the link's own rect
         * would include the travel transform we are about to set.
         */
        const r = parts.row.getBoundingClientRect();
        const navCX = r.left + mark.offsetLeft;
        const navCY = r.top + mark.offsetTop;
        dx = (1 - eased) * (heroCX - navCX);
        dy = (1 - eased) * (heroCY - y - navCY);
      }

      /* Whole pixels: the transform is on a compositor layer and a
         fractional translate leaves the artwork straddling a pixel
         boundary, resampled every frame — the shimmer. */
      mark.style.setProperty("--travel-x", `${Math.round(dx)}px`);
      mark.style.setProperty("--travel-y", `${Math.round(dy)}px`);
      mark.style.setProperty(
        "--travel-shrink",
        String(heroShrink + eased * (dockShrink - heroShrink)),
      );
      /* Cream nearly the whole way, olive only as it lands — olive on a
         dark bouquet is invisible, and read as the mark ghosting out. */
      mark.style.setProperty(
        "--travel-cream",
        String(1 - Math.max(0, (eased - 0.86) / 0.14)),
      );
      /* While it is out over the hero it is decoration, not a target: a
         hero-sized link must not swallow taps meant for the photograph. */
      mark.dataset.travelling = eased < 0.98 ? "true" : "false";
    };

    /* Declared, not assigned: the ResizeObserver above is created before
       this point and calls it only later, once the page is running. */
    function remeasure() {
      measure();
      apply();
    }

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(apply);
    };

    /* A phone fires `resize` constantly while scrolling as its address bar
       collapses. The hero is `svh`-sized and the slot with it, so height
       alone changes nothing here; width or orientation does. */
    let lastWidth = window.innerWidth;
    const onResize = () => {
      if (window.innerWidth === lastWidth) return;
      lastWidth = window.innerWidth;
      remeasure();
    };

    /* First measure and first frame together, synchronously: the hero's
       copy is hidden and the header's mark lands on its box in the same
       paint. Nothing is ever on screen twice or not at all. */
    remeasure();

    /* THE STREAM LANDING. While the nodes being driven are still in the
       document this costs one property read per batch and does nothing;
       when they are replaced — or when they finally arrive — it is the
       signal to pick up the live ones. */
    const swaps = new MutationObserver(() => {
      if (parts && parts.art.isConnected && parts.slot.isConnected) return;
      remeasure();
    });
    swaps.observe(document.body, { childList: true, subtree: true });

    if (document.readyState !== "complete") {
      window.addEventListener("load", remeasure, { once: true });
    }
    if (document.fonts?.ready) void document.fonts.ready.then(remeasure);

    /* ONE CLOCK. Lenis owns the scroll position and writes it inside the
       GSAP ticker; subscribing puts the mark on the same clock as the page.
       The window listener covers the moments Lenis is not driving — before
       it finishes booting, and where it never starts. */
    const onLenisScroll = ({ scroll }: { scroll: number }) => {
      scrollRef.current = scroll;
      apply();
    };
    if (lenis) lenis.on("scroll", onLenisScroll);

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", remeasure);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      if (lenis) lenis.off("scroll", onLenisScroll);
      observer.disconnect();
      swaps.disconnect();
      window.removeEventListener("load", remeasure);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", remeasure);
      clearDriven();
    };
  }, [pathname, reduced, lenis]);

  return null;
}
