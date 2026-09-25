/**
 * Make the catalogue shoppable on a NON-PRODUCTION branch, without writing a
 * single byte to Blob storage.
 *
 * WHY NOT scripts/seed-demo-catalogue.mts. That one downloads photographs and
 * uploads them through Payload, which needs Blob credentials. Blob refuses
 * OIDC from anywhere outside a deployed Vercel runtime
 * (BlobOidcEnvironmentNotAllowedError), and the alternative — a
 * BLOB_READ_WRITE_TOKEN — would be read-write access to PRODUCTION's files
 * from a laptop, because Preview and Production share one store. So no
 * uploads happen here at all.
 *
 * WHAT IT USES INSTEAD. Every product already carries `legacyImages` from the
 * original catalogue import, and all of them are `images.pexels.com`, which is
 * in `images.remotePatterns`. `toImages()` in backend/data/products.ts already
 * falls back to those when a product has no uploaded media, so the storefront
 * shows real photography with no media rows in play.
 *
 * WHY IT WRITES SQL DIRECTLY. `validateProduct` refuses to publish a product
 * whose `images` relation is empty — correctly, because the owner's real
 * photography is the goal and a stock photo is not a substitute for it. That
 * rule should stand in production. Rather than weaken it for everyone, this
 * script sets the column directly, and only ever on a branch that is not
 * production.
 *
 * Run:
 *   node --env-file=<preview env> --import ./scripts/register-aliases.mjs \
 *        scripts/seed-preview-catalogue.mts [--revert]
 *
 * A developer utility: never imported by the application.
 */
import { getPayload } from "payload";
import config from "../src/payload.config.ts";

const REVERT = process.argv.includes("--revert");

type Pool = { query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> };

const payload = await getPayload({ config });
const pool = (payload.db as unknown as { pool: Pool }).pool;

const host = (process.env.DATABASE_URL ?? "").replace(/^postgres(ql)?:\/\/[^@]*@/, "").split("/")[0];

/**
 * The production endpoint, named so this can never run against it by a
 * mistyped env file. Preview and the throwaway audit branch are fine.
 */
if (/ep-round-art/.test(host)) {
  console.error(`REFUSING: ${host} is the PRODUCTION branch.`);
  console.error("This script publishes products with stock photography. Production");
  console.error("gets the owner's own photographs, uploaded through the live admin.");
  process.exit(2);
}
console.log(`database: ${host}\n`);

if (REVERT) {
  const { rows } = await pool.query(`update products set available = false where available = true returning slug`);
  console.log(`hid ${rows.length} product(s)`);
  process.exit(0);
}

/* Only products that actually have a photograph to show. */
const { rows: candidates } = await pool.query(
  `select p.id, p.slug, p.name, p.track_stock, p.stock,
          (select count(*) from products_legacy_images l where l._parent_id = p.id) as legacy,
          (select count(*) from products_images i where i._parent_id = p.id) as media
     from products p
    order by p.id`,
);

let published = 0;
let skipped = 0;
for (const c of candidates) {
  const legacy = Number(c.legacy);
  const media = Number(c.media);
  if (legacy === 0 && media === 0) {
    console.log(`  skip      ${String(c.slug).padEnd(20)} no photograph of any kind`);
    skipped += 1;
    continue;
  }

  /* A tracked product with nothing in stock cannot be bought, and a shop
     that offers it is worse than one that does not. */
  if (c.track_stock === true && Number(c.stock ?? 0) <= 0) {
    await pool.query(`update products set stock = 25 where id = $1`, [c.id]);
    console.log(`  stock     ${String(c.slug).padEnd(20)} tracked with none — set to 25`);
  }

  await pool.query(`update products set available = true where id = $1`, [c.id]);
  console.log(
    `  publish   ${String(c.slug).padEnd(20)} ${media > 0 ? `${media} uploaded` : `${legacy} legacy`} photo(s)`,
  );
  published += 1;
}

const { rows: after } = await pool.query(
  `select count(*) filter (where available) as live, count(*) as total from products`,
);
console.log(`\n${published} published, ${skipped} skipped — ${after[0].live} of ${after[0].total} live`);
console.log("No Blob writes. No media rows created. Revert with --revert.");
process.exit(0);
