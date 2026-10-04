"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart";

const loadDrawer = () => import("@/components/commerce/CartDrawer");

/**
 * The cart drawer, mounted the first time the cart opens.
 *
 * It was mounted (and its animation library downloaded, ~42 KB gzip) on every
 * page right after hydration, though most visitors never open the cart.
 * Now nothing loads until it is needed; `prefetchCartDrawer` starts the
 * download the moment a finger touches the bag or the add-to-cart button, so
 * the first open still feels instant, and the slide-in still plays.
 */
const CartDrawer = dynamic(() => loadDrawer().then((m) => m.CartDrawer), { ssr: false });

export function prefetchCartDrawer() {
  void loadDrawer();
}

export function LazyCartDrawer() {
  const { isOpen } = useCart();
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (isOpen) setArmed(true);
  }, [isOpen]);
  return armed ? <CartDrawer /> : null;
}
