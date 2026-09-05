"use client";

import { CartProvider } from "@/lib/cart";
import { LocaleProvider } from "@/lib/locale";
import { ToastProvider } from "@/lib/toast";
import { WishlistProvider } from "@/lib/wishlist";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      <CartProvider>
      <WishlistProvider>
        <ToastProvider>{children}</ToastProvider>
      </WishlistProvider>
      </CartProvider>
    </LocaleProvider>
  );
}
