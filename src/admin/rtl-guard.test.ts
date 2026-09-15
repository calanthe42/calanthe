import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The admin must lay out correctly in Arabic.
 *
 * Right-to-left works only if nothing is positioned by "left" or "right".
 * Tailwind's logical utilities — ms/me, ps/pe, start/end, text-start/end,
 * border-s/e, rounded-s/e — follow the reading direction; ml, pl, left-0,
 * text-left and friends do not, and one of them is enough to break a screen
 * in Arabic while looking perfect in English.
 *
 * This test reads every admin component and fails, naming the file and line,
 * if a physical-direction class appears. Only string literals are checked, so
 * a comment that says "right-to-left" is not a violation.
 */

const ROOTS = ["src/admin", "src/app/(admin)"];
/* The dictionaries are prose, not class names. */
const SKIP = [path.join("src", "admin", "i18n")];

/* Direction-bound utilities that always take a value: ml-4, left-0, -mr-2. */
const WITH_VALUE = /^-?(?:ml|mr|pl|pr|left|right|scroll-ml|scroll-mr|scroll-pl|scroll-pr|space-x|divide-x)-\S+$/;
/* Direction-bound utilities that may stand alone: border-l, rounded-r, text-left. */
const STANDALONE =
  /^(?:border-l|border-r|rounded-l|rounded-r|rounded-tl|rounded-tr|rounded-bl|rounded-br)(?:-\S+)?$|^(?:text-left|text-right|float-left|float-right|clear-left|clear-right)$/;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (SKIP.some((skip) => full.startsWith(skip))) return [];
    if (statSync(full).isDirectory()) return files(full);
    return /\.tsx?$/.test(name) && !name.endsWith(".test.ts") ? [full] : [];
  });
}

/** Blank out comments while keeping line numbers. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (match, lead: string) => lead + " ".repeat(match.length - lead.length));
}

function violations(file: string): string[] {
  const source = stripComments(readFileSync(file, "utf8"));
  const found: string[] = [];
  for (const literal of source.matchAll(/"([^"\n]*)"|'([^'\n]*)'|`([^`]*)`/g)) {
    const text = literal[1] ?? literal[2] ?? literal[3] ?? "";
    for (const token of text.split(/\s+/)) {
      /* Strip variants like md:, hover:, rtl:, [&_a]: and the ! modifier. */
      const utility = token.replace(/^(?:[\w-]+:|\[[^\]]*\]:)+/, "").replace(/^!/, "");
      if (WITH_VALUE.test(utility) || STANDALONE.test(utility)) {
        const line = source.slice(0, literal.index).split("\n").length;
        found.push(`${file}:${line}  ${token}`);
      }
    }
  }
  return found;
}

describe("right-to-left safety", () => {
  it("uses only logical (start/end) layout classes in the admin", () => {
    const all = ROOTS.flatMap((root) => files(root)).flatMap(violations);
    expect(all, `Use ms/me, ps/pe, start/end, text-start/end, border-s/e instead:\n${all.join("\n")}`).toEqual([]);
  });

  it("recognises the classes it guards against (self-check)", () => {
    for (const bad of ["ml-2", "-mr-3", "pl-12", "left-0", "right-1.5", "text-left", "border-l", "rounded-tr-md", "space-x-2", "md:pr-4"]) {
      const utility = bad.replace(/^(?:[\w-]+:)+/, "");
      expect(WITH_VALUE.test(utility) || STANDALONE.test(utility), bad).toBe(true);
    }
    for (const fine of ["ms-2", "pe-9", "start-3", "text-start", "border-s", "rounded-md", "translate-x-4", "leading-tight", "rtl", "left", "right"]) {
      expect(WITH_VALUE.test(fine) || STANDALONE.test(fine), fine).toBe(false);
    }
  });
});
