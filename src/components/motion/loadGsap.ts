/**
 * GSAP + ScrollTrigger, loaded on demand and shared.
 *
 * A top-level `import gsap` in Parallax put both libraries (~37 KB gzip) into
 * the home page's initial bundle, though every effect that uses them runs
 * after hydration and most are desktop-only. The modules resolve once and are
 * reused by every caller.
 */
type Gsap = typeof import("gsap").gsap;
type Trigger = typeof import("gsap/ScrollTrigger").ScrollTrigger;

let loading: Promise<{ gsap: Gsap; ScrollTrigger: Trigger }> | null = null;

export function loadGsap() {
  loading ??= Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(
    ([{ gsap }, { ScrollTrigger }]) => {
      gsap.registerPlugin(ScrollTrigger);
      return { gsap, ScrollTrigger };
    },
  );
  return loading;
}
