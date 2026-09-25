import type { MessageKey } from "@admin/i18n/translate";
import type { IconName } from "@admin/ui/icons";

/**
 * The admin's navigation, grouped by what the owner is doing — not by
 * database collection, which is the whole difference between this and a CMS.
 *
 * EVERY ITEM HERE IS A WORKING SCREEN. Sections that exist in the business's
 * vocabulary but have no screen yet (discounts, delivery settings,
 * memberships, campaigns, settings) are deliberately absent rather than
 * listed behind a "Soon" badge: a navigation item that leads to an apology is
 * worse than one the owner never sees. They return here, each in one line,
 * when the screen behind them is real.
 *
 * Staff is shown to everyone, not only to the owner. A staff member opening
 * it sees a short panel telling her the owner manages accounts and can get
 * her back in — which is the answer to the question she came with. Hiding the
 * item would leave her with nowhere to look.
 */

export type NavItem = { href: string; label: MessageKey; icon: IconName };
export type NavGroup = { heading: MessageKey; items: readonly NavItem[] };

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    heading: "nav.sections.overview",
    items: [{ href: "/admin", label: "nav.dashboard", icon: "dashboard" }],
  },
  {
    heading: "nav.sections.catalog",
    items: [
      { href: "/admin/products", label: "nav.products", icon: "flower" },
      { href: "/admin/occasions", label: "nav.occasions", icon: "occasion" },
      { href: "/admin/media", label: "nav.media", icon: "image" },
    ],
  },
  {
    heading: "nav.sections.sales",
    items: [
      { href: "/admin/orders", label: "nav.orders", icon: "bag" },
      { href: "/admin/customers", label: "nav.customers", icon: "users" },
      { href: "/admin/enquiries", label: "nav.enquiries", icon: "message" },
      { href: "/admin/emails", label: "nav.emails", icon: "message" },
    ],
  },
  {
    heading: "nav.sections.operations",
    items: [{ href: "/admin/events", label: "nav.events", icon: "sparkles" }],
  },
  {
    heading: "nav.sections.system",
    items: [{ href: "/admin/team", label: "nav.staff", icon: "staff" }],
  },
];

export function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}
