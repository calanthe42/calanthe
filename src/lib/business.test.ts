import { describe, expect, it } from "vitest";
import { CONTACT } from "@/lib/data";
import { BUSINESS, currentVatRateBps } from "./business";

describe("business details", () => {
  it("carries what the owner has decided: Calanthe, Abu Dhabi, United Arab Emirates", () => {
    expect(BUSINESS.tradingName).toBe("Calanthe");
    expect(BUSINESS.city.en).toBe("Abu Dhabi");
    expect(BUSINESS.country.en).toBe("United Arab Emirates");
    expect(BUSINESS.email).toBe(CONTACT.email);
    expect(BUSINESS.phone).toBe(CONTACT.whatsapp);
  });

  /**
   * THE GUARD. Switching `vatRegistered` on turns every new invoice into a
   * "Tax invoice". One of those without a TRN or a legal name is not a valid
   * document, so this fails the build before one can be sent.
   */
  it("cannot be VAT-registered without a 15-digit TRN, a legal name and a rate", () => {
    if (!BUSINESS.vatRegistered) return;
    expect(BUSINESS.trn).toMatch(/^\d{15}$/);
    expect(BUSINESS.legalName?.en.trim()).toBeTruthy();
    expect(BUSINESS.legalName?.ar.trim()).toBeTruthy();
    expect(BUSINESS.vatRateBps).toBeGreaterThan(0);
  });

  it("charges no VAT while the business is not registered, whatever the rate field says", () => {
    expect(currentVatRateBps({ ...BUSINESS, vatRegistered: false, vatRateBps: 500 })).toBe(0);
    expect(currentVatRateBps({ ...BUSINESS, vatRegistered: true, vatRateBps: 500 })).toBe(500);
  });

  it("is VAT-off today, as the owner decided", () => {
    expect(BUSINESS.vatRegistered).toBe(false);
    expect(currentVatRateBps()).toBe(0);
  });
});
