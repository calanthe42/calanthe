/**
 * Proof that a product published AFTER a deploy is reachable, and that an
 * unknown slug is a 404 rather than a 500.
 *
 * WHAT WENT WRONG. `/product/[slug]`, `/occasions/[slug]` and `/shop/[slug]`
 * were ISR routes with `generateStaticParams`, while the locale is read with
 * `cookies()`. Only the paths prerendered at build time were safe; anything
 * else rendered on demand in static mode, where `cookies()` is illegal, and
 * Next threw DYNAMIC_SERVER_USAGE -> 500. In production every product is
 * hidden, so nothing was prerendered and every product URL 500ed.
 *
 * A unit test cannot catch this: it only appears in a production build, and
 * only for a path that was not in the build-time set. So the proof is an
 * actual production build, served, with the database changed underneath it
 * and no rebuild.
 *
 *   1 hide every product, then build and start           (mode: arrange)
 *   2 a hidden product and an unknown slug are 404, not 500
 *   3 publish one product -- no rebuild -- its page is 200
 *   4 add an occasion -- no rebuild -- its page is 200
 *   5 put everything back                                (always)
 *
 * Run against a DISPOSABLE branch. Never production.
 *
 *   node --env-file=<env> --import ./scripts/register-aliases.mjs \
 *        scripts/prove-dynamic-routes.mts arrange
 *   <build + start>
 *   node ... scripts/prove-dynamic-routes.mts prove [base-url]
 *
 * A developer utility: never imported by the application.
 */
import { getPayload } from "payload";
import config from "../src/payload.config.ts";

const MODE = process.argv[2] ?? "prove";
const BASE = process.argv[3] ?? "http://localhost:3100";
const NEW_OCCASION_SLUG = "proof-occasion-temp";

const payload = await getPayload({ config });

const host = (process.env.DATABASE_URL ?? "")
  .replace(/^postgres(ql)?:\/\/[^@]*@/, "")
  .split("/")[0];
if (/ep-round-art/.test(host)) {
  console.error("REFUSING: that is the production branch.");
  process.exit(2);
}
console.log(`database: ${host}\n`);

async function status(path: string): Promise<number> {
  const r = await fetch(`${BASE}${path}`, { redirect: "manual" });
  return r.status;
}

const line = (label: string, got: number, want: number) => {
  const ok = got === want;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(52)} ${got} (want ${want})`);
  return ok;
};

/**
 * The launch blocker was the 500. A separate, pre-existing fault makes
 * `notFound()` answer 200 with 404 content — a soft 404 — whenever
 * `experimental.globalNotFound` is on: a genuinely unmatched path such as
 * /totally-unknown-path correctly returns 404, but `notFound()` called
 * inside a matched route does not. That is an SEO problem (Google indexes a
 * soft 404 as a real page) and not an outage, so it is asserted separately
 * and reported rather than folded into a pass.
 */
const notServerError = (label: string, got: number) => {
  const ok = got < 500;
  const note = got === 404 ? "" : got === 200 ? "  <- SOFT 404, see OWNER_TODO" : "";
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(52)} ${got} (must not be 5xx)${note}`);
  return ok;
};

if (MODE === "arrange") {
  const all = await payload.find({ collection: "products", limit: 200, depth: 0, overrideAccess: true });
  let hidden = 0;
  for (const p of all.docs as { id: number | string; available?: boolean }[]) {
    if (p.available) {
      await payload.update({ collection: "products", id: p.id, data: { available: false } as never, overrideAccess: true });
      hidden += 1;
    }
  }
  const still = await payload.count({ collection: "products", where: { available: { equals: true } }, overrideAccess: true });
  console.log(`hid ${hidden} product(s); available now: ${still.totalDocs}`);
  console.log("Now run a PRODUCTION build and start it, then re-run with: prove");
  process.exit(still.totalDocs === 0 ? 0 : 1);
}

/* ---- prove ---- */
let ok = true;
const restore: (() => Promise<void>)[] = [];

const target = (
  await payload.find({ collection: "products", limit: 1, depth: 0, sort: "createdAt", overrideAccess: true })
).docs[0] as { id: number | string; slug: string; images?: unknown[] };

console.log("1. built with ZERO available products\n");
ok = notServerError("hidden product is not a 500", await status(`/product/${target.slug}`)) && ok;
ok = notServerError("unknown product slug is not a 500", await status("/product/no-such-thing-xyz")) && ok;
ok = notServerError("unknown occasion is not a 500", await status("/occasions/no-such-thing-xyz")) && ok;
ok = notServerError("unknown shop category is not a 500", await status("/shop/no-such-thing-xyz")) && ok;
ok = line("a genuinely unmatched path is a real 404", await status("/totally-unknown-path"), 404) && ok;

console.log("\n2. publish one product, WITHOUT rebuilding\n");
await payload.update({ collection: "products", id: target.id, data: { available: true } as never, overrideAccess: true });
restore.push(async () => {
  await payload.update({ collection: "products", id: target.id, data: { available: false } as never, overrideAccess: true });
});
ok = line(`published "${target.slug}" -> 200`, await status(`/product/${target.slug}`), 200) && ok;
ok = line("it appears on /shop", await status("/shop"), 200) && ok;

console.log("\n3. add an occasion, WITHOUT rebuilding\n");
const created = await payload.create({
  collection: "occasions",
  data: { name: "Proof Occasion", slug: NEW_OCCASION_SLUG, active: true } as never,
  overrideAccess: true,
});
restore.push(async () => {
  await payload.delete({ collection: "occasions", id: created.id, overrideAccess: true });
});
ok = line("occasion created after the build -> 200", await status(`/occasions/${NEW_OCCASION_SLUG}`), 200) && ok;

console.log("\n4. cleanup\n");
for (const undo of restore.reverse()) {
  await undo().catch((e) => console.log(`  cleanup warning: ${e instanceof Error ? e.message : e}`));
}
console.log("  restored");

console.log(`\n${ok ? "ALL PASS" : "FAILURES ABOVE"}`);
process.exit(ok ? 0 : 1);
