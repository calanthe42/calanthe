/**
 * Every English word the storefront still shows an Arabic reader.
 *
 * WHY THIS EXISTS. A native Arabic reader went through the live site and
 * found it wrong in many places. The first assumption was that the
 * translations were bad. They were not, mostly: the dictionary held 265
 * strings and only about a dozen had real defects. What she was actually
 * seeing was English — text written straight into a component, which no
 * dictionary entry exists for and no `dir="rtl"` can fix.
 *
 * Counting that by eye does not work. Grepping for `>Text<` on one line does
 * not work either: Prettier wraps JSX prose onto its own lines, so a whole
 * page of untranslated copy shows up as one stray `<Eyebrow>` and nothing
 * else. That is exactly how the About page read as "five strings" when in
 * truth it was English top to bottom.
 *
 * So this reads text nodes across line breaks, and reports what is left.
 *
 * Run:
 *   node --import ./scripts/register-aliases.mjs scripts/untranslated.mts
 *   node --import ./scripts/register-aliases.mjs scripts/untranslated.mts --list
 *
 * A developer utility: never imported by the application.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/*
 * `src/lib` is in here because copy lives there too: `siteFaq` is the entire
 * FAQ page, and `deliveryZones`, `sizes` and `addons` are read by a customer
 * on the pages that take her money. Leaving it out is how the FAQ page read
 * as "three strings" when it is nine questions and nine answers.
 */
const ROOTS = ["src/components", "src/app/(frontend)", "src/lib"];

/*
 * Not customer-facing, so English in them is not a defect:
 *   style-check  a developer's colour and type reference
 *   JsonLd       structured data for search engines, which reads English
 */
const IGNORED = [/style-check/, /JsonLd/, /lib[\/]i18n[\/]/];

/*
 * UNREACHABLE COMPONENTS, counted separately.
 *
 * None of these is imported anywhere, so nothing in them is on the site and
 * translating them would be work with no reader. They are listed rather than
 * simply skipped because two of them are worth deleting on their own merits:
 * AccountClient renders `mockOrders` and two invented addresses ("Villa 14,
 * Street 8b, Jumeirah 1"), so if it were ever wired to a route it would show
 * a customer a fabricated order history.
 */
const UNREACHABLE = [/AccountClient/, /LoginFlow/, /CustomerLogin/];

/** Attributes whose value is read by a person or a screen reader. */
const ATTRS =
  /\b(placeholder|aria-label|title|alt|label|loadingText|emptyText)="([^"{}]+)"/g;

/*
 * The same attributes written as template literals:
 * aria-label={`Add ${addon.name} to ${last.name}`}. The `${…}` parts are
 * values; the words around them are the English this is looking for.
 */
