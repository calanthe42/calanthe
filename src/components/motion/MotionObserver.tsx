"use client";

import { useEffect } from "react";

/**
 * The single engine behind every scroll reveal: elements marked
 * [data-io] get the class `io-in` once they cross 80% of the viewport
 * (see brand/motion-spec.md); CSS does the rest. A MutationObserver
 * catches nodes added by client-side navigation and lazy sections.
 * Rendering stays 100% server-side — this is the only JavaScript.
 */
export function MotionObserver() {
  useEffect(() => {
    /* Without JS nothing must ever be hidden — hidden states are gated
       on this class. */
    document.documentElement.classList.add("js");

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("io-in");
            io.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -20% 0px", threshold: 0 },
    );

    const observe = (root: ParentNode) => {
      root.querySelectorAll("[data-io]:not(.io-in)").forEach((el) => io.observe(el));
    };
    observe(document);

    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((node) => {
          if (node instanceof Element) {
            if (node.hasAttribute("data-io")) io.observe(node);
            observe(node);
          }
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      mo.disconnect();
      io.disconnect();
    };
  }, []);

  return null;
}
