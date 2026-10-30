import { describe, expect, it } from "vitest";
import { CostInputError, isRealDay, parseCostItemForm, parseInvoiceInput, positiveNumber } from "./cost-forms";
import type { InvoiceInput } from "./costs";

/** What the owner sends — something she buys, and an invoice — read into what the server saves, or refused in a sentence. */

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

const item = (over: Record<string, string> = {}) =>
  form({ name: "Peach Avalanche rose", group: "flowers", packName: "bunch", unitsPerPack: "20", one: "stem", ...over });

const refusal = (run: () => unknown): { code?: string; field?: string; vars?: unknown } => {
  try {
    run();
  } catch (error) {
    if (error instanceof CostInputError) return { code: error.code, field: error.field, vars: error.vars };
    return { code: "not a CostInputError" };
  }
  return {};
};

const TODAY = "2026-10-30";

const invoice = (over: Partial<InvoiceInput> = {}): InvoiceInput => ({
  supplier: { name: "Al Aweer Flowers" },
  invoiceNumber: "INV-1042",
  invoiceDate: "2026-10-26",
  deliveryAed: "20",
  vatAed: "41",
  totalAed: "861",
  lines: [
    { itemId: 13, printedName: "ROSE PEACH AVAL 50CM", packs: 5, unitsPerPack: 20, lineTotalAed: "300" },
    {
      itemId: null,
      newItem: { name: "Spray rose", group: "flowers", packName: "bunch", unitsPerPack: 10, one: "stem" },
      packs: 25,
      unitsPerPack: 10,
      lineTotalAed: "500",
    },
  ],
  ...over,
});

describe("positiveNumber and isRealDay", () => {
  it("read a count as she types it", () => {
    expect(positiveNumber("20")).toBe(20);
    expect(positiveNumber(" 1,000 ")).toBe(1000);
    expect(positiveNumber("٢٠")).toBe(20);
    expect(positiveNumber(".5")).toBe(0.5);
    expect(positiveNumber(12)).toBe(12);
    expect(positiveNumber("0")).toBeNaN();
    expect(positiveNumber(-3)).toBeNaN();
    expect(positiveNumber("twenty")).toBeNaN();
    expect(positiveNumber(null)).toBeNaN();
  });

  it("know a real day", () => {
    expect(isRealDay("2026-10-26")).toBe(true);
    expect(isRealDay("2028-02-29")).toBe(true);
    expect(isRealDay("2026-02-30")).toBe(false);
    expect(isRealDay("26/10/2026")).toBe(false);
  });
});

describe("parseCostItemForm", () => {
  it("reads the one sentence", () => {
    expect(parseCostItemForm(item({ name: "  Peach   Avalanche rose ", priceAed: "3.25" }))).toEqual({
      name: "Peach Avalanche rose",
      group: "flowers",
      packName: "bunch",
      unitsPerPack: 20,
      one: "stem",
      priceFils: 325,
      archived: false,
    });
  });

  it("keeps the price she has when the box is empty, and reads a tick", () => {
    expect(parseCostItemForm(item({ archived: "on" }))).toMatchObject({ priceFils: null, archived: true });
    expect(parseCostItemForm(item({ archived: "false" }))).toMatchObject({ archived: false });
  });

  it("counts one at a time when no number is given", () => {
    expect(parseCostItemForm(item({ packName: "", unitsPerPack: "" }))).toMatchObject({ packName: null, unitsPerPack: 1 });
  });

  it("refuses what it cannot read, naming the field", () => {
    expect(refusal(() => parseCostItemForm(item({ name: "" })))).toMatchObject({ code: "actions.costs.nameRequired", field: "name" });
    expect(refusal(() => parseCostItemForm(item({ group: "container" })))).toMatchObject({ code: "actions.costs.groupRequired" });
    expect(refusal(() => parseCostItemForm(item({ one: "bunch" })))).toMatchObject({ code: "actions.costs.oneRequired" });
    expect(refusal(() => parseCostItemForm(item({ unitsPerPack: "0" })))).toMatchObject({
      code: "actions.costs.unitsPerPackInvalid",
      field: "unitsPerPack",
    });
    expect(refusal(() => parseCostItemForm(item({ priceAed: "abc" })))).toMatchObject({ code: "actions.costs.priceInvalid", field: "priceAed" });
    expect(refusal(() => parseCostItemForm(item({ priceAed: "20000" })))).toMatchObject({ code: "actions.costs.priceTooHigh" });
    expect(refusal(() => parseCostItemForm(item({ name: "x".repeat(81) })))).toMatchObject({
      code: "actions.costs.nameTooLong",
      vars: { max: 80 },
    });
  });
});

