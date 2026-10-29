import { describe, expect, it } from "vitest";
import { accountMayHaveWelcome, emailIdentityKey, welcomeStillOpen } from "./welcome";

describe("emailIdentityKey", () => {
  it("lower-cases and trims", () => {
    expect(emailIdentityKey("  Layla@Example.COM ")).toBe("layla@example.com");
  });

  it("drops a +tag at any domain", () => {
    expect(emailIdentityKey("layla+flowers@example.com")).toBe("layla@example.com");
    expect(emailIdentityKey("nettt420+3@gmail.com")).toBe("nettt420@gmail.com");
  });

  it("drops dots at Gmail only", () => {
    expect(emailIdentityKey("ne.ttt.420@gmail.com")).toBe("nettt420@gmail.com");
    expect(emailIdentityKey("mr.nhatty@example.com")).toBe("mr.nhatty@example.com");
  });

  it("folds googlemail.com into gmail.com", () => {
    expect(emailIdentityKey("Ne.Ttt420+5@googlemail.com")).toBe("nettt420@gmail.com");
  });

  it("gives every spelling of one Gmail inbox the same key", () => {
    const spellings = ["nettt420@gmail.com", "n.e.t.t.t.420@gmail.com", "nettt420+3@gmail.com", "NETTT420@googlemail.com"];
    expect(new Set(spellings.map(emailIdentityKey)).size).toBe(1);
  });

  it("leaves something that is not an address as it is, lower-cased", () => {
    expect(emailIdentityKey("not-an-address")).toBe("not-an-address");
    expect(emailIdentityKey("@gmail.com")).toBe("@gmail.com");
    expect(emailIdentityKey("layla@")).toBe("layla@");
  });
});

describe("accountMayHaveWelcome", () => {
  const customer = { role: "customer", accountStatus: "active", emailConfirmedAt: "2026-10-30T09:00:00.000Z" };

  it("is a confirmed, active customer", () => {
    expect(accountMayHaveWelcome(customer)).toBe(true);
    expect(accountMayHaveWelcome({ ...customer, accountStatus: null })).toBe(true);
  });

  it("is never the team", () => {
    expect(accountMayHaveWelcome({ ...customer, role: "admin" })).toBe(false);
    expect(accountMayHaveWelcome({ ...customer, role: "staff" })).toBe(false);
  });

  it("needs a confirmed address: an account that works is not enough", () => {
    expect(accountMayHaveWelcome({ ...customer, emailConfirmedAt: null })).toBe(false);
    expect(accountMayHaveWelcome({ ...customer, emailConfirmedAt: undefined })).toBe(false);
  });

  it("is never a suspended, closed or anonymised account", () => {
    expect(accountMayHaveWelcome({ ...customer, accountStatus: "suspended" })).toBe(false);
    expect(accountMayHaveWelcome({ ...customer, accountStatus: "closed" })).toBe(false);
    expect(accountMayHaveWelcome({ ...customer, anonymisedAt: "2026-10-01T00:00:00.000Z" })).toBe(false);
  });

  it("is nobody when nobody is signed in", () => {
    expect(accountMayHaveWelcome(null)).toBe(false);
    expect(accountMayHaveWelcome(undefined)).toBe(false);
  });
});

describe("welcomeStillOpen", () => {
  it("is open before any paid order and any claim", () => {
    expect(welcomeStillOpen({ paidOrders: 0, claims: 0 })).toBe(true);
  });

  it("closes after a paid order, gift or not", () => {
    expect(welcomeStillOpen({ paidOrders: 1, claims: 0 })).toBe(false);
  });

  it("closes while an order holds the gift", () => {
    expect(welcomeStillOpen({ paidOrders: 0, claims: 1 })).toBe(false);
  });
});
