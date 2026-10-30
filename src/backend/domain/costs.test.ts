import { describe, expect, it } from "vitest";
import {
  DEFAULT_COST_SETTINGS,
  PERISHABLE,
  aedTextToFils,
  earnings,
  matchItem,
  normaliseName,
  parseCostRecipe,
  parseSwatch,
  recipeCost,
  suggestedPriceFils,
  type RecipeItem,
} from "./costs";

/**
 * The arithmetic the owner reads in the product editor's Cost section —
 * what a product costs her, what she keeps, and what to charge — and the
 * matching of printed invoice names to her library.
 */

const items = new Map<number, RecipeItem>([
  /* 20 stems for AED 7.50: 37.5 fils a stem. */
  [1, { id: 1, kind: "flower", currentUnitCostFils: 37.5 }],
  [2, { id: 2, kind: "greenery", currentUnitCostFils: 100 }],
  [3, { id: 3, kind: "container", currentUnitCostFils: 1200 }],
  [4, { id: 4, kind: "wrapping", currentUnitCostFils: 250 }],
  [5, { id: 5, kind: "flower", currentUnitCostFils: 500, archived: true }],
]);

describe("defaults", () => {
  it("are the owner's starting point", () => {
    expect(DEFAULT_COST_SETTINGS).toEqual({
      targetMarginPercent: 60,
      labourRatePerHourFils: 6000,
      defaultWastePercent: 10,
      vatReclaimable: true,
      vatRatePercent: 5,
    });
  });

  it("count flowers and greenery as what wilts", () => {
    expect([...PERISHABLE].sort()).toEqual(["flower", "greenery"]);
  });
});

describe("recipeCost", () => {
  it("adds the allowance for lost flowers to flowers and greenery only", () => {
    const cost = recipeCost(
      [
        { itemId: 1, quantity: 12 }, // 450
        { itemId: 2, quantity: 3 }, // 300
        { itemId: 3, quantity: 1 }, // 1200
        { itemId: 4, quantity: 0.5 }, // 125
      ],
      items,
      { wastePercent: 10, makingMinutes: 20, labourRatePerHourFils: 6000 },
    );
    expect(cost.perishableFils).toBe(750);
    expect(cost.wasteFils).toBe(75);
    expect(cost.otherFils).toBe(1325);
    expect(cost.labourFils).toBe(2000);
    expect(cost.totalFils).toBe(750 + 75 + 1325 + 2000);
    expect(cost.lines.map((line) => line.lineFils)).toEqual([450, 300, 1200, 125]);
    expect(cost.lines.every((line) => !line.missing)).toBe(true);
  });

  it("keeps fractions of a fils until the total, so the parts add up", () => {
    const cost = recipeCost([{ itemId: 1, quantity: 3 }], items, {
      wastePercent: 0,
      makingMinutes: 0,
      labourRatePerHourFils: 6000,
    });
    expect(cost.lines[0]).toMatchObject({ unitCostFils: 37.5, lineFils: 113 });
    expect(cost.totalFils).toBe(cost.perishableFils + cost.wasteFils + cost.otherFils + cost.labourFils);
  });

  it("counts an unknown or archived item as nothing, and says so", () => {
    const cost = recipeCost(
      [
        { itemId: 99, quantity: 2 },
        { itemId: 5, quantity: 4 },
        { itemId: 3, quantity: 1 },
      ],
      items,
      { wastePercent: 10, makingMinutes: 0, labourRatePerHourFils: 6000 },
    );
    expect(cost.lines.map((line) => line.missing)).toEqual([true, true, false]);
    expect(cost.lines[1]).toMatchObject({ unitCostFils: 0, lineFils: 0 });
    expect(cost.totalFils).toBe(1200);
  });

  it("never returns NaN, whatever arrives", () => {
    const cost = recipeCost(
      [
        { itemId: 1, quantity: Number.NaN },
        { itemId: 3, quantity: -2 },
      ],
      items,
      { wastePercent: Number.NaN, makingMinutes: -5, labourRatePerHourFils: Number.POSITIVE_INFINITY },
    );
    expect(cost.totalFils).toBe(0);
    expect(Object.values(cost).filter((v) => typeof v === "number").every(Number.isFinite)).toBe(true);
  });

  it("is zero for an empty recipe", () => {
    expect(recipeCost([], items, { wastePercent: 10, makingMinutes: 0, labourRatePerHourFils: 6000 }).totalFils).toBe(0);
  });
});

