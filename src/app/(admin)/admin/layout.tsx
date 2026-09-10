import type { Metadata } from "next";
import { Cinzel, Cormorant_Garamond, Instrument_Sans } from "next/font/google";
import "../admin.css";

/**
 * The HTML shell for everything under /admin — the sign-in screen and the
 * application alike.
 *
 * A third root layout alongside (frontend) and (payload): the admin needs its
 * own stylesheet and none of the storefront's editorial chrome — no
 * announcement bar, no film grain, no smooth-scroll.
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

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${cinzel.variable} ${cormorant.variable} ${instrument.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