describe("parseInvoiceInput", () => {
  it("reads the invoice, in fils", () => {
    expect(parseInvoiceInput(invoice(), TODAY)).toEqual({
      id: null,
      supplier: { name: "Al Aweer Flowers" },
      invoiceNumber: "INV-1042",
      invoiceDate: "2026-10-26",
      deliveryFils: 2000,
      vatFils: 4100,
      totalFils: 86100,
      lines: [
        {
          itemId: 13,
          newItem: null,
          printedName: "ROSE PEACH AVAL 50CM",
          packs: 5,
          unitsPerPack: 20,
          lineTotalFils: 30000,
        },
        {
          itemId: null,
          newItem: { name: "Spray rose", group: "flowers", packName: "bunch", unitsPerPack: 10, one: "stem" },
          printedName: null,
          packs: 25,
          unitsPerPack: 10,
          lineTotalFils: 50000,
        },
      ],
    });
  });

  it("takes an existing supplier, no delivery, no VAT and no printed total", () => {
    const parsed = parseInvoiceInput(
      invoice({ id: 7, supplier: { id: 3 }, invoiceNumber: "  ", deliveryAed: "", vatAed: "", totalAed: "" }),
      TODAY,
    );
    expect(parsed).toMatchObject({ id: 7, supplier: { id: 3 }, invoiceNumber: null, deliveryFils: 0, vatFils: 0, totalFils: null });
  });

  it("reads Arabic digits, and numbers sent as text", () => {
    const parsed = parseInvoiceInput(
      invoice({
        invoiceDate: "٢٠٢٦-١٠-٢٦",
        lines: [{ itemId: 13, packs: "٥" as unknown as number, unitsPerPack: 20, lineTotalAed: "٣٠٠" }],
      }),
      TODAY,
    );
    expect(parsed.invoiceDate).toBe("2026-10-26");
    expect(parsed.lines[0]).toMatchObject({ packs: 5, lineTotalFils: 30000 });
  });

  it("allows tomorrow's date, not later, and nothing before 2020", () => {
    expect(parseInvoiceInput(invoice({ invoiceDate: "2026-10-31" }), TODAY).invoiceDate).toBe("2026-10-31");
    expect(refusal(() => parseInvoiceInput(invoice({ invoiceDate: "2026-11-01" }), TODAY))).toMatchObject({
      code: "actions.costs.dateInFuture",
      field: "invoiceDate",
    });
    expect(refusal(() => parseInvoiceInput(invoice({ invoiceDate: "2019-12-31" }), TODAY))).toMatchObject({ code: "actions.costs.dateTooOld" });
    expect(refusal(() => parseInvoiceInput(invoice({ invoiceDate: "2026-02-30" }), TODAY))).toMatchObject({ code: "actions.costs.dateRequired" });
  });

  it("needs a supplier", () => {
    expect(refusal(() => parseInvoiceInput(invoice({ supplier: { name: "  " } }), TODAY))).toMatchObject({
      code: "actions.costs.supplierRequired",
      field: "supplier",
    });
    expect(refusal(() => parseInvoiceInput(invoice({ supplier: { id: 0 } }), TODAY))).toMatchObject({ code: "actions.costs.supplierRequired" });
  });

  it("needs at least one line, and points at the line that is wrong", () => {
    expect(refusal(() => parseInvoiceInput(invoice({ lines: [] }), TODAY))).toMatchObject({ code: "actions.costs.linesRequired" });
    const line = invoice().lines[0]!;
    expect(refusal(() => parseInvoiceInput(invoice({ lines: [line, { ...line, packs: 0 }] }), TODAY))).toEqual({
      code: "actions.costs.packsInvalid",
      field: "lines.1.packs",
      vars: { line: 2 },
    });
    expect(refusal(() => parseInvoiceInput(invoice({ lines: [{ ...line, unitsPerPack: -1 }] }), TODAY))).toMatchObject({
      code: "actions.costs.lineUnitsPerPackInvalid",
      field: "lines.0.unitsPerPack",
    });
    expect(refusal(() => parseInvoiceInput(invoice({ lines: [{ ...line, lineTotalAed: "" }] }), TODAY))).toMatchObject({
      code: "actions.costs.lineTotalRequired",
      field: "lines.0.lineTotalAed",
    });
    expect(refusal(() => parseInvoiceInput(invoice({ lines: [{ ...line, lineTotalAed: "3OO" }] }), TODAY))).toMatchObject({
      code: "actions.costs.amountInvalid",
    });
    expect(refusal(() => parseInvoiceInput(invoice({ lines: [{ ...line, itemId: null }] }), TODAY))).toMatchObject({
      code: "actions.costs.lineItemRequired",
      field: "lines.0.item",
    });
  });

  it("checks something new is described in full", () => {
    const fresh = invoice().lines[1]!;
    const broken = (newItem: Record<string, unknown>) =>
      invoice({ lines: [{ ...fresh, newItem: { ...fresh.newItem!, ...newItem } as never }] });
    expect(refusal(() => parseInvoiceInput(broken({ name: "" }), TODAY))).toMatchObject({ field: "lines.0.newItem.name" });
    expect(refusal(() => parseInvoiceInput(broken({ group: "wrapping" }), TODAY))).toMatchObject({
      code: "actions.costs.lineGroupRequired",
    });
    expect(refusal(() => parseInvoiceInput(broken({ one: "sheet" }), TODAY))).toMatchObject({ code: "actions.costs.lineOneRequired" });
    expect(refusal(() => parseInvoiceInput(broken({ unitsPerPack: 0 }), TODAY))).toMatchObject({
      field: "lines.0.newItem.unitsPerPack",
    });
  });

  it("refuses an amount that is surely a typing mistake", () => {
    expect(refusal(() => parseInvoiceInput(invoice({ deliveryAed: "999999" }), TODAY))).toMatchObject({
      code: "actions.costs.amountTooHigh",
      field: "deliveryAed",
    });
  });

  it("survives anything a browser could send", () => {
    for (const junk of [null, undefined, 42, "invoice", [], { lines: "x" }]) {
      expect(refusal(() => parseInvoiceInput(junk, TODAY)).code).toMatch(/^actions\.costs\./);
    }
  });
});
