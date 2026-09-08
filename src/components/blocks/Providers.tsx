"use client";

import { CartProvider } from "@/lib/cart";
import type { Product } from "@/lib/data";
import { LocaleProvider } from "@/lib/locale";
import { ToastProvider } from "@/lib/toast";
import { WishlistProvider } from "@/lib/wishlist";

export function Providers({
  children,
  catalogue = [],
}: {
  children: React.ReactNode;
  catalogue?: readonly Product[];
}) {
  return (
    <LocaleProvider>
      <CartProvider catalogue={catalogue}>
      <WishlistProvider>
        <ToastProvider>{children}</ToastProvider>
      </WishlistProvider>
      </CartProvider>
    </LocaleProvider>
  );
}
