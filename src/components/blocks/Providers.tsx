"use client";

import { CartProvider } from "@/lib/cart";
import type { Product } from "@/lib/data";
import { LocaleProvider } from "@/lib/locale";
import type { Locale } from "@/lib/i18n/dictionary";
import { ToastProvider } from "@/lib/toast";
import type { WelcomeGift } from "@/lib/welcome-offer";
import { WishlistProvider } from "@/lib/wishlist";

export function Providers({
  children,
  catalogue = [],
  locale = "en",
  welcome = null,
}: {
  children: React.ReactNode;
  catalogue?: readonly Product[];
  /* Read from the cookie on the server so the first render is already in
     the visitor's language (lib/locale.tsx). */
  locale?: Locale;
  /* The welcome gift, when it is this signed-in customer's (backend/data/welcome.ts). */
  welcome?: WelcomeGift | null;
}) {
  return (
    <LocaleProvider initialLocale={locale}>
      <CartProvider catalogue={catalogue} welcome={welcome}>
        <WishlistProvider>
          <ToastProvider>{children}</ToastProvider>
        </WishlistProvider>
      </CartProvider>
    </LocaleProvider>
  );
}
