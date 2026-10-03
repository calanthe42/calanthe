"use client";

import { useEffect } from "react";
import { useCart } from "@/lib/cart";

/** Empties the basket once a redirected payment has come back paid. */
export function ClearCart() {
  const { clear, hydrated } = useCart();
  useEffect(() => {
    if (hydrated) clear();
  }, [hydrated, clear]);
  return null;
}
