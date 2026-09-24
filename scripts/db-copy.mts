/**
 * Copy every row from one Payload database into another, for the region move.
 *
 * WHY NOT pg_dump. There is no Postgres client on this machine and no Docker
 * to borrow one from, but the better reason is policy: this project runs
 * `push: false` so that every environment's schema comes from the same
 * reviewed migration files. So the target's schema is built by
 * `payload migrate`, exactly like production's was, and this script moves only
 * DATA into it. A dump would have carried a schema nobody reviewed.
 *
 * SAFETY
 *  - The SOURCE is opened and only ever read from.
 *  - The TARGET must be empty of application rows, or the script refuses.
 *    `--force` is the only way past that, and it truncates first.
 *  - Everything happens inside ONE transaction on the target. A failure
 *    anywhere leaves the target exactly as it was found.
 *  - Foreign keys are honoured by inserting parents before children
 *    (topological order), so the constraints stay armed throughout and a
 *    broken reference fails the run instead of being written.
 *
 * Run:
 *   node --env-file=<env with DATABASE_URL=target and SOURCE_DATABASE_URL> \
 *        --import ./scripts/register-aliases.mjs scripts/db-copy.mts [--force] [--dry-run]
 *
 * A developer utility: never imported by the application.
 */
import { getPayload } from "payload";
import config from "../src/payload.config.ts";

const FORCE = process.argv.includes("--force");
const DRY = process.argv.includes("--dry-run");

type QueryResult = { rows: Record<string, unknown>[] };
type Client = {
  query: (sql: string, params?: unknown[]) => Promise<QueryResult>;
  release?: () => void;
  end?: () => Promise<void>;
};
type Pool = Client & { connect: () => Promise<Client> };

/** Parents first. A table is emitted only once everything it points at has been. */
function topoSort(tables: string[], edges: { child: string; parent: string }[]): string[] {
  const deps = new Map<string, Set<string>>(tables.map((t) => [t, new Set<string>()]));
  for (const e of edges) {
    /* A self-reference cannot be satisfied by ordering tables, only by
       ordering rows. Ignore it here; the transaction will catch it if the
       data actually depends on it. */
    if (e.child === e.parent) continue;
    if (deps.has(e.child) && deps.has(e.parent)) deps.get(e.child)!.add(e.parent);
  }

  const out: string[] = [];
  const done = new Set<string>();
  let guard = tables.length + 1;
  while (out.length < tables.length && guard-- > 0) {
    for (const t of tables) {
      if (done.has(t)) continue;
      if ([...deps.get(t)!].every((p) => done.has(p))) {
        out.push(t);
        done.add(t);
      }
    }
  }
  if (out.length < tables.length) {
    const stuck = tables.filter((t) => !done.has(t));
    throw new Error(`Foreign-key cycle between: ${stuck.join(", ")}`);
  }
  return out;
}

