import { describe, expect, it } from "vitest";
import {
  COST_GROUPS,
  FLORIST_GUIDE_PER_100,
  ONE_UNITS,
  aedTextToFils,
  arrangementCost,
  cardFeeEstimateFils,
  guideBand,
  invoiceExtrasFils,
  invoicePricesForOne,
  invoiceTotalsCheck,
  invoiceUnits,
  isCostGroup,
  isOneUnit,
  latestPrices,
  matchItem,
  normaliseName,
  parseCostRecipe,
  per100,
  priceChangePercent,
  priceForGuide,
  westernDigits,
  type CostItemPrice,
  type PricedLine,
} from "./costs";

/**
 * The arithmetic the owner reads: the price for one stem worked out from an
 * invoice, what an arrangement costs to make, the one percentage she is
 * shown, the card fee, and the matching of printed invoice names to what
 * she buys. The worked examples are the concept's own (CONCEPT.md §3).
 */

describe("the words", () => {
  it("are the four groups and the three ones", () => {
    expect(COST_GROUPS).toEqual(["flowers", "greenery", "packaging", "extra"]);
    expect(ONE_UNITS).toEqual(["stem", "piece", "metre"]);
    expect(isCostGroup("packaging")).toBe(true);
    expect(isCostGroup("container")).toBe(false);
    expect(isOneUnit("metre")).toBe(true);
    expect(isOneUnit("bunch")).toBe(false);
  });

  it("put the florists' guide at 33 of every AED 100", () => {
    expect(FLORIST_GUIDE_PER_100).toBe(33);
  });
});

describe("invoiceExtrasFils", () => {
  it("counts delivery and supplier VAT while the shop is not VAT-registered", () => {
    expect(invoiceExtrasFils(2000, 4100, false)).toBe(6100);
  });

  it("counts delivery only once the shop can claim VAT back", () => {
    expect(invoiceExtrasFils(2000, 4100, true)).toBe(2000);
  });

  it("never lets a bad number in", () => {
    expect(invoiceExtrasFils(Number.NaN, -5, false)).toBe(0);
  });
});

describe("invoicePricesForOne", () => {
  it("shares the extras by value and divides by the stems (the concept's AED 3.23)", () => {
    /* Lines AED 800; delivery AED 20 and VAT AED 41 are AED 61 of extras.
       The AED 300 line of 5 bunches of 20 takes 37.5% of them. */
    const [peach, other] = invoicePricesForOne(
      [
        { lineTotalFils: 30000, units: 100 },
        { lineTotalFils: 50000, units: 250 },
      ],
      6100,
    );
    expect(peach).toBe(322.88);
    expect(Math.round(peach!)).toBe(323);
    expect(other).toBe(215.25);
  });

  it("is the line divided by its units when there are no extras", () => {
    /* A carton of 25 boxes for AED 550 is AED 22 a box. */
    expect(invoicePricesForOne([{ lineTotalFils: 55000, units: 25 }], 0)).toEqual([2200]);
  });

  it("keeps a fraction of a fils, to a hundredth", () => {
    expect(invoicePricesForOne([{ lineTotalFils: 6400, units: 30 }], 0)).toEqual([213.33]);
  });

  it("shares the extras equally when every line is free", () => {
    expect(
      invoicePricesForOne(
        [
          { lineTotalFils: 0, units: 10 },
          { lineTotalFils: 0, units: 20 },
        ],
        1000,
      ),
    ).toEqual([50, 25]);
  });

  it("gives a free line in a paid invoice no share of the extras", () => {
    expect(
      invoicePricesForOne(
        [
          { lineTotalFils: 10000, units: 10 },
          { lineTotalFils: 0, units: 5 },
        ],
        1000,
      ),
    ).toEqual([1100, 0]);
  });

  it("never returns NaN or Infinity", () => {
    const prices = invoicePricesForOne(
      [
        { lineTotalFils: 1000, units: 0 },
        { lineTotalFils: Number.NaN, units: 5 },
        { lineTotalFils: 1000, units: -2 },
      ],
      Number.NaN,
    );
    expect(prices).toEqual([0, 0, 0]);
    expect(invoicePricesForOne([], 500)).toEqual([]);
  });
});

