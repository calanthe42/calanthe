/*
 * A legal document, written as light Markdown in src/content/legal:
 *   `# `   the title (first line)
 *   `## `  a section heading
 *   a blank line separates paragraphs; a single newline is a line break
 *   `**bold**` and `*italic*` inline
 * Nothing else is supported, on purpose — this is the client's approved
 * wording, rendered as written, not a CMS.
 */
export type Block = { kind: "heading" | "para"; text: string };

export function parseLegal(source: string): { title: string; intro: Block[]; sections: { heading: string; body: Block[] }[] } {
  const blocks = source
    .trim()
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  let title = "";
  const intro: Block[] = [];
  const sections: { heading: string; body: Block[] }[] = [];
  for (const b of blocks) {
    if (b.startsWith("# ")) title = b.slice(2).trim();
    else if (b.startsWith("## ")) sections.push({ heading: b.slice(3).trim(), body: [] });
    else (sections.at(-1)?.body ?? intro).push({ kind: "para", text: b });
  }
  return { title, intro, sections };
}
