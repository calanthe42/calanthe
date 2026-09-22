import { describe, expect, it } from "vitest";
import {
  bespokeMessage,
  bespokeTotalAed,
  bespokeWhatsAppHref,
  type BespokeRequest,
} from "./bespoke";

const base: BespokeRequest = {
  budgetAed: 350,
  colours: ["Blush & Rose", "Whites & Creams"],
  floristChoosesColours: false,
  vase: true,
  vasePriceAed: 60,
  colourNote: "",
  cardMessage: "  Happy birthday, Mama  ",
  leaveCardBlank: false,
  notes: "",
};

describe("bespoke request", () => {
  it("adds the vase to the total only when one is chosen", () => {
    expect(bespokeTotalAed(base)).toBe(410);
    expect(bespokeTotalAed({ ...base, vase: false })).toBe(350);
    expect(bespokeTotalAed({ ...base, vase: null })).toBe(350);
  });

  it("writes every choice the florist needs, one per line", () => {
    const text = bespokeMessage(base);
    /* The occasion is no longer asked — the card and the notes carry what
       the flowers are for. A colour note is written only when she wrote one. */
    expect(text).not.toContain("Occasion");
    expect(bespokeMessage({ ...base, colourNote: "  nothing yellow  " })).toContain(
      "Colour note: nothing yellow",
    );
    expect(text).not.toContain("Colour note");
    expect(text).toContain("Colours: Blush & Rose, Whites & Creams");
    expect(text).toContain('Card: "Happy birthday, Mama"');
    expect(text).toContain("Vase: yes");
    expect(text).not.toContain("Notes:");
  });

  it("says florist's choice rather than leaving colours empty", () => {
    expect(bespokeMessage({ ...base, colours: [] })).toContain(
      "Colours: florist's choice",
    );
    expect(
      bespokeMessage({
        ...base,
        colours: ["Greens & Foliage"],
        floristChoosesColours: true,
      }),
    ).toContain("Colours: Greens & Foliage, florist's choice");
  });

  it("respects a blank card and includes notes when written", () => {
    const text = bespokeMessage({
      ...base,
      leaveCardBlank: true,
      cardMessage: "",
      notes: "No lilies",
    });
    expect(text).toContain("Card: leave blank");
    expect(text).toContain("Notes: No lilies");
  });

  it("links to the atelier's WhatsApp with the message encoded", () => {
    const href = bespokeWhatsAppHref(base);
    expect(href.startsWith("https://wa.me/971562112733?text=")).toBe(true);
    expect(decodeURIComponent(href.split("?text=")[1] ?? "")).toBe(bespokeMessage(base));
  });
});