describe("invoiceTotalsCheck", () => {
  it("matches when the lines, delivery and VAT add up to the printed total", () => {
    expect(invoiceTotalsCheck([30000, 50000], 2000, 4100, 86100)).toEqual({
      sumFils: 86100,
      linesFils: 80000,
      matches: true,
      differenceFils: 0,
    });
  });

  it("says how much more the printed total is (is a page missing?)", () => {
    expect(invoiceTotalsCheck([78000], 0, 0, 86100)).toEqual({
      sumFils: 78000,
      linesFils: 78000,
      matches: false,
      differenceFils: 8100,
    });
  });

  it("says how much less, as a negative difference", () => {
    expect(invoiceTotalsCheck([10000], 500, 0, 10000)).toMatchObject({ matches: false, differenceFils: -500 });
  });

  it("allows a fils a line for the supplier's rounding", () => {
    expect(invoiceTotalsCheck([3333, 3333, 3333], 0, 0, 10000).matches).toBe(true);
    expect(invoiceTotalsCheck([3333, 3333, 3333], 0, 0, 10004).matches).toBe(false);
  });

  it("has nothing to check without a printed total", () => {
    expect(invoiceTotalsCheck([30000], 2000, 0, null)).toEqual({
      sumFils: 32000,
      linesFils: 30000,
      matches: null,
      differenceFils: 0,
    });
  });
});

describe("invoiceUnits and priceChangePercent", () => {
  it("multiplies bunches by stems in a bunch", () => {
    expect(invoiceUnits(5, 20)).toBe(100);
    expect(invoiceUnits(1.5, 50)).toBe(75);
    expect(invoiceUnits(0.1, 0.3)).toBe(0.03);
    expect(invoiceUnits(-1, 20)).toBe(0);
  });

  it("rounds a price move to a whole percent, and has none for something new", () => {
    expect(priceChangePercent(323, 380)).toBe(18);
    expect(priceChangePercent(380, 323)).toBe(-15);
    expect(priceChangePercent(320, 320)).toBe(0);
    expect(priceChangePercent(null, 380)).toBeNull();
    expect(priceChangePercent(0, 380)).toBeNull();
  });
});

describe("latestPrices", () => {
  const oct = (day: number) => `2026-10-${String(day).padStart(2, "0")}T08:00:00.000Z`;
  const line = (over: Partial<PricedLine>): PricedLine => ({
    itemId: 1,
    invoiceId: 1,
    invoiceDate: oct(20),
    supplierId: 5,
    units: 100,
    priceForOneFils: 323,
    ...over,
  });

  it("takes the price on the latest invoice date, wherever it was added", () => {
    const prices = latestPrices([
      line({ invoiceId: 9, invoiceDate: oct(12), priceForOneFils: 300 }),
      line({ invoiceId: 4, invoiceDate: oct(26), priceForOneFils: 380, supplierId: 6 }),
      line({ invoiceId: 7, invoiceDate: oct(20), priceForOneFils: 323 }),
    ]);
    expect(prices.get(1)).toEqual({ priceForOneFils: 380, invoiceId: 4, invoiceDate: oct(26), supplierId: 6 });
  });

  it("takes the invoice added last when two have the same date", () => {
    const prices = latestPrices([
      line({ invoiceId: 3, priceForOneFils: 300 }),
      line({ invoiceId: 8, priceForOneFils: 340 }),
    ]);
    expect(prices.get(1)?.priceForOneFils).toBe(340);
  });

  it("weights two lines of the same thing on one invoice by their stems", () => {
    const prices = latestPrices([
      line({ invoiceId: 2, units: 100, priceForOneFils: 300 }),
      line({ invoiceId: 2, units: 50, priceForOneFils: 400 }),
      line({ invoiceId: 1, invoiceDate: oct(1), units: 1000, priceForOneFils: 100 }),
    ]);
    expect(prices.get(1)?.priceForOneFils).toBe(333.33);
  });

  it("works each thing out on its own, and knows nothing it was not given", () => {
    const prices = latestPrices([line({ itemId: 1 }), line({ itemId: 2, priceForOneFils: 2200, units: 25 })]);
    expect(prices.get(2)?.priceForOneFils).toBe(2200);
    expect(prices.has(3)).toBe(false);
    expect(latestPrices([]).size).toBe(0);
  });
});

