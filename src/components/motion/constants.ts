/** Motion laws — see brand/motion-spec.md. */

/** cubic-bezier(0.22, 1, 0.36, 1) — everything blooms, nothing bounces. */
export const EASE_BLOOM = [0.22, 1, 0.36, 1] as const;

/** Reveals fire once, when the element crosses 80% of viewport height. */
export const VIEWPORT_ONCE = { once: true, margin: "0px 0px -20% 0px" } as const;

export const DUR_MICRO = 0.2;
export const DUR_REVEAL = 0.7;
export const DUR_CLIP = 0.9;

/** 80ms between staggered children. */
export const STAGGER_STEP = 0.08;
