"use client";

import { useEffect } from "react";

/**
 * The single engine behind every scroll reveal: elements marked [data-io]
 * get the attribute `data-io-in` once they cross 80% of the viewport (see
 * brand/motion-spec.md); CSS does the rest. A MutationObserver catches nodes
 * added by client-side navigation and lazy sections. Rendering stays 100%
 * server-side — this is the only JavaScript.
 *
 * WHY IT WAITS FOR LOAD, AND WHY THAT IS THE WHOLE FIX.
 *
 * This ran immediately and marked whatever was already on screen. That
 * marking is a DOM mutation on an element React owns, and if it lands before
 * React finishes hydrating that subtree, React finds the DOM does not match
 * what it rendered and reports a hydration mismatch. It only ever affected
 * ABOVE-THE-FOLD reveals — which is why `/events` (headline in view) and
 * `/occasions` (tiles in view) failed while everything else was fine, and
 * why it looked intermittent.
 *
 * Moving the marker from `className` to a data attribute did not fix it;
 * React 19 checks for attributes it did not render too. The mutation itself
 * was the problem, not which attribute it wrote.
 *
 * So nothing is touched until the page has loaded and the main thread is
 * idle — comfortably after hydration. Crucially `html.js`, which is what
 * arms every hidden state in CSS, is added in that same callback. Until
 * then nothing is hidden, so content above the fold simply paints and
 * stays: no flash, no mismatch, and no scroll reveal on the part of the
 * page that was never scrolled to. That last point is what the brand's
 * motion spec asks for anyway — the LCP area is not supposed to animate in.
 */
export function MotionObserver() {
  useEffect(() => {
    let cancelled = false;
    let io: IntersectionObserver | undefined;
    let mo: MutationObserver | undefined;

    const start = () => {
      if (cancelled) return;

      /* Arms every hidden state in CSS. Deliberately here and not earlier:
         see the note above — hiding must not begin before hydration ends. */
      document.documentElement.classList.add("js");

      io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.setAttribute("data-io-in", "");
              io?.unobserve(entry.target);
            }
          }
        },
        { rootMargin: "0px 0px -20% 0px", threshold: 0 },
      );

      const observe = (root: ParentNode) => {
        root
          .querySelectorAll("[data-io]:not([data-io-in])")
          .forEach((el) => io?.observe(el));
      };
      observe(document);

      mo = new MutationObserver((mutations) => {
        for (const m of mutations) {
          m.addedNodes.forEach((node) => {
            if (node instanceof Element) {
              if (node.hasAttribute("data-io")) io?.observe(node);
              observe(node);
            }
          });
        }
      });
      mo.observe(document.body, { childList: true, subtree: true });
    };

    const schedule = () => {
      const idle = (
        window as Window & {
          requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
        }
      ).requestIdleCallback;
      if (idle) idle(start, { timeout: 400 });
      else setTimeout(start, 120);
    };

    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("load", schedule);
      mo?.disconnect();
      io?.disconnect();
    };
  }, []);

  return null;
}