describe("arrangementCost", () => {
  /* Peach Reverie Standard, the concept's example figures. */
  const items = new Map<number, CostItemPrice>([
    [1, { id: 1, name: "Peach Avalanche rose", group: "flowers", priceForOneFils: 323 }],
    [2, { id: 2, name: "Spray rose", group: "flowers", priceForOneFils: 210 }],
    [3, { id: 3, name: "Eucalyptus", group: "greenery", priceForOneFils: 160 }],
    [4, { id: 4, name: "Hat box", group: "packaging", priceForOneFils: 2200 }],
    [5, { id: 5, name: "Tissue and ribbon", group: "packaging", priceForOneFils: 300 }],
    [6, { id: 6, name: "Card", group: "packaging", priceForOneFils: 100 }],
    [7, { id: 7, name: "Velvet ribbon", group: "packaging", priceForOneFils: null }],
    [8, { id: 8, name: "Fern", group: "greenery", priceForOneFils: 37.5 }],
  ]);

  it("adds how many × price for one (the concept's AED 91.35)", () => {
    const cost = arrangementCost(
      [
        { itemId: 1, quantity: 15 },
        { itemId: 2, quantity: 5 },
        { itemId: 3, quantity: 4 },
        { itemId: 4, quantity: 1 },
        { itemId: 5, quantity: 1 },
        { itemId: 6, quantity: 1 },
      ],
      items,
    );
    expect(cost.costFils).toBe(9135);
    expect(cost.atLeast).toBe(false);
    expect(cost.missingNames).toEqual([]);
    expect(cost.lines.map((line) => line.lineFils)).toEqual([4845, 1050, 640, 2200, 300, 100]);
  });

  it("rounds each line, so the lines add up to the cost", () => {
    const cost = arrangementCost([{ itemId: 8, quantity: 3 }], items);
    expect(cost.lines[0]).toEqual({ itemId: 8, quantity: 3, lineFils: 113 });
    expect(cost.costFils).toBe(113);
  });

  it("never counts something with no price yet as zero in silence", () => {
    const cost = arrangementCost(
      [
        { itemId: 1, quantity: 10 },
        { itemId: 7, quantity: 2 },
        { itemId: 7, quantity: 1 },
        { itemId: 999, quantity: 1 },
      ],
      items,
    );
    expect(cost.costFils).toBe(3230);
    expect(cost.atLeast).toBe(true);
    expect(cost.missingNames).toEqual(["Velvet ribbon"]);
    expect(cost.lines.map((line) => line.lineFils)).toEqual([3230, null, null, null]);
  });

  it("is zero, and complete, for an empty recipe", () => {
    expect(arrangementCost([], items)).toEqual({ costFils: 0, atLeast: false, missingNames: [], lines: [] });
  });

  it("never returns NaN, whatever arrives", () => {
    const cost = arrangementCost(
      [
        { itemId: 1, quantity: Number.NaN },
        { itemId: 2, quantity: -3 },
      ],
      items,
    );
    expect(cost.costFils).toBe(0);
    expect(cost.lines.every((line) => line.lineFils === 0)).toBe(true);
  });
});

describe("per100 and guideBand", () => {
  it("is the dirhams of every AED 100 of the price, to one decimal", () => {
    expect(per100(9100, 45000)).toBe(20.2);
    expect(per100(11330, 59000)).toBe(19.2);
    expect(per100(3300, 10000)).toBe(33);
    expect(per100(60000, 45000)).toBe(133.3);
  });

  it("has no share of a price of 0", () => {
    expect(per100(9100, 0)).toBeNull();
    expect(per100(9100, Number.NaN)).toBeNull();
  });

  it("is green to 33, amber to 40, red above", () => {
    expect(guideBand(20.2)).toBe("healthy");
    expect(guideBand(33)).toBe("healthy");
    expect(guideBand(33.1)).toBe("watch");
    expect(guideBand(40)).toBe("watch");
    expect(guideBand(40.1)).toBe("tooMuch");
    expect(guideBand(null)).toBeNull();
  });
});

