import { describe, expect, it, vi } from "vitest";

/* admin-pulse.ts imports the Payload config, which reads the environment at
   import. `mergePulse` is pure and needs neither. */
vi.mock("@payload-config", () => ({ default: {} }));

import type { Enquiry, Order } from "@/payload-types";
import { mergePulse } from "./admin-pulse";

/**
 * What rings the admin's bell, and when.
 *
 * A payment request must NOT ring as a "new order" when the florist creates
 * it, and MUST ring as a payment when the customer pays.
 */

const order = (overrides: Partial<Order>): Order =>
  ({
    id: 1,
    orderNumber: "CAL-000001",
    customerName: "Layla Ahmed",
    totalFils: 48000,
    source: "web-checkout-card",
    createdAt: "2026-10-04T08:00:00.000Z",
    updatedAt: "2026-10-04T08:00:00.000Z",
    ...overrides,
  }) as Order;

const enquiry = (overrides: Partial<Enquiry>): Enquiry =>
  ({
    id: 45,
    subject: "Build your own — AED 500",
    contactName: "Noor",
    createdAt: "2026-10-04T07:00:00.000Z",
    ...overrides,
  }) as Enquiry;

const quote = (overrides: Partial<Order>): Order =>
  order({ id: 12, orderNumber: "CAL-000012", source: "admin-quote", totalFils: 65000, ...overrides });

describe("mergePulse", () => {
  it("never announces a payment request as a new order", () => {
    const unpaid = quote({ createdAt: "2026-10-04T09:00:00.000Z", paidAt: null });
    /* Even if the query's filter were to let one through. */
    const { recent, fresh } = mergePulse([order({}), unpaid], [], [], new Date("2026-10-04T00:00:00.000Z"));
    expect(recent.map((item) => item.title)).toEqual(["CAL-000001"]);
    expect(fresh.map((item) => item.kind)).toEqual(["order"]);
  });

  it("announces it as a PAYMENT when the customer pays, at the time they paid", () => {
    const paid = quote({ createdAt: "2026-10-01T09:00:00.000Z", paidAt: "2026-10-04T09:30:00.000Z" });
    const { recent, fresh } = mergePulse([], [paid], [], new Date("2026-10-04T09:00:00.000Z"));
    expect(recent).toHaveLength(1);
    expect(recent[0]).toMatchObject({
      kind: "payment",
      title: "CAL-000012",
      detail: "Layla Ahmed",
      amountFils: 65000,
      at: "2026-10-04T09:30:00.000Z",
      href: "/admin/orders/CAL-000012",
    });
    /* Created three days ago, but FRESH: it was paid after the reader last looked. */
    expect(fresh).toHaveLength(1);
  });

  it("does not ring again for a payment the reader has already seen", () => {
    const paid = quote({ paidAt: "2026-10-04T09:30:00.000Z" });
    expect(mergePulse([], [paid], [], new Date("2026-10-04T10:00:00.000Z")).fresh).toEqual([]);
  });

  it("ignores a row in the paid list that is not a paid payment request", () => {
    const { recent } = mergePulse([], [quote({ paidAt: null }), order({ paidAt: "2026-10-04T09:30:00.000Z" })], [], null);
    expect(recent).toEqual([]);
  });

  it("merges orders, payments and enquiries newest first, comparing instants", () => {
    const { recent } = mergePulse(
      [order({ createdAt: "2026-10-04T08:00:00.000Z" })],
      /* The database's spelling of a timestamp, not Payload's. */
      [quote({ paidAt: "2026-10-04T12:30:00+04:00" })],
      [enquiry({ createdAt: "2026-10-04T09:00:00.000Z" })],
      null,
    );
    expect(recent.map((item) => item.kind)).toEqual(["enquiry", "payment", "order"]);
  });

  it("keeps the panel to its limit and is empty of `fresh` on a first load", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      order({ id: i + 1, orderNumber: `CAL-${i}`, createdAt: `2026-10-04T08:${String(i).padStart(2, "0")}:00.000Z` }),
    );
    const { recent, fresh } = mergePulse(many, [], [], null);
    expect(recent).toHaveLength(8);
    expect(fresh).toEqual([]);
  });
});
