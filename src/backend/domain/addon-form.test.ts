import { describe, expect, it } from "vitest";
import { DEFAULT_ADDONS } from "@/lib/store-settings";
import { AddonInputError, addonPriceFils, keyFromName, parseAddonsForm } from "./addon-form";

/**
 * The owner's add-ons screen, read into the list the server saves: what she
 * may type, what she is told when it is wrong, and the keys — which never
 * change once made, and which a browser cannot choose.
 */

type Sent = { key?: unknown; nameEn?: unknown; nameAr?: unknown; priceAed?: unknown; active?: unknown };
const send = (rows: Sent[]) => JSON.stringify(rows);
const today = (): Sent[] =>
  DEFAULT_ADDONS.map((a) => ({ key: a.key, nameEn: a.nameEn, nameAr: a.nameAr, priceAed: String(a.priceFils / 100), active: true }));

function refusal(raw: string, current = DEFAULT_ADDONS): AddonInputError {
  try {
    parseAddonsForm(raw, current);
  } catch (error) {
    if (error instanceof AddonInputError) return error;
    throw error;
  }
  throw new Error("expected a refusal");
}

describe("what she typed, as it is saved", () => {
  it("saves today's list exactly as it is", () => {
    expect(parseAddonsForm(send(today()), DEFAULT_ADDONS)).toEqual(DEFAULT_ADDONS);
  });

  it("takes prices in dirhams and saves them in fils", () => {
    for (const [typed, fils] of [["150", 15_000], ["12.5", 1_250], ["12.50", 1_250], ["1,500", 150_000], ["AED 25", 2_500], ["0", 0], ["10000", 1_000_000]] as const) {
      expect(addonPriceFils(typed), typed).toBe(fils);
    }
    for (const typed of ["", "-5", "12.555", "ten", "10000.01", undefined]) {
      expect(addonPriceFils(typed), String(typed)).toBeNull();
    }
  });

  it("tidies the spaces in a name and keeps a switched-off one, switched off", () => {
    const rows = today();
    rows[0] = { ...rows[0], nameEn: "  Glass   vase ", active: false };
    const [vase] = parseAddonsForm(send(rows), DEFAULT_ADDONS);
    expect(vase).toMatchObject({ key: "vase", nameEn: "Glass vase", active: false });
  });

  it("saves them in the order she left them", () => {
    const rows = today().reverse();
    expect(parseAddonsForm(send(rows), DEFAULT_ADDONS).map((a) => a.key)).toEqual(["polaroid", "teddy", "cake", "balloon", "vase"]);
  });
});

describe("refused, in a sentence", () => {
  it("names required in both languages", () => {
    const noEnglish = today();
    noEnglish[2] = { ...noEnglish[2], nameEn: "  " };
    expect(refusal(send(noEnglish))).toMatchObject({ code: "actions.addons.nameEnRequired", vars: { n: 3 } });
    const noArabic = today();
    noArabic[0] = { ...noArabic[0], nameAr: "" };
    expect(refusal(send(noArabic))).toMatchObject({
      code: "actions.addons.nameArRequired",
      message: "Add-on 1: write its name in Arabic.",
    });
  });

  it("a name that is too long", () => {
    const rows = today();
    rows[1] = { ...rows[1], nameAr: "ب".repeat(41) };
    expect(refusal(send(rows))).toMatchObject({ code: "actions.addons.nameTooLong", vars: { n: 2, max: 40 } });
  });

  it("a price outside AED 0 – 10,000", () => {
    for (const priceAed of ["-1", "10000.50", "", "a lot"]) {
      const rows = today();
      rows[4] = { ...rows[4], priceAed };
      expect(refusal(send(rows)), priceAed).toMatchObject({ code: "actions.addons.priceRange", vars: { n: 5 } });
    }
  });

  it("more than 12 add-ons", () => {
    const rows = Array.from({ length: 13 }, (_, i) => ({ nameEn: `Extra ${i}`, nameAr: `إضافة ${i}`, priceAed: "10" }));
    expect(refusal(send(rows))).toMatchObject({ code: "actions.addons.tooMany", vars: { max: 12 } });
    expect(parseAddonsForm(send(rows.slice(0, 12)), DEFAULT_ADDONS)).toHaveLength(12);
  });

  it("an empty list — which would bring the defaults back", () => {
    expect(refusal(send([]))).toMatchObject({ code: "actions.addons.atLeastOne" });
  });

  it("two add-ons with the same name", () => {
    const rows = [...today(), { nameEn: "VASE", nameAr: "مزهرية أخرى", priceAed: "90" }];
    expect(refusal(send(rows))).toMatchObject({ code: "actions.addons.nameTwice", vars: { name: "VASE" } });
  });

  it("anything that is not the screen's list", () => {
    for (const raw of ["", "not json", "{}", "[1, 2]", "null"]) {
      expect(refusal(raw), raw).toMatchObject({ code: "actions.addons.unreadable" });
    }
  });
});

