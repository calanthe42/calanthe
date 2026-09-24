/**
 * Whole-table checksums for two databases, compared.
 *
 * Row COUNTS matching is a weak claim — two tables can hold the same number of
 * different rows. This hashes the full text of every row of every table, so a
 * single changed character in a single column shows up. It is the evidence
 * behind "the copy is identical", and in particular behind "both accounts can
 * still sign in": a password is verified against the salt and hash stored in
 * `users`, so if those columns survived byte for byte, so did the logins.
 *
 * Rows are ordered by their own text before hashing, so physical row order —
 * which a copy has no reason to preserve — cannot cause a false mismatch.
 *
 * Read-only against both databases.
 *
 * Run:
 *   node --env-file=<env with DATABASE_URL and SOURCE_DATABASE_URL> \
 *        --import ./scripts/register-aliases.mjs scripts/db-checksum.mts
 *
 * A developer utility: never imported by the application.
 */
import { getPayload } from "payload";
import config from "../src/payload.config.ts";

type QueryResult = { rows: Record<string, unknown>[] };
type Pool = {
  query: (sql: string, params?: unknown[]) => Promise<QueryResult>;
  end?: () => Promise<void>;
};

async function checksums(pool: Pool, tables: string[]) {
  const out = new Map<string, { sum: string; rows: number }>();
  for (const t of tables) {
    /* md5 of the concatenated, sorted row texts. NULL when the table is
       empty, which is itself a fine value to compare. */
    const { rows } = await pool.query(
      `select coalesce(md5(string_agg(line, E'\\n' order by line)), 'EMPTY') as sum,
              count(*)::int as n
         from (select t::text as line from "${t}" t) s`,
    );
    out.set(t, { sum: String(rows[0].sum), rows: Number(rows[0].n) });
  }
  return out;
}

async function main() {
  const sourceUrl = process.env.SOURCE_DATABASE_URL;
  if (!sourceUrl) throw new Error("SOURCE_DATABASE_URL is not set");

  const payload = await getPayload({ config });
  const target = (payload.db as unknown as { pool: Pool }).pool;
  const PoolCtor = (target as unknown as { constructor: new (o: { connectionString: string }) => Pool })
    .constructor;
  const source = new PoolCtor({ connectionString: sourceUrl });

  /* Both sides are read with the same timezone, so a timestamptz cannot
     render differently and fake a mismatch. */
  await source.query("set time zone 'UTC'");
  await target.query("set time zone 'UTC'");

  const hostOf = (u: string) => u.replace(/^postgres(ql)?:\/\/[^@]*@/, "").split("/")[0];
  console.log(`\nA  ${hostOf(sourceUrl)}`);
  console.log(`B  ${hostOf(process.env.DATABASE_URL ?? "")}\n`);

  const { rows: tRows } = await source.query(
    `select table_name from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`,
  );
  const tables = tRows.map((r) => String(r.table_name));

  const { rows: tRowsB } = await target.query(
    `select table_name from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`,
  );
  const tablesB = tRowsB.map((r) => String(r.table_name));

  const onlyA = tables.filter((t) => !tablesB.includes(t));
  const onlyB = tablesB.filter((t) => !tables.includes(t));
  if (onlyA.length || onlyB.length) {
    console.log(`SCHEMA DIFFERS — only in A: ${onlyA.join(", ") || "none"}; only in B: ${onlyB.join(", ") || "none"}\n`);
  } else {
    console.log(`SCHEMA: both hold the same ${tables.length} tables\n`);
  }

  const a = await checksums(source, tables);
  const b = await checksums(target, tablesB);

  const w = Math.max(...tables.map((t) => t.length));
  let mismatches = 0;
  let compared = 0;
  for (const t of tables) {
    const x = a.get(t);
    const y = b.get(t);
    if (!y) continue;
    compared++;
    const same = x!.sum === y.sum;
    if (!same) mismatches++;
    /* Empty tables are the majority and say nothing; print what carries data,
       and anything that disagrees. */
    if (x!.rows > 0 || !same) {
      console.log(
        `  ${same ? "MATCH " : "DIFFER"}  ${t.padEnd(w)}  ${String(x!.rows).padStart(5)} rows  A=${x!.sum.slice(0, 12)}  B=${y.sum.slice(0, 12)}`,
      );
    }
  }

  console.log(
    `\n${mismatches === 0 ? "IDENTICAL" : `${mismatches} TABLE(S) DIFFER`} — ${compared} tables compared, ${[...a.values()].reduce((s, v) => s + v.rows, 0)} rows hashed.\n`,
  );

  await source.end?.();
  process.exit(mismatches === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
