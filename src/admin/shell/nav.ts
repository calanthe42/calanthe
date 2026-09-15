import type { MessageKey } from "@admin/i18n/translate";
import type { IconName } from "@admin/ui/icons";

/**
 * The admin's navigation, grouped by what the owner is doing — not by
 * database collection, which is the whole difference between this and a CMS.
 *
 * `soon` marks a section that exists in the business's vocabulary but has no
 * working screen yet. It is shown, labelled honestly, and opens a page that
 * says so. No route is invented here: every href is a real page.
 */

export type NavItem = { href: string; label: MessageKey; icon: IconName; soon?: boolean };
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
      { href: "/admin/discounts", label: "nav.discounts", icon: "tag", soon: true },
    ],
  },
  {
    heading: "nav.sections.sales",
    items: [
      { href: "/admin/orders", label: "nav.orders", icon: "bag" },
      { href: "/admin/customers", label: "nav.customers", icon: "users" },
      { href: "/admin/enquiries", label: "nav.enquiries", icon: "message" },
    ],
  },
  {
    heading: "nav.sections.operations",
    items: [
      { href: "/admin/events", label: "nav.events", icon: "sparkles" },
      { href: "/admin/delivery", label: "nav.delivery", icon: "truck", soon: true },
      { href: "/admin/memberships", label: "nav.memberships", icon: "star", soon: true },
    ],
  },
  {
    heading: "nav.sections.marketing",
    items: [{ href: "/admin/marketing", label: "nav.campaigns", icon: "megaphone", soon: true }],
  },
  {
    heading: "nav.sections.system",
    items: [
      { href: "/admin/staff", label: "nav.staff", icon: "staff", soon: true },
      { href: "/admin/settings", label: "nav.settings", icon: "settings", soon: true },
    ],
  },
];

export function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}