describe("priceForGuide", () => {
  it("is the price, rounded up to AED 5, at which the cost is 33 of every 100", () => {
    /* AED 91.35 ÷ 0.33 = AED 276.82 → AED 280. */
    expect(priceForGuide(9135)).toBe(28000);
    /* AED 92.40 ÷ 0.33 = AED 280 exactly: no extra step. */
    expect(priceForGuide(9240)).toBe(28000);
    expect(priceForGuide(9241)).toBe(28500);
  });

  it("finds the true smallest price across many costs and targets", () => {
    for (const cost of [1, 99, 1234, 9135, 15670, 33333, 100000]) {
      for (const target of [10, 25, 33, 40, 50]) {
        const price = priceForGuide(cost, target);
        expect(price % 500).toBe(0);
        expect(cost * 100).toBeLessThanOrEqual(target * price);
        if (price > 500) expect(cost * 100).toBeGreaterThan(target * (price - 500));
      }
    }
  });

  it("rounds to another step when asked, and falls back to 33 for a nonsense target", () => {
    expect(priceForGuide(9135, 33, 1000)).toBe(28000);
    expect(priceForGuide(9135, 0)).toBe(28000);
    expect(priceForGuide(9135, 150)).toBe(28000);
  });

  it("is 0 when there is no cost", () => {
    expect(priceForGuide(0)).toBe(0);
    expect(priceForGuide(Number.NaN)).toBe(0);
  });
});

describe("cardFeeEstimateFils", () => {
  it("is 2.9% + AED 1 (the concept's AED 20.31 on AED 666)", () => {
    expect(cardFeeEstimateFils(66600)).toBe(2031);
    expect(cardFeeEstimateFils(45000)).toBe(1405);
  });

  it("is nothing on nothing paid", () => {
    expect(cardFeeEstimateFils(0)).toBe(0);
    expect(cardFeeEstimateFils(-100)).toBe(0);
  });
});

describe("parseCostRecipe", () => {
  it("reads the editor's hidden field", () => {
    expect(parseCostRecipe(JSON.stringify({ lines: [{ itemId: 3, quantity: 12 }] }))).toEqual({
      lines: [{ itemId: 3, quantity: 12 }],
    });
  });

  it("ignores the allowance and minutes an older editor sent", () => {
    expect(
      parseCostRecipe(JSON.stringify({ lines: [{ itemId: 3, quantity: 2 }], wastePercent: 15, makingMinutes: 25 })),
    ).toEqual({ lines: [{ itemId: 3, quantity: 2 }] });
  });

  it("is undefined when the form had no Cost section", () => {
    expect(parseCostRecipe(null)).toBeUndefined();
    expect(parseCostRecipe(undefined)).toBeUndefined();
    expect(parseCostRecipe("")).toBeUndefined();
  });

  it("refuses anything malformed rather than half-saving it", () => {
    for (const raw of [
      "{not json",
      "[]",
      JSON.stringify({ lines: "x" }),
      JSON.stringify({ lines: [{ itemId: "3", quantity: 1 }] }),
      JSON.stringify({ lines: [{ itemId: 3, quantity: 0 }] }),
      JSON.stringify({ lines: [{ itemId: 3, quantity: -1 }] }),
      JSON.stringify({ lines: [{ itemId: 3.5, quantity: 1 }] }),
      JSON.stringify({ lines: [{ itemId: 3, quantity: 1e9 }] }),
      JSON.stringify({ lines: Array.from({ length: 61 }, (_, i) => ({ itemId: i + 1, quantity: 1 })) }),
    ]) {
      expect(parseCostRecipe(raw)).toBeNull();
    }
    expect(parseCostRecipe(42)).toBeNull();
  });

  it("merges the same item twice", () => {
    expect(
      parseCostRecipe(
        JSON.stringify({
          lines: [
            { itemId: 1, quantity: 2 },
            { itemId: 1, quantity: 0.5 },
          ],
        }),
      ),
    ).toEqual({ lines: [{ itemId: 1, quantity: 2.5 }] });
  });

  it("accepts an empty recipe, which removes it", () => {
    expect(parseCostRecipe(JSON.stringify({ lines: [] }))).toEqual({ lines: [] });
  });
});

