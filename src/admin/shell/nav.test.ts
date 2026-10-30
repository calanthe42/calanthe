import { describe, expect, it } from "vitest";
import { NAV_GROUPS, activeHref, visibleGroups } from "./nav";

const hrefs = (isOwner: boolean) => visibleGroups(isOwner).flatMap((group) => group.items.map((item) => item.href));

describe("navigation", () => {
  it("marks one item only, the most specific", () => {
    const all = hrefs(true);
    expect(activeHref("/admin/costs", all)).toBe("/admin/costs");
    expect(activeHref("/admin/costs/buy/12", all)).toBe("/admin/costs/buy");
    expect(activeHref("/admin/costs/invoices/new", all)).toBe("/admin/costs/invoices/new");
    expect(activeHref("/admin/costs/invoices/7", all)).toBe("/admin/costs/invoices");
    /* The customers' invoices are not the suppliers'. */
    expect(activeHref("/admin/invoices", all)).toBe("/admin/invoices");
    expect(activeHref("/admin", all)).toBe("/admin");
    expect(activeHref("/admin/orders/5", all)).toBe("/admin/orders");
  });

  it("hides every cost screen from staff", () => {
    const costs = NAV_GROUPS.find((group) => group.heading === "nav.sections.costs");
    expect(costs?.items.map((item) => item.href)).toEqual([
      "/admin/costs",
      "/admin/costs/invoices/new",
      "/admin/costs/invoices",
      "/admin/costs/buy",
    ]);
    expect(costs?.items.every((item) => item.ownerOnly)).toBe(true);
    expect(hrefs(false).some((href) => href.startsWith("/admin/costs"))).toBe(false);
  });
});
