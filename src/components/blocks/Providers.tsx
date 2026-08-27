"use client";

import { CartProvider } from "@/lib/cart";
import { ToastProvider } from "@/lib/toast";
import { WishlistProvider } from "@/lib/wishlist";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <WishlistProvider>
        <ToastProvider>{children}</ToastProvider>
      </WishlistProvider>
    </CartProvider>
  );
}