describe("keys never change, and the browser cannot choose one", () => {
  it("a renamed and repriced add-on keeps its key", () => {
    const rows = today();
    rows[0] = { ...rows[0], nameEn: "Ceramic jar", nameAr: "جرة خزفية", priceAed: "160" };
    expect(parseAddonsForm(send(rows), DEFAULT_ADDONS)[0]).toEqual({
      key: "vase",
      nameEn: "Ceramic jar",
      nameAr: "جرة خزفية",
      priceFils: 16_000,
      active: true,
    });
  });

  it("a new add-on gets a key made from its English name", () => {
    const rows = [...today(), { nameEn: "Silk Ribbon", nameAr: "شريط حرير", priceAed: "12.50" }];
    expect(parseAddonsForm(send(rows), DEFAULT_ADDONS).at(-1)).toMatchObject({ key: "silk-ribbon", priceFils: 1_250 });
  });

  it("made unique — even against a kept key further down the list", () => {
    const rows = [{ nameEn: "Vase!", nameAr: "مزهرية كبيرة", priceAed: "200" }, ...today()];
    const keys = parseAddonsForm(send(rows), DEFAULT_ADDONS).map((a) => a.key);
    expect(keys).toEqual(["vase-2", "vase", "balloon", "cake", "teddy", "polaroid"]);
  });

  it("a key she does not have is not taken from the browser — the row is new", () => {
    const rows = [...today(), { key: "admin", nameEn: "Card", nameAr: "بطاقة", priceAed: "5" }];
    expect(parseAddonsForm(send(rows), DEFAULT_ADDONS).at(-1)!.key).toBe("card");
  });

  it("a key sent twice is kept once: the second row is new", () => {
    const rows = [...today(), { key: "vase", nameEn: "Small vase", nameAr: "مزهرية صغيرة", priceAed: "50" }];
    const list = parseAddonsForm(send(rows), DEFAULT_ADDONS);
    expect(list[0]!.key).toBe("vase");
    expect(list.at(-1)!.key).toBe("small-vase");
  });

  it("checks keys against her list as it is saved now", () => {
    const hers = [{ key: "silk-ribbon", nameEn: "Silk ribbon", nameAr: "شريط حرير", priceFils: 1_250, active: true }];
    const rows = [{ key: "silk-ribbon", nameEn: "Satin ribbon", nameAr: "شريط ساتان", priceAed: "15" }];
    expect(parseAddonsForm(send(rows), hers)[0]!.key).toBe("silk-ribbon");
    /* The same row sent against the defaults is a new one. */
    expect(parseAddonsForm(send(rows), DEFAULT_ADDONS)[0]!.key).toBe("satin-ribbon");
  });

  it("keyFromName: plain words, accents dropped, no letters at all is 'addon'", () => {
    const none = new Set<string>();
    expect(keyFromName("Bento Cake", none)).toBe("bento-cake");
    expect(keyFromName("Crème brûlée", none)).toBe("creme-brulee");
    expect(keyFromName("مزهرية", none)).toBe("addon");
    expect(keyFromName("x".repeat(60), none)).toHaveLength(40);
    expect(keyFromName("Vase", new Set(["vase", "vase-2"]))).toBe("vase-3");
    expect(keyFromName("x".repeat(60), new Set(["x".repeat(40)]))).toBe(`${"x".repeat(38)}-2`);
  });
});
