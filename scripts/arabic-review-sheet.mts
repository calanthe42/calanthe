/**
 * Every customer-facing string, English beside Arabic, for a native speaker
 * to correct.
 *
 * WHY THIS EXISTS. I write the Arabic in this project, and a native reader
 * found errors in it. No amount of me re-reading my own work fixes that —
 * the only reliable check is the person who speaks the language. So this
 * produces one file she can go through line by line, with the English
 * original beside each string so she can see what it is *meant* to say, and
 * a blank column to write the correction in.
 *
 * It also flags, mechanically, the things most likely to be wrong:
 *   MISSING      the Arabic is absent — the site shows English here
 *   IDENTICAL    Arabic equals English — almost always untranslated
 *   LATIN        Latin letters inside an Arabic string
 *   PLACEHOLDER  a {token} present in one language and lost in the other,
 *                which breaks the sentence at runtime
 *
 * Run:
 *   node --import ./scripts/register-aliases.mjs scripts/arabic-review-sheet.mts
 *
 * A developer utility: never imported by the application.
 */
import { writeFileSync } from "node:fs";
import { ar, en } from "../src/lib/i18n/dictionary.ts";

type Node = Record<string, unknown>;

const rows: {
  path: string;
  en: string;
  ar: string;
  flags: string[];
}[] = [];

const ARABIC = /[؀-ۿ]/;
const LATIN = /[A-Za-z]{2,}/;
const TOKEN = /\{[a-zA-Z]+\}/g;

/*
 * The same exceptions the dictionary's own test makes (see
 * src/lib/i18n/dictionary.test.ts), so the sheet and the test agree about
 * what counts as a problem:
 *   - a currency code, a brand, an app and the two Greek words the About
 *     page is explaining stay in Latin script on purpose;
 *   - Arabic names one and two in words ("باقة واحدة", "باقتان"), so
 *     those plural forms legitimately have no {n};
 *   - a phone number or an email example is the same in any language.
 */
const KEPT_IN_LATIN = /\b(AED|WhatsApp|Instagram|Calanthe|CALANTHE|kalos|anthos)\b/g;
const NOT_PROSE = new Set(["checkout.emailPlaceholder"]);
const hasNoWords = (text: string) => !/\p{L}/u.test(text);

function walk(en: Node, ar: Node, prefix: string): void {
  for (const [key, value] of Object.entries(en)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const other = (ar ?? {})[key];

    if (typeof value === "string") {
      const arabic = typeof other === "string" ? other : "";
      const flags: string[] = [];

      /*
       * A language switcher says "English" in English and "العربية" in
       * Arabic — that is the point of it, not a missing translation. And a
       * {token} is replaced at runtime, so its Latin letters are not Latin
       * text in the sentence. Both were flagged on the first run, all twelve
       * of them wrongly, which is exactly how a review sheet trains someone
       * to ignore it.
       */
      const isLanguageName = path.startsWith("language.");
      const exempt = isLanguageName || NOT_PROSE.has(path) || hasNoWords(value);
      const namesCountInWords = /\.(one|two)$/.test(path);
      const withoutTokens = arabic.replace(TOKEN, "").replace(KEPT_IN_LATIN, "");

      if (!arabic) flags.push("MISSING");
      else if (!exempt) {
        if (arabic.trim() === value.trim()) flags.push("IDENTICAL");
        if (!ARABIC.test(withoutTokens)) flags.push("NO-ARABIC");
        else if (LATIN.test(withoutTokens)) flags.push("LATIN");

        const enTokens = (value.match(TOKEN) ?? []).sort().join(",");
        const arTokens = (arabic.match(TOKEN) ?? []).sort().join(",");
        /* A plural's one/two form may drop {n}, but may never invent one. */
        const lost = enTokens !== arTokens;
        const invented = (arabic.match(TOKEN) ?? []).some((tok) => !value.includes(tok));
        if (namesCountInWords ? invented : lost) flags.push("PLACEHOLDER");
      }

      rows.push({ path, en: value, ar: arabic, flags });
      continue;
    }

    /* Arrays are walked as objects keyed "0", "1", … — the FAQ answers, the
       event lists and the tier contents are all arrays, and an earlier
       version skipped them, so none of that Arabic reached the reviewer. */
    if (value && typeof value === "object") {
      walk(value as Node, (other ?? {}) as Node, path);
    }
  }
}

walk(en as unknown as Node, ar as unknown as Node, "");

const flagged = rows.filter((r) => r.flags.length > 0);

const lines: string[] = [];
lines.push("CALANTHE — ARABIC REVIEW SHEET");
lines.push("");
lines.push("How to use this: read the Arabic against the English. Where it is wrong,");
lines.push("write the correct Arabic on the CORRECTION line. Leave it blank if the");
lines.push("Arabic is right. Nothing else needs filling in.");
lines.push("");
lines.push("A {word} in braces is replaced at runtime by a real value — a price, a");
lines.push("name, a number. Keep it exactly as written, but move it to wherever it");
lines.push("belongs in the Arabic sentence.");
lines.push("");
lines.push(
  `${rows.length} strings in total. ${flagged.length} are flagged below as likely problems.`,
);
lines.push("");

if (flagged.length > 0) {
  lines.push("=".repeat(72));
  lines.push("FLAGGED FIRST — these are probably wrong");
  lines.push("=".repeat(72));
  lines.push("");
  for (const r of flagged) {
    lines.push(`[${r.flags.join(" ")}]  ${r.path}`);
    lines.push(`  ENGLISH    ${r.en}`);
    lines.push(`  ARABIC     ${r.ar || "— nothing, the site shows the English —"}`);
    lines.push(`  CORRECTION `);
    lines.push("");
  }
}

lines.push("=".repeat(72));
lines.push("EVERYTHING ELSE");
lines.push("=".repeat(72));
lines.push("");
let section = "";
for (const r of rows) {
  if (r.flags.length > 0) continue;
  const top = r.path.split(".")[0];
  if (top !== section) {
    section = top;
    lines.push("");
    lines.push(`--- ${section} ---`);
    lines.push("");
  }
  lines.push(`${r.path}`);
  lines.push(`  ENGLISH    ${r.en}`);
  lines.push(`  ARABIC     ${r.ar}`);
  lines.push(`  CORRECTION `);
  lines.push("");
}

writeFileSync("docs/reports/arabic-review-sheet.txt", lines.join("\n"), "utf8");

console.log(`${rows.length} strings, ${flagged.length} flagged`);
const counts = new Map<string, number>();
for (const r of flagged) for (const f of r.flags) counts.set(f, (counts.get(f) ?? 0) + 1);
for (const [flag, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)}  ${flag}`);
}
console.log("\nwritten: docs/reports/arabic-review-sheet.txt");