const TEMPLATE_ATTRS =
  /\b(placeholder|aria-label|title|alt|label|loadingText)=\{`([^`]*)`\}/g;

type Finding = {
  file: string;
  line: number;
  kind: "text" | "attr" | "data";
  text: string;
};

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path) ? [path] : [];
  });
}

/**
 * Blank out everything that is not JSX prose, keeping the byte offsets so
 * line numbers stay true: comments, string literals in code, and template
 * literals. Replacing rather than deleting is what makes the offsets usable.
 */
function mask(source: string): string {
  let out = source;
  const blank = (m: string) => m.replace(/[^\n]/g, " ");
  out = out.replace(/\{\/\*[\s\S]*?\*\/\}/g, blank); // {/* jsx comment */}
  out = out.replace(/\/\*[\s\S]*?\*\//g, blank); // /* block */
  out = out.replace(/\/\/[^\n]*/g, blank); // // line
  return out;
}

/**
 * Source code that merely looks like a text node.
 *
 * `useState<Thing | null>(null)` contains a `>` and a `<`, so the text pass
 * reads the code between them as page copy. So do conditional renders:
 * `) : done ? (`. Both were reported on the first run, which is the fastest
 * way to make a report like this worth ignoring.
 */
const LOOKS_LIKE_CODE =
  /=>|===|\|\||&&|\?\?|;|\bconst\b|\breturn\b|\buse[A-Z]\w*\(|^\s*[)(]|[)(]\s*$/;

/** Text with at least one real word in it, rather than punctuation or a number. */
function isProse(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 3) return false;
  if (!/[A-Za-z]{3}/.test(trimmed)) return false;
  /* An entity or a lone symbol is not copy. */
  if (/^&[a-z]+;$/.test(trimmed)) return false;
  if (LOOKS_LIKE_CODE.test(trimmed)) return false;
  return true;
}

/**
 * A sentence a customer would read, as opposed to a class list, a path, a
 * CSS value or an identifier that merely happens to contain spaces.
 */
function isCopy(text: string): boolean {
  if (/[/\\]/.test(text)) return false; // a path or a URL
  if (/^[a-z-]+(\s+[a-z0-9:[\]/.%-]+)+$/.test(text)) return false; // tailwind
  if (/(^|\s)(text|bg|mt|mb|px|py|flex|grid|w|h|rounded|border|font)-/.test(text)) {
    return false;
  }
  if (/^[\d\s.,+()-]+$/.test(text)) return false; // a number or a phone
  /* Real copy has at least two words and a capital or a full stop. */
  const words = text.trim().split(/\s+/);
  if (words.length < 2) return false;
  return /[A-Z]/.test(text) || /[.?!]/.test(text);
}

const findings: Finding[] = [];

for (const root of ROOTS) {
  for (const file of walk(root)) {
    const rel = relative(".", file).replace(/\\/g, "/");
    if (IGNORED.some((re) => re.test(rel))) continue;

    const raw = readFileSync(file, "utf8");
    const masked = mask(raw);
    const lineOf = (index: number) => raw.slice(0, index).split("\n").length;

    /*
     * A JSX text node: between a `>` and a `<`, with no braces inside — a
     * brace would mean an expression, and `{t.x}` is precisely what we are
     * looking for the ABSENCE of. The `s` flag is the point of this script:
     * the text is usually on its own line, wrapped by Prettier.
     */
    for (const m of masked.matchAll(/>([^<>{}]+)</gs)) {
      const text = m[1] ?? "";
      if (!isProse(text)) continue;
      findings.push({
        file: rel,
        line: lineOf((m.index ?? 0) + 1),
        kind: "text",
        text: text.replace(/\s+/g, " ").trim(),
      });
    }

    /*
     * Text sitting beside an expression: `Begin {tier.name}`,
     * `Delivery{zone ? … : ""}`. The pass above refuses any text node with a
     * brace in it (a brace means an expression, and `{t.x}` is what a
     * translated node looks like), so it walked straight past the English
     * word on either side of one. Here the expressions are cut out and
     * whatever prose is left over is reported.
     */
    for (const m of masked.matchAll(/>((?:[^<>{}]|\{[^{}]*\})+)</gs)) {
      const whole = m[1] ?? "";
      if (!whole.includes("{")) continue; // the plain pass already has it
      for (const piece of whole.split(/\{[^{}]*\}/)) {
        if (!isProse(piece)) continue;
        findings.push({
          file: rel,
          line: lineOf((m.index ?? 0) + 1),
          kind: "text",
          text: `${piece.replace(/\s+/g, " ").trim()}  (beside an expression)`,
        });
      }
    }

    for (const m of masked.matchAll(TEMPLATE_ATTRS)) {
      const prose = (m[2] ?? "").replace(/\$\{[^}]*\}/g, " ");
      if (!isProse(prose)) continue;
      findings.push({
        file: rel,
        line: lineOf(m.index ?? 0),
        kind: "attr",
        text: `${m[1]}={\`${m[2]}\`}`,
      });
    }

    for (const m of masked.matchAll(ATTRS)) {
      const text = m[2] ?? "";
      if (!isProse(text)) continue;
      findings.push({
        file: rel,
        line: lineOf(m.index ?? 0),
        kind: "attr",
        text: `${m[1]}="${text}"`,
      });
    }

    /*
     * Headline text passed as an array of lines.
     *
     * `<SplitLines lines={["Nothing leaves", "this atelier open."]} />` is how
     * every animated headline on this site is written. It is neither a text
     * node nor a `key: "value"` pair, so both passes above walk straight past
     * it — and it is the largest type on the page.
     */
    for (const m of masked.matchAll(/\blines=\{\[([^\]]+)\]\}/g)) {
      for (const q of (m[1] ?? "").matchAll(/"([^"\\]+)"/g)) {
        const text = q[1] ?? "";
        if (!isProse(text)) continue;
        findings.push({
          file: rel,
          line: lineOf(m.index ?? 0),
          kind: "text",
          text: `line: "${text}"`,
        });
      }
    }

    /*
     * Prose in a data structure, not in the markup.
     *
     * Several pages keep their copy in a `const` array at the top of the file
     * and map over it — `{ name: "Corporate", copy: "Florals and gifting
     * solutions for offices…" }`. None of that is a JSX text node, so the
     * two passes above cannot see it, and the About page read as five stray
     * labels when it was in fact English from top to bottom. This is the
     * pass that finds it.
     */
    for (const m of masked.matchAll(/(\w+):\s*"([^"\\]{12,})"/g)) {
      const text = m[2] ?? "";
      if (!isProse(text) || !isCopy(text)) continue;
      findings.push({
        file: rel,
        line: lineOf(m.index ?? 0),
        kind: "data",
        text: `${m[1]}: "${text}"`,
      });
    }
  }
}

const isDead = (file: string) => UNREACHABLE.some((re) => re.test(file));
const live = findings.filter((f) => !isDead(f.file));
const dead = findings.filter((f) => isDead(f.file));

const byFile = new Map<string, Finding[]>();
for (const f of live) {
  const list = byFile.get(f.file) ?? [];
  list.push(f);
  byFile.set(f.file, list);
}

const ranked = [...byFile.entries()].sort((a, b) => b[1].length - a[1].length);
const list = process.argv.includes("--list");

console.log(`${live.length} untranslated strings in ${byFile.size} files\n`);
for (const [file, items] of ranked) {
  console.log(`${String(items.length).padStart(4)}  ${file}`);
  if (!list) continue;
  for (const item of items) {
    const text = item.text.length > 96 ? `${item.text.slice(0, 96)}…` : item.text;
    console.log(`        ${String(item.line).padStart(4)}  ${text}`);
  }
  console.log();
}

if (dead.length > 0) {
  const files = [...new Set(dead.map((f) => f.file))];
  console.log(
    `Plus ${dead.length} strings in ${files.length} component(s) nothing imports,`,
  );
  console.log("so they are not on the site and are not counted above:\n");
  for (const file of files) console.log(`      ${file}`);
  console.log("\nWorth deleting rather than translating — see UNREACHABLE above.");
}