describe("earnings", () => {
  it("takes the VAT out of a VAT-inclusive price", () => {
    /* AED 105 at 5% is AED 5 of VAT and AED 100 received. */
    expect(earnings(10500, 4000, 5)).toEqual({ vatFils: 500, receiveFils: 10000, profitFils: 6000, marginPercent: 60 });
  });

  it("shows a loss as a negative margin", () => {
    expect(earnings(10500, 12000, 5)).toMatchObject({ profitFils: -2000, marginPercent: -20 });
  });

  it("has no margin when nothing is received", () => {
    expect(earnings(0, 500, 5)).toEqual({ vatFils: 0, receiveFils: 0, profitFils: -500, marginPercent: null });
  });

  it("rounds the margin to one decimal", () => {
    expect(earnings(26000, 9876, 5).marginPercent).toBe(60.1);
  });

  it("works without VAT", () => {
    expect(earnings(20000, 5000, 0)).toEqual({ vatFils: 0, receiveFils: 20000, profitFils: 15000, marginPercent: 75 });
  });
});

describe("suggestedPriceFils", () => {
  it("is the smallest AED 5 price that reaches the target", () => {
    /* 100 / 0.4 × 1.05 = 262.50 → AED 265. */
    const price = suggestedPriceFils(10000, 60, 5);
    expect(price).toBe(26500);
    expect(earnings(price, 10000, 5).marginPercent).toBeGreaterThanOrEqual(60);
    expect(earnings(price - 500, 10000, 5).marginPercent).toBeLessThan(60);
  });

  it("does not add a step when the exact price is already a round one", () => {
    /* 40 / 0.4 × 1.05 = 105 exactly. */
    expect(suggestedPriceFils(4000, 60, 5)).toBe(10500);
  });

  it("finds the true minimum across many costs and targets", () => {
    for (const cost of [1, 99, 1234, 5555, 12345, 98765]) {
      for (const target of [10, 33, 50, 60, 72, 95]) {
        const price = suggestedPriceFils(cost, target, 5);
        expect(price % 500).toBe(0);
        const reaches = (p: number) => {
          const e = earnings(p, cost, 5);
          return e.receiveFils > 0 && e.profitFils * 100 >= target * e.receiveFils;
        };
        expect(reaches(price)).toBe(true);
        if (price > 500) expect(reaches(price - 500)).toBe(false);
      }
    }
  });

  it("rounds to another step when asked", () => {
    expect(suggestedPriceFils(10000, 60, 5, 100)).toBe(26300);
  });

  it("is 0 when there is no cost to cover", () => {
    expect(suggestedPriceFils(0, 60, 5)).toBe(0);
    expect(suggestedPriceFils(Number.NaN, 60, 5)).toBe(0);
  });
});

describe("parseCostRecipe", () => {
  it("reads the editor's hidden field", () => {
    expect(
      parseCostRecipe(JSON.stringify({ lines: [{ itemId: 3, quantity: 12 }], wastePercent: 15, makingMinutes: 25 })),
    ).toEqual({ lines: [{ itemId: 3, quantity: 12 }], wastePercent: 15, makingMinutes: 25 });
  });

  it("is undefined when the form had no Cost section", () => {
    expect(parseCostRecipe(null)).toBeUndefined();
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
    ]) {
      expect(parseCostRecipe(raw)).toBeNull();
    }
  });

  it("merges the same item twice and holds the allowance and time to their bounds", () => {
    expect(
      parseCostRecipe(
        JSON.stringify({
          lines: [
            { itemId: 1, quantity: 2 },
            { itemId: 1, quantity: 0.5 },
          ],
          wastePercent: 90,
          makingMinutes: 9999,
        }),
      ),
    ).toEqual({ lines: [{ itemId: 1, quantity: 2.5 }], wastePercent: 60, makingMinutes: 600 });
  });

  it("accepts an empty recipe, which removes it", () => {
    expect(parseCostRecipe(JSON.stringify({ lines: [], wastePercent: 10, makingMinutes: 0 }))).toEqual({
      lines: [],
      wastePercent: 10,
      makingMinutes: 0,
    });
  });
});

describe("aedTextToFils and parseSwatch", () => {
  it("keep fractions of a fils for a cost per stem", () => {
    expect(aedTextToFils("0.375")).toBe(37.5);
    expect(aedTextToFils("AED 7.50")).toBe(750);
    expect(aedTextToFils("1,200")).toBe(120000);
    expect(aedTextToFils(".5")).toBe(50);
    expect(aedTextToFils("0.29")).toBe(29);
    expect(aedTextToFils("")).toBeNull();
    expect(aedTextToFils("-1")).toBeNaN();
    expect(aedTextToFils("ten")).toBeNaN();
  });

  it("accept only #rrggbb", () => {
    expect(parseSwatch("#C0392B")).toBe("#c0392b");
    expect(parseSwatch("red")).toBeNull();
    expect(parseSwatch("#fff")).toBeNull();
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
