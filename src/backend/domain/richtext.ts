/**
 * A product's full description, as the owner edits it: plain paragraphs.
 *
 * Payload stores the description as a Lexical rich-text document. The business
 * admin edits it as text with a blank line between paragraphs, which is all a
 * product story needs and removes a rich-text editor from the admin bundle.
 *
 * FORMATTING IS NEVER DESTROYED BY ACCIDENT. Converting a document with
 * headings or links to text and back would flatten them. So the server action
 * compares the submitted text with the stored document's text (see
 * `sameDescription`) and writes the description only when the words actually
 * changed. Saving a price change leaves the description document untouched.
 *
 * Pure — tested in richtext.test.ts.
 */

type LexicalText = {
  type: "text";
  version: 1;
  text: string;
  format: 0;
  detail: 0;
  mode: "normal";
  style: "";
};
type LexicalLineBreak = { type: "linebreak"; version: 1 };
type LexicalParagraph = {
  type: "paragraph";
  version: 1;
  direction: "ltr";
  format: "";
  indent: 0;
  textFormat: 0;
  textStyle: "";
  children: (LexicalText | LexicalLineBreak)[];
};

export type LexicalDocument = {
  root: {
    type: "root";
    version: 1;
    direction: "ltr";
    format: "";
    indent: 0;
    children: LexicalParagraph[];
  };
};

type NodeLike = { type?: unknown; text?: unknown; children?: unknown };

const isNode = (value: unknown): value is NodeLike =>
  typeof value === "object" && value !== null;

function nodeText(node: NodeLike): string {
  if (node.type === "linebreak") return "\n";
  if (node.type === "tab") return "\t";
  if (typeof node.text === "string") return node.text;
  if (!Array.isArray(node.children)) return "";
  /* List items sit on their own lines; everything else runs inline. */
  const separator = node.type === "list" ? "\n" : "";
  return node.children.filter(isNode).map(nodeText).join(separator);
}

/** The words in a stored description, blocks separated by a blank line. */
export function lexicalToPlainText(value: unknown): string {
  if (!isNode(value)) return "";
  const root = (value as { root?: unknown }).root;
  if (!isNode(root) || !Array.isArray(root.children)) return "";
  return root.children
    .filter(isNode)
    .map((block) => nodeText(block).trim())
    .filter(Boolean)
    .join("\n\n");
}

const textNode = (text: string): LexicalText => ({
  type: "text",
  version: 1,
  text,
  format: 0,
  detail: 0,
  mode: "normal",
  style: "",
});

/** Plain paragraphs to a Lexical document. Empty text is no description. */
export function plainTextToLexical(text: string): LexicalDocument | null {
  const normalised = text.replace(/\r\n?/g, "\n").trim();
  if (!normalised) return null;

  const paragraphs = normalised
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return {
    root: {
      type: "root",
      version: 1,
      direction: "ltr",
      format: "",
      indent: 0,
      children: paragraphs.map((paragraph) => ({
        type: "paragraph",
        version: 1,
        direction: "ltr",
        format: "",
        indent: 0,
        textFormat: 0,
        textStyle: "",
        children: paragraph
          .split("\n")
          .flatMap((line, i): (LexicalText | LexicalLineBreak)[] =>
            i === 0 ? [textNode(line)] : [{ type: "linebreak", version: 1 }, textNode(line)],
          ),
      })),
    },
  };
}

/** True when two descriptions say the same thing, ignoring whitespace noise. */
export function sameDescription(a: string, b: string): boolean {
  const normalise = (s: string) =>
    s
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  return normalise(a) === normalise(b);
}
