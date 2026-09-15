import { describe, expect, it } from "vitest";
import {
  checkoutFieldErrors,
  isValidEmail,
  isValidPhone,
  normalisePhone,
  type CheckoutFieldValues,
} from "./checkout-fields";

const complete: CheckoutFieldValues = {
  mode: "gift",
  recipientName: "Layla",
  recipientPhone: "",
  zoneId: "dubai",
  name: "Sara",
  phone: "050 123 4567",
  email: "sara@example.com",
  address: "Villa 12, Al Wasl",
};

describe("normalisePhone", () => {
  it("accepts the ways UAE numbers are usually written", () => {
    expect(normalisePhone("050 123 4567")).toBe("+971501234567");
    expect(normalisePhone("050-123-4567")).toBe("+971501234567");
    expect(normalisePhone("00971 50 123 4567")).toBe("+971501234567");
    expect(normalisePhone("971501234567")).toBe("+971501234567");
    expect(normalisePhone("04 123 4567")).toBe("+97141234567");
  });

  it("leaves international numbers and blanks alone", () => {
    expect(normalisePhone("+44 7700 900123")).toBe("+447700900123");
    expect(normalisePhone("   ")).toBe("");
  });

  it("validates against the server's international format", () => {
    expect(isValidPhone("050 123 4567")).toBe(true);
    expect(isValidPhone("12345")).toBe(false);
    expect(isValidEmail("sara@example.com")).toBe(true);
    expect(isValidEmail("sara@example")).toBe(false);
  });
});

describe("checkoutFieldErrors", () => {
  it("has nothing to say about a complete gift order", () => {
    expect(checkoutFieldErrors(complete)).toEqual({});
  });

  it("names every missing field beside the field itself", () => {
    const errors = checkoutFieldErrors({
      ...complete,
      recipientName: "",
      zoneId: "",
      name: "",
      phone: "",
      email: "",
      address: "",
    });
    expect(Object.keys(errors).sort()).toEqual(
      ["address", "email", "name", "phone", "recipientName", "zoneId"].sort(),
    );
  });

  it("only asks about the recipient when the order is a gift", () => {
    expect(
      checkoutFieldErrors({
        ...complete,
        mode: "myself",
        recipientName: "",
        recipientPhone: "x",
      }),
    ).toEqual({});
  });

  it("flags malformed contact details, not just empty ones", () => {
    const errors = checkoutFieldErrors({ ...complete, phone: "123", email: "sara@" });
    expect(errors.phone).toBeDefined();
    expect(errors.email).toBeDefined();
  });
});
