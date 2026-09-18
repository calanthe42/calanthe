import { describe, expect, it } from "vitest";
import { lexicalToPlainText, plainTextToLexical, sameDescription } from "./richtext";

describe("plain paragraphs <-> Lexical description", () => {
  it("round-trips paragraphs and line breaks", () => {
    const text = "Warm garden roses.\nHand-tied.\n\nDelivered the same day.";
    const doc = plainTextToLexical(text);
    expect(doc?.root.children).toHaveLength(2);
    expect(lexicalToPlainText(doc)).toBe(text);
  });

  it("stores nothing for empty text", () => {
    expect(plainTextToLexical("   \n\n ")).toBeNull();
    expect(lexicalToPlainText(null)).toBe("");
    expect(lexicalToPlainText({ unexpected: true })).toBe("");
  });

  it("reads the words out of richer documents it did not write", () => {
    const rich = {
      root: {
        type: "root",
        children: [
          { type: "heading", children: [{ type: "text", text: "The story" }] },
          {
            type: "paragraph",
            children: [
              { type: "text", text: "Picked at " },
              { type: "link", children: [{ type: "text", text: "dawn" }] },
              { type: "text", text: "." },
            ],
          },
          {
            type: "list",
            children: [
              { type: "listitem", children: [{ type: "text", text: "Roses" }] },
              { type: "listitem", children: [{ type: "text", text: "Ranunculus" }] },
            ],
          },
        ],
      },
    };
    expect(lexicalToPlainText(rich)).toBe("The story\n\nPicked at dawn.\n\nRoses\nRanunculus");
  });

  it("treats whitespace-only differences as the same description", () => {
    expect(sameDescription("One.\r\n\r\n\r\nTwo.  ", "One.\n\nTwo.")).toBe(true);
    expect(sameDescription("One.", "One!")).toBe(false);
  });
});
