import { describe, expect, it } from "vitest";
import { CostInputError, parseCostItemForm, parseCostSettingsForm } from "./cost-forms";

/** The owner's costing forms, read into what the server saves — or refused in a sentence. */

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

const item = (over: Record<string, string> = {}) =>
  form({ name: "Red Naomi rose", kind: "flower", useUnit: "stem", unitsPerPack: "20", unitCostAed: "0.375", ...over });

const settings = (over: Record<string, string> = {}) =>
  form({
    targetMarginPercent: "60",
    labourRatePerHourAed: "60",
    defaultWastePercent: "10",
    vatReclaimable: "on",
    vatRatePercent: "5",
    ...over,
  });

const codeOf = (run: () => unknown): string | undefined => {
  try {
    run();
  } catch (error) {
    return error instanceof CostInputError ? error.code : "not a CostInputError";
  }
  return undefined;
};

describe("parseCostItemForm", () => {
  it("reads a flower bought by the bunch and costed by the stem", () => {
    expect(
      parseCostItemForm(item({ packName: "Bunch", swatch: "#C0392B", aliases: "RS NAOMI RED 60\n\nrs naomi red 60\n  Rose Naomi  " })),
    ).toEqual({
      name: "Red Naomi rose",
      kind: "flower",
      useUnit: "stem",
      packName: "Bunch",
      unitsPerPack: 20,
      unitCostFils: 37.5,
      swatch: "#c0392b",
      notes: null,
      aliases: ["RS NAOMI RED 60", "Rose Naomi"],
    });
  });

  it("keeps the cost she has when the field is left empty, and defaults one unit per pack", () => {
    expect(parseCostItemForm(item({ unitCostAed: "", unitsPerPack: "" }))).toMatchObject({
      unitCostFils: null,
      unitsPerPack: 1,
    });
  });

  it("does not keep the item's own name as a printed name", () => {
    expect(parseCostItemForm(item({ aliases: "red naomi ROSE" })).aliases).toEqual([]);
  });

  it("refuses each mistake with its own code", () => {
    expect(codeOf(() => parseCostItemForm(item({ name: "  " })))).toBe("actions.costs.nameRequired");
    expect(codeOf(() => parseCostItemForm(item({ name: "x".repeat(81) })))).toBe("actions.costs.nameTooLong");
    expect(codeOf(() => parseCostItemForm(item({ kind: "bouquet" })))).toBe("actions.costs.kindRequired");
    expect(codeOf(() => parseCostItemForm(item({ useUnit: "kg" })))).toBe("actions.costs.unitRequired");
    expect(codeOf(() => parseCostItemForm(item({ unitsPerPack: "0" })))).toBe("actions.costs.unitsPerPackInvalid");
    expect(codeOf(() => parseCostItemForm(item({ unitsPerPack: "-3" })))).toBe("actions.costs.unitsPerPackInvalid");
    expect(codeOf(() => parseCostItemForm(item({ unitCostAed: "abc" })))).toBe("actions.costs.costInvalid");
    expect(codeOf(() => parseCostItemForm(item({ unitCostAed: "-1" })))).toBe("actions.costs.costInvalid");
    expect(codeOf(() => parseCostItemForm(item({ unitCostAed: "20000" })))).toBe("actions.costs.costTooHigh");
    expect(codeOf(() => parseCostItemForm(item({ swatch: "red" })))).toBe("actions.costs.swatchInvalid");
    expect(codeOf(() => parseCostItemForm(item({ packName: "x".repeat(41) })))).toBe("actions.costs.packNameTooLong");
    expect(codeOf(() => parseCostItemForm(item({ notes: "x".repeat(1001) })))).toBe("actions.costs.notesTooLong");
    expect(codeOf(() => parseCostItemForm(item({ aliases: "x".repeat(81) })))).toBe("actions.costs.aliasTooLong");
    expect(
      codeOf(() => parseCostItemForm(item({ aliases: Array.from({ length: 31 }, (_, i) => `name ${i}`).join("\n") }))),
    ).toBe("actions.costs.tooManyAliases");
  });
});

describe("parseCostSettingsForm", () => {
  it("reads the hourly rate in dirhams and stores fils", () => {
    expect(parseCostSettingsForm(settings())).toEqual({
      targetMarginPercent: 60,
      labourRatePerHourFils: 6000,
      defaultWastePercent: 10,
      vatReclaimable: true,
      vatRatePercent: 5,
    });
  });

  it("reads an unticked VAT box as not reclaimable, and accepts percent signs", () => {
    const data = settings({ targetMarginPercent: "55%", labourRatePerHourAed: "72.50" });
    data.delete("vatReclaimable");
    expect(parseCostSettingsForm(data)).toMatchObject({
      targetMarginPercent: 55,
      labourRatePerHourFils: 7250,
      vatReclaimable: false,
    });
  });

  it("holds every value to its bounds", () => {
    expect(codeOf(() => parseCostSettingsForm(settings({ targetMarginPercent: "0" })))).toBe("actions.costs.targetInvalid");
    expect(codeOf(() => parseCostSettingsForm(settings({ targetMarginPercent: "96" })))).toBe("actions.costs.targetInvalid");
    expect(codeOf(() => parseCostSettingsForm(settings({ labourRatePerHourAed: "" })))).toBe("actions.costs.labourInvalid");
    expect(codeOf(() => parseCostSettingsForm(settings({ defaultWastePercent: "61" })))).toBe("actions.costs.wasteInvalid");
    expect(codeOf(() => parseCostSettingsForm(settings({ vatRatePercent: "x" })))).toBe("actions.costs.vatRateInvalid");
  });
});
