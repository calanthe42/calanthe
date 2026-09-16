"use client";

import { CartProvider } from "@/lib/cart";
import type { Product } from "@/lib/data";
import { LocaleProvider } from "@/lib/locale";
import type { Locale } from "@/lib/i18n/dictionary";
import { ToastProvider } from "@/lib/toast";
import { WishlistProvider } from "@/lib/wishlist";

export function Providers({
  children,
  catalogue = [],
  locale = "en",
}: {
  children: React.ReactNode;
  catalogue?: readonly Product[];
  /* Read from the cookie on the server so the first render is already in
     the visitor's language (lib/locale.tsx). */
  locale?: Locale;
}) {
  return (
    <LocaleProvider initialLocale={locale}>
      <CartProvider catalogue={catalogue}>
        <WishlistProvider>
          <ToastProvider>{children}</ToastProvider>
        </WishlistProvider>
      </CartProvider>
    </LocaleProvider>
  );
}
