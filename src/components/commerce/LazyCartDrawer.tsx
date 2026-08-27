"use client";

import dynamic from "next/dynamic";

/* Overlay-only UI — nothing to server-render; keep it out of the
   critical hydration path. */
export const LazyCartDrawer = dynamic(
  () => import("@/components/commerce/CartDrawer").then((m) => m.CartDrawer),
  { ssr: false },
);