async function main() {
  const sourceUrl = process.env.SOURCE_DATABASE_URL;
  if (!sourceUrl) throw new Error("SOURCE_DATABASE_URL is not set");

  const payload = await getPayload({ config });
  const target = (payload.db as unknown as { pool: Pool }).pool;

  /* pg is not resolvable from the project root under pnpm, so borrow the
     constructor off the pool Payload has already built. */
  const PoolCtor = (target as unknown as { constructor: new (o: { connectionString: string }) => Pool })
    .constructor;
  const source = new PoolCtor({ connectionString: sourceUrl });

  const hostOf = (u: string) => u.replace(/^postgres(ql)?:\/\/[^@]*@/, "").split("/")[0];
  console.log(`\nSOURCE (read only)  ${hostOf(sourceUrl)}`);
  console.log(`TARGET (written)    ${hostOf(process.env.DATABASE_URL ?? "")}\n`);

  const { rows: tRows } = await source.query(
    `select table_name from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`,
  );
  const tables = tRows.map((r) => String(r.table_name));

  const { rows: fkRows } = await source.query(
    `select tc.table_name as child, ccu.table_name as parent
       from information_schema.table_constraints tc
       join information_schema.constraint_column_usage ccu
         on ccu.constraint_name = tc.constraint_name
        and ccu.table_schema = tc.table_schema
      where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'`,
  );
  const order = topoSort(
    tables,
    fkRows.map((r) => ({ child: String(r.child), parent: String(r.parent) })),
  );

  /* Identity columns reject an explicit value unless told otherwise. Primary
     keys have to survive the move — every foreign key in the database points
     at one — so the clause is added wherever the table has one. */
  const { rows: idRows } = await source.query(
    `select table_name from information_schema.columns
      where table_schema = 'public' and is_identity = 'YES' group by table_name`,
  );
  const hasIdentity = new Set(idRows.map((r) => String(r.table_name)));

  console.log("PLAN (insertion order, parents first)");
  const plan: { table: string; rows: number }[] = [];
  for (const t of order) {
    const { rows } = await source.query(`select count(*)::int as n from "${t}"`);
    plan.push({ table: t, rows: Number(rows[0].n) });
  }
  const w = Math.max(...plan.map((p) => p.table.length));
  for (const p of plan) {
    if (p.rows > 0) console.log(`  ${p.table.padEnd(w)}  ${String(p.rows).padStart(5)}`);
  }
  const totalRows = plan.reduce((a, b) => a + b.rows, 0);
  console.log(
    `  ${"TOTAL".padEnd(w)}  ${String(totalRows).padStart(5)}  (${plan.filter((p) => p.rows > 0).length} non-empty of ${plan.length} tables)\n`,
  );

  /* Refuse a target that already holds application rows. payload_migrations is
     expected to be populated — `payload migrate` just wrote it. */
  const occupied: string[] = [];
  for (const t of order) {
    if (t === "payload_migrations") continue;
    const { rows } = await target.query(`select count(*)::int as n from "${t}"`);
    if (Number(rows[0].n) > 0) occupied.push(`${t}=${rows[0].n}`);
  }
  if (occupied.length > 0 && !FORCE) {
    console.error(`TARGET IS NOT EMPTY: ${occupied.join(", ")}`);
    console.error("Refusing. Re-run with --force to truncate the target first.");
    process.exit(2);
  }

  if (DRY) {
    console.log("--dry-run: nothing written.");
    process.exit(0);
  }

  const client = await target.connect();
  let copied = 0;
  try {
    await client.query("begin");

    /* Children first, so a truncate never trips a foreign key. The migrations
       ledger goes too, and is replaced from the source, so both databases
       answer `payload migrate:status` identically — batch numbers included. */
    for (const t of [...order].reverse()) {
      await client.query(`truncate table "${t}" cascade`);
    }

    for (const t of order) {
      const { rows } = await source.query(`select * from "${t}"`);
      if (rows.length === 0) continue;

      const cols = Object.keys(rows[0]);
      const quoted = cols.map((c) => `"${c}"`).join(", ");
      const overriding = hasIdentity.has(t) ? " overriding system value" : "";
      const holes = cols.map((_, i) => `$${i + 1}`).join(", ");

      for (const row of rows) {
        const params = cols.map((c) => row[c]);
        await client.query(`insert into "${t}" (${quoted})${overriding} values (${holes})`, params);
      }
      copied += rows.length;
      console.log(`  copied  ${t.padEnd(w)}  ${String(rows.length).padStart(5)}`);
    }

    /* Without this the next insert reuses id 1 and collides. */
    console.log("\nRESETTING SEQUENCES");
    for (const t of order) {
      const { rows } = await client.query(
        `select column_name from information_schema.columns
          where table_schema='public' and table_name=$1
            and (is_identity='YES' or column_default like 'nextval%')`,
        [t],
      );
      for (const r of rows) {
        const col = String(r.column_name);
        const { rows: seqRows } = await client.query(`select pg_get_serial_sequence($1, $2) as seq`, [
          `public.${t}`,
          col,
        ]);
        const seq = seqRows[0]?.seq;
        if (!seq) continue;
        const { rows: maxRows } = await client.query(
          `select coalesce(max("${col}"), 0)::bigint as m from "${t}"`,
        );
        const max = Number(maxRows[0].m);
        await client.query(`select setval($1, $2, true)`, [seq, Math.max(max, 1)]);
        console.log(`  ${t}.${col} -> ${Math.max(max, 1)}`);
      }
    }

    await client.query("commit");
    console.log(`\nCOMMITTED. ${copied} rows copied.\n`);
  } catch (e) {
    await client.query("rollback");
    console.error("\nROLLED BACK — the target is unchanged.\n");
    throw e;
  } finally {
    client.release?.();
    await source.end?.();
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
