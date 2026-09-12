import type { Metadata } from "next";
import {
  Cinzel,
  Cormorant_Garamond,
  IBM_Plex_Sans_Arabic,
  Instrument_Sans,
} from "next/font/google";
import { AdminI18nProvider } from "@admin/i18n/client";
import { getAdminPreferences, messagesFor } from "@admin/i18n/server";
import { ToastProvider } from "@admin/ui/Toast";
import "../admin.css";

/**
 * The HTML shell for everything under /admin — the sign-in screen and the
 * application alike.
 *
 * A third root layout alongside (frontend) and (payload): the admin needs its
 * own stylesheet and none of the storefront's editorial chrome — no
 * announcement bar, no film grain, no smooth-scroll.
 *
 * LANGUAGE, DIRECTION AND THEME ARE DECIDED HERE, ON THE SERVER, from the
 * person's cookies. <html lang dir data-theme> is correct in the very first
 * byte of HTML, so Arabic never flashes left-to-right and dark mode never
 * flashes cream.
 *
 * THERE IS NO AUTH GATE HERE, deliberately. The gate lives one level down in
 * (panel)/layout.tsx, which wraps every business screen. It cannot live here,
 * because /admin/login is also under this shell and a gate that redirects the
 * sign-in page to itself is a loop. Route groups keep the URLs unchanged.
 */

export const metadata: Metadata = {
  title: { default: "Calanthe Admin", template: "%s · Calanthe Admin" },
  robots: { index: false, follow: false },
};

/* Session- and preference-dependent: never statically rendered. */
export const dynamic = "force-dynamic";

const cinzel = Cinzel({ variable: "--font-cinzel", subsets: ["latin"], display: "swap" });
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});
const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
  display: "swap",
});
/* Arabic glyphs. Its @font-face is limited to the Arabic Unicode range, so the
   browser only downloads it when Arabic text is actually on the page. */
const arabic = IBM_Plex_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export default async function AdminRootLayout({ children }: { children: React.ReactNode }) {
  const { locale, dir, theme } = await getAdminPreferences();

  return (
    /* suppressHydrationWarning: the language and theme switches update these
       attributes immediately, a moment before the server re-render confirms. */
    <html lang={locale} dir={dir} data-theme={theme} suppressHydrationWarning>
      <body
        className={`${cinzel.variable} ${cormorant.variable} ${instrument.variable} ${arabic.variable} admin-root antialiased`}
      >
        <AdminI18nProvider locale={locale} messages={messagesFor(locale)}>
          <ToastProvider>{children}</ToastProvider>
        </AdminI18nProvider>
      </body>
    </html>
  );
}
