/**
 * Read-only census of a database: every table's row count, the migrations
 * that have been applied, and the product catalogue by name.
 *
 * Written for the region move. "Row counts match for every table" is one of
 * the conditions the move has to satisfy, and that is not a thing anyone can
 * establish by looking — it needs the same query run against the old project
 * and the new one, and the two outputs compared byte for byte.
 *
 * NOTHING HERE WRITES. It opens Payload (which is `push: false`, so even
 * connecting cannot alter a schema), counts, and prints. Safe against
 * production.
 *
 * Run:
 *   node --env-file=<env file> --import ./scripts/register-aliases.mjs \
 *        scripts/db-inventory.mts [--json]
 *
 * A developer utility: never imported by the application.
 */
import { getPayload } from "payload";
import config from "../src/payload.config.ts";

const JSON_OUT = process.argv.includes("--json");

type Pool = { query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> };

async function main() {
  const payload = await getPayload({ config });

  /* The adapter's own pg pool. Reaching for it rather than for Payload's
     find() because the point is the SHAPE OF THE DATABASE — join tables,
     locale tables, the migrations table — not the documents Payload chooses
     to surface. */
  const pool = (payload.db as unknown as { pool: Pool }).pool;

  const host = (process.env.DATABASE_URL ?? "").replace(/^postgres(ql)?:\/\/[^@]*@/, "").split("/")[0];

  const { rows: tableRows } = await pool.query(
    `select table_name from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'
      order by table_name`,
  );

  const counts: Record<string, number> = {};
  for (const r of tableRows) {
    const t = String(r.table_name);
    const { rows } = await pool.query(`select count(*)::int as n from "${t}"`);
    counts[t] = Number(rows[0].n);
  }

  let migrations: { name: string; batch: number }[] = [];
  try {
    const { rows } = await pool.query(
      `select name, batch from payload_migrations order by name`,
    );
    migrations = rows.map((r) => ({ name: String(r.name), batch: Number(r.batch) }));
  } catch {
    migrations = [];
  }

  const products = await payload.find({
    collection: "products",
    limit: 200,
    depth: 0,
    sort: "createdAt",
    overrideAccess: true,
  });

  const users = await payload.find({
    collection: "users",
    limit: 200,
    depth: 0,
    sort: "createdAt",
    overrideAccess: true,
  });

  const report = {
    host,
    takenAt: new Date().toISOString(),
    tables: counts,
    totalRows: Object.values(counts).reduce((a, b) => a + b, 0),
    migrations,
    products: products.docs.map((p: Record<string, unknown>) => ({
      name: p.name ?? p.title,
      slug: p.slug,
      priceAed: p.price,
      available: p.available === true,
      images: Array.isArray(p.images) ? p.images.length : 0,
    })),
    users: users.docs.map((u: Record<string, unknown>) => ({
      email: u.email,
      role: u.role,
      collection: "users",
    })),
  };

  if (JSON_OUT) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
  }

  console.log(`\nDATABASE  ${host}`);
  console.log(`TAKEN AT  ${report.takenAt}\n`);

  console.log("ROW COUNTS");
  const width = Math.max(...Object.keys(counts).map((k) => k.length));
  for (const [t, n] of Object.entries(counts)) {
    console.log(`  ${t.padEnd(width)}  ${String(n).padStart(6)}`);
  }
  console.log(`  ${"TOTAL".padEnd(width)}  ${String(report.totalRows).padStart(6)}\n`);

  console.log(`MIGRATIONS APPLIED (${migrations.length})`);
  for (const m of migrations) console.log(`  batch ${m.batch}  ${m.name}`);
  console.log("");

  console.log(`PRODUCTS (${report.products.length})`);
  for (const p of report.products) {
    const flag = p.available ? "LIVE  " : "hidden";
    console.log(`  ${flag}  ${String(p.name).padEnd(28)}  ${String(p.slug).padEnd(24)}  AED ${String(p.priceAed ?? "-").padStart(6)}  ${p.images} image(s)`);
  }
  console.log("");

  console.log(`ACCOUNTS (${report.users.length})`);
  for (const u of report.users) console.log(`  ${String(u.role).padEnd(10)}  ${u.email}`);
  console.log("");

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
