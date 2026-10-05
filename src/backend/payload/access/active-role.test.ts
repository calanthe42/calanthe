import { describe, expect, it } from "vitest";
import { activeRole, isAdmin, isAdminField, isStaff, isStaffField } from "./index";
import { guardPaymentStatus, PAYMENT_PROVIDER_CONTEXT } from "@backend/payload/hooks/orderIntegrity";

const req = (user: unknown) => ({ req: { user } }) as never;

describe("a suspended or closed account holds no rights", () => {
  it("reads the role of an active account, and of an old row with no status", () => {
    expect(activeRole({ role: "admin", accountStatus: "active" })).toBe("admin");
    expect(activeRole({ role: "staff" })).toBe("staff");
    expect(activeRole({ role: "admin", accountStatus: null })).toBe("admin");
    expect(activeRole(null)).toBeUndefined();
  });

  it("gives a suspended or closed account no role at all", () => {
    expect(activeRole({ role: "admin", accountStatus: "suspended" })).toBeUndefined();
    expect(activeRole({ role: "staff", accountStatus: "closed" })).toBeUndefined();
  });

  it("is what every access rule asks, so a cookie that is still valid opens nothing", () => {
    const suspendedOwner = { id: 1, role: "admin", accountStatus: "suspended" };
    const suspendedStaff = { id: 2, role: "staff", accountStatus: "suspended" };
    for (const rule of [isAdmin, isStaff, isAdminField, isStaffField]) {
      expect(rule(req(suspendedOwner))).toBe(false);
      expect(rule(req(suspendedStaff))).toBe(false);
    }
    expect(isAdmin(req({ id: 1, role: "admin", accountStatus: "active" }))).toBe(true);
    expect(isStaff(req({ id: 2, role: "staff", accountStatus: "active" }))).toBe(true);
    expect(isAdmin(req({ id: 2, role: "staff", accountStatus: "active" }))).toBe(false);
  });
});

describe("an order is never born paid", () => {
  const create = (data: Record<string, unknown>, context: Record<string, unknown> = {}) => () =>
    guardPaymentStatus({ context, data, operation: "create" } as never);

  it("accepts a new order that is pending, or says nothing about payment", () => {
    expect(create({ paymentStatus: "PENDING" })).not.toThrow();
    expect(create({})).not.toThrow();
  });

  it("refuses to create one as paid, refunded or anything else — whoever asks", () => {
    for (const status of ["PAID", "REFUNDED", "PARTIALLY_REFUNDED", "AUTHORIZED", "FAILED"]) {
      expect(create({ paymentStatus: status, source: "web-checkout-card" })).toThrow(/cannot be created as/);
    }
  });

  it("leaves the payment provider's own path alone", () => {
    expect(create({ paymentStatus: "PAID" }, { [PAYMENT_PROVIDER_CONTEXT]: true })).not.toThrow();
  });
});
