import path from "node:path";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

/**
 * Module-resolution hooks that teach plain Node the project's path aliases.
 *
 * WHY. The suites in this folder import application code, which imports
 * `@/lib/env`, `@backend/...` and `@payload-config`. Node knows nothing about
 * tsconfig `paths`, so every one of them failed with ERR_MODULE_NOT_FOUND
 * before reaching a single assertion. The alternative was a tsx dependency
 * for the sole purpose of resolving six prefixes.
 *
 * Node 22+ strips TypeScript types on its own, so this is the only piece
 * missing. It also fills in the extension: application code writes
 * `./product-form` where the file is `product-form.ts`, which is legal in
 * TypeScript and not in ESM.
 *
 * MUST STAY IN STEP with `paths` in tsconfig.json and `resolve.alias` in
 * vitest.config.ts. Three copies of six lines is the cost of three different
 * runtimes; the alternative is a build step for a test script.
 */

const ROOT = path.resolve(import.meta.dirname, "..");

/* Longest prefix first: "@payload-config" must be tried before "@/". */
const ALIASES = [
  ["@payload-config", "src/payload.config.ts"],
  ["@frontend/", "src/frontend/"],
  ["@backend/", "src/backend/"],
  ["@admin/", "src/admin/"],
  ["@shared/", "src/shared/"],
  ["@/", "src/"],
];

const EXTENSIONS = [".ts", ".tsx", ".mts", ".js", ".mjs"];

/** An alias hit gives a path with no extension; find the file it means. */
function resolveFile(candidate) {
  if (existsSync(candidate) && path.extname(candidate)) return candidate;
  for (const ext of EXTENSIONS) {
    if (existsSync(candidate + ext)) return candidate + ext;
  }
  for (const ext of EXTENSIONS) {
    const index = path.join(candidate, `index${ext}`);
    if (existsSync(index)) return index;
  }
  return null;
}

export async function resolve(specifier, context, next) {
  for (const [prefix, target] of ALIASES) {
    const exact = specifier === prefix;
    if (!exact && !specifier.startsWith(prefix)) continue;

    const candidate = exact
      ? path.join(ROOT, target)
      : path.join(ROOT, target, specifier.slice(prefix.length));

    const file = resolveFile(candidate);
    if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
  }

  /* A relative import TypeScript would resolve for us. This used to be
     guarded by `!path.extname(specifier)`, which quietly excluded the one
     import every suite needs: `../src/payload.config` has an "extension" of
     ".config" as far as path.extname is concerned, so the hook declined it
     and Node failed on the real file, payload.config.ts. resolveFile returns
     null when nothing matches, so a genuine ESM specifier still falls
     through to Node untouched. */
  if (specifier.startsWith(".") && context.parentURL) {
    const parent = path.dirname(new URL(context.parentURL).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
    const file = resolveFile(path.resolve(parent, specifier));
    if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
  }

  return next(specifier, context);
}