describe("aedTextToFils and westernDigits", () => {
  it("keeps fractions of a fils for a price for one", () => {
    expect(aedTextToFils("0.375")).toBe(37.5);
    expect(aedTextToFils("AED 7.50")).toBe(750);
    expect(aedTextToFils(" aed300 ")).toBe(30000);
    expect(aedTextToFils("1,200")).toBe(120000);
    expect(aedTextToFils(".5")).toBe(50);
    expect(aedTextToFils("0.29")).toBe(29);
    expect(aedTextToFils("")).toBeNull();
    expect(aedTextToFils("   ")).toBeNull();
    expect(aedTextToFils("-1")).toBeNaN();
    expect(aedTextToFils("ten")).toBeNaN();
    expect(aedTextToFils("1.2.3")).toBeNaN();
  });

  it("reads what an Arabic keyboard types", () => {
    expect(westernDigits("٣٠٠٫٥٠")).toBe("300.50");
    expect(westernDigits("۱۲۳")).toBe("123");
    expect(aedTextToFils("٣٠٠")).toBe(30000);
    expect(aedTextToFils("١٬٢٠٠٫٥")).toBe(120050);
    expect(aedTextToFils("د.إ ٤١")).toBe(4100);
  });
});

describe("normaliseName", () => {
  it("drops sizes, grades, counts and punctuation, and spells out shorthand", () => {
    expect(normaliseName("ROSE RED NAOMI 60CM")).toBe("rose red naomi");
    expect(normaliseName("Rose  Red-Naomi, 50 cm (A1)")).toBe("rose red naomi");
    expect(normaliseName("Chrysanth Wht XL")).toBe("chrysanthemum white");
    expect(normaliseName("EUC. SLV DOLLAR 10 ST")).toBe("eucalyptus silver dollar");
    expect(normaliseName("Roses x20 bunch")).toBe("rose");
  });

  it("folds accents and plurals", () => {
    expect(normaliseName("Rosés")).toBe("rose");
    expect(normaliseName("Glass vases")).toBe("glass vase");
    expect(normaliseName("Peonies")).toBe("peony");
    expect(normaliseName("Iris")).toBe("iris");
  });
});

describe("matchItem", () => {
  const library = [
    { id: 1, name: "Red Naomi rose", aliases: ["RS NAOMI RED 60"] },
    { id: 2, name: "White chrysanthemum", aliases: [] },
    { id: 3, name: "Silver dollar eucalyptus", aliases: [] },
    { id: 4, name: "Glass cylinder vase", aliases: [] },
  ];

  it("is certain on a name she has already confirmed", () => {
    expect(matchItem("RS Naomi Red 60cm", library)).toEqual({ id: 1, score: 1, via: "alias" });
  });

  it("matches on the words, whatever their order", () => {
    expect(matchItem("ROSE NAOMI RED 50CM", library)).toEqual({ id: 1, score: 1, via: "name" });
    expect(matchItem("Chrysanth Wht", library)).toMatchObject({ id: 2, via: "name" });
    expect(matchItem("EUC SLV DOLLAR", library)).toMatchObject({ id: 3, score: 1 });
  });

  it("gives a partial score for a partial match", () => {
    const match = matchItem("Glass vase", library);
    expect(match?.id).toBe(4);
    expect(match!.score).toBeGreaterThanOrEqual(0.5);
    expect(match!.score).toBeLessThan(1);
  });

  it("is no match below half the words in common", () => {
    expect(matchItem("Kraft paper roll", library)).toBeNull();
    expect(matchItem("", library)).toBeNull();
    expect(matchItem("60cm", library)).toBeNull();
  });
});
