/**
 * Audit — and prove — every sequence in a copied database.
 *
 * WHY THIS EXISTS. Copying rows does not move sequences. `db-copy.mts` reset
 * the ones it could find with `pg_get_serial_sequence(table, column)`, and
 * that function only knows about sequences OWNED BY A COLUMN. Calanthe has at
 * least one that is not: `calanthe_order_number_seq` is created standalone by
 * the Orders migration and read with `nextval()` in a hook, so the copy left
 * it untouched. A sequence behind max(id) does not fail quietly — it throws a
 * duplicate-key error on the next insert, which for the order-number sequence
 * means a customer who has paid gets an error instead of an order.
 *
 * So this enumerates `pg_sequences` — all of them, owned or not — rather than
 * walking tables.
 *
 * THREE MODES
 *   (default)  audit: every sequence, its next value, and what it must clear
 *   --fix      correct any sequence that is not past its column's max(id)
 *   --prove    insert a real row into every copied table, check the id the
 *              sequence handed out, delete it, and ROLL BACK so nothing is
 *              left behind. A sequence value consumed inside a rolled-back
 *              transaction stays consumed — which is precisely what makes
 *              this a proof rather than a simulation.
 *
 * With SOURCE_DATABASE_URL set, standalone sequences are also compared against
 * the source database, since there is no max(id) to check them against.
 *
 * Run:
 *   node --env-file=<env> --import ./scripts/register-aliases.mjs \
 *        scripts/db-sequences.mts [--fix] [--prove]
 *
 * A developer utility: never imported by the application.
 */
import { getPayload } from "payload";
import config from "../src/payload.config.ts";

const FIX = process.argv.includes("--fix");
const PROVE = process.argv.includes("--prove");

/**
 * Sequences deliberately restarted below their source, and the table that
 * makes it safe.
 *
 * WHY THIS LIST EXISTS. Comparing a standalone sequence against its source is
 * the right default — a number series must never walk backwards over numbers
 * already issued. But a deliberate restart looks identical to the bug, so
 * without a record of the decision the next `--fix` would quietly undo it.
 * That is exactly the kind of silent reversal this script was written to
 * prevent, so the decision is recorded in the repository rather than in
 * someone's memory.
 *
 * A restart is honoured ONLY while the named table is empty. The moment a
 * real row exists, the guard lapses and the sequence is judged normally.
 */
const DELIBERATELY_RESTARTED: Record<string, { table: string; note: string }> = {
  calanthe_order_number_seq: {
    table: "orders",
    note: "restarted at CAL-000001 on 2026-09-25 by the owner — the 19 numbers the old project had issued were deleted test checkouts, never sent to anyone",
  },
};

type QueryResult = { rows: Record<string, unknown>[] };
type Client = {
  query: (sql: string, params?: unknown[]) => Promise<QueryResult>;
  release?: () => void;
  end?: () => Promise<void>;
};
type Pool = Client & { connect: () => Promise<Client> };

type SeqInfo = {
  name: string;
  lastValue: number | null;
  isCalled: boolean;
  startValue: number;
  ownerTable: string | null;
  ownerColumn: string | null;
  maxId: number | null;
  nextValue: number;
  /** Only for standalone sequences, once a source database has been read. */
  sourceNext?: number;
};

async function readSequences(db: Client): Promise<SeqInfo[]> {
  const { rows } = await db.query(
    `select s.sequencename as name,
            s.last_value,
            s.start_value,
            pg_sequence_last_value(c.oid) is not null as is_called,
            dt.relname  as owner_table,
            da.attname  as owner_column
       from pg_sequences s
       join pg_class c
         on c.relname = s.sequencename and c.relnamespace = 'public'::regnamespace
       left join pg_depend d
         on d.objid = c.oid and d.classid = 'pg_class'::regclass and d.deptype = 'a'
       left join pg_class dt on dt.oid = d.refobjid
       left join pg_attribute da on da.attrelid = d.refobjid and da.attnum = d.refobjsubid
      where s.schemaname = 'public'
      order by s.sequencename`,
  );

  const out: SeqInfo[] = [];
  for (const r of rows) {
    const name = String(r.name);
    const ownerTable = r.owner_table ? String(r.owner_table) : null;
    const ownerColumn = r.owner_column ? String(r.owner_column) : null;
    const lastValue = r.last_value === null ? null : Number(r.last_value);
    const startValue = Number(r.start_value);

    /* last_value is null until the sequence has ever been used, in which case
       the next value is start_value. */
    const isCalled = lastValue !== null;
    const nextValue = isCalled ? lastValue! + 1 : startValue;

    let maxId: number | null = null;
    if (ownerTable && ownerColumn) {
      const { rows: m } = await db.query(
        `select coalesce(max("${ownerColumn}"), 0)::bigint as m from "${ownerTable}"`,
      );
      maxId = Number(m[0].m);
    }

    out.push({ name, lastValue, isCalled, startValue, ownerTable, ownerColumn, maxId, nextValue });
  }
  return out;
}

/** Text columns carrying a unique constraint, which a cloned row would collide on. */
async function uniqueTextColumns(db: Client, table: string): Promise<string[]> {
  const { rows } = await db.query(
    `select distinct a.attname, t.typname
       from pg_index i
       join pg_class c on c.oid = i.indrelid and c.relname = $1
       join pg_attribute a on a.attrelid = c.oid and a.attnum = any(i.indkey)
       join pg_type t on t.oid = a.atttypid
      where i.indisunique and not i.indisprimary`,
    [table],
  );
  return rows
    .filter((r) => ["text", "varchar", "bpchar"].includes(String(r.typname)))
    .map((r) => String(r.attname));
}

async function main() {
  const payload = await getPayload({ config });
  const pool = (payload.db as unknown as { pool: Pool }).pool;
  const hostOf = (u: string) => u.replace(/^postgres(ql)?:\/\/[^@]*@/, "").split("/")[0];
  console.log(`\nDATABASE  ${hostOf(process.env.DATABASE_URL ?? "")}\n`);

  const seqs = await readSequences(pool);

  const w = Math.max(...seqs.map((s) => s.name.length));
  let broken: SeqInfo[] = [];

  console.log("SEQUENCES");
  for (const s of seqs) {
    const owner = s.ownerTable ? `${s.ownerTable}.${s.ownerColumn}` : "(standalone)";
    const safe = s.maxId === null ? null : s.nextValue > s.maxId;
    if (safe === false) broken.push(s);
    const verdict = safe === null ? "  ?   " : safe ? "  OK  " : " BEHIND";
    console.log(
      `${verdict}  ${s.name.padEnd(w)}  next=${String(s.nextValue).padStart(6)}  max(id)=${
        s.maxId === null ? "   n/a" : String(s.maxId).padStart(6)
      }  ${owner}`,
    );
  }

  /* A standalone sequence has no max(id) to be judged against, so the only
     honest reference is the database this one was copied from. */
  const sourceUrl = process.env.SOURCE_DATABASE_URL;
  const standalone = seqs.filter((s) => !s.ownerTable);
  if (sourceUrl && standalone.length > 0) {
    const PoolCtor = (pool as unknown as { constructor: new (o: { connectionString: string }) => Pool })
      .constructor;
    const source = new PoolCtor({ connectionString: sourceUrl });
    console.log(`\nSTANDALONE SEQUENCES vs SOURCE  ${hostOf(sourceUrl)}`);
    const srcSeqs = await readSequences(source);
    for (const s of standalone) {
      const other = srcSeqs.find((x) => x.name === s.name);
      if (!other) {
        console.log(`  MISSING IN SOURCE  ${s.name}`);
        continue;
      }
      s.sourceNext = other.nextValue;
      const ok = s.nextValue >= other.nextValue;

      const restart = DELIBERATELY_RESTARTED[s.name];
      let excused = false;

      /*
       * ONCE THE SERIES IS LIVE, THE SOURCE IS IRRELEVANT.
       *
       * Comparing a standalone sequence against the database it was copied
       * from only means something for as long as this one has issued
       * nothing. After the first real record the local series is the truth
       * and the source is a frozen snapshot drifting further away every day.
       *
       * This is not theoretical: after the owner placed CAL-000001 on the
       * new production database, this tool reported the order sequence as
       * "BEHIND" the old Ohio project and advised `--fix` — which would have
       * jumped live order numbers from 2 to 20 for no reason. A tool that
       * confidently recommends the wrong action is worse than no tool.
       */
      if (restart) {
        const { rows: n } = await pool.query(`select count(*)::int as n from "${restart.table}"`);
        const rows = Number(n[0].n);
        if (rows > 0) {
          console.log(
            `  LIVE    ${s.name.padEnd(w)}  next=${s.nextValue}  ("${restart.table}" has ${rows} row(s) — this series is in use; the source no longer applies)`,
          );
          continue;
        }
        excused = !ok;
      }

      if (!ok && !excused) broken.push(s);
      if (excused) {
        console.log(`  KEPT    ${s.name.padEnd(w)}  here next=${s.nextValue}  source next=${other.nextValue}`);
        console.log(`          deliberate: ${restart!.note}`);
      } else if (ok) {
        console.log(`  OK      ${s.name.padEnd(w)}  here next=${s.nextValue}  source next=${other.nextValue}`);
      } else if (!restart) {
        console.log(`  BEHIND  ${s.name.padEnd(w)}  here next=${s.nextValue}  source next=${other.nextValue}`);
      }
    }
    await source.end?.();
  } else if (standalone.length > 0) {
    console.log(
      `\n  NOTE: ${standalone.length} standalone sequence(s) could not be checked — set SOURCE_DATABASE_URL to compare.`,
    );
  }

  if (FIX && broken.length > 0) {
    console.log("\nFIXING");
    for (const s of broken) {
      if (s.ownerTable && s.maxId !== null) {
        if (s.maxId === 0) {
          /* Empty table: leave the sequence unused so the first row gets the
             start value, rather than skipping it. */
          await pool.query(`select setval($1, $2, false)`, [s.name, s.startValue]);
          console.log(`  ${s.name} -> next ${s.startValue} (table empty)`);
        } else {
          await pool.query(`select setval($1, $2, true)`, [s.name, s.maxId]);
          console.log(`  ${s.name} -> next ${s.maxId + 1}`);
        }
      } else if (s.sourceNext !== undefined) {
        /* Standalone: there is no max(id) to derive a value from, so the
           source's position is the only defensible target. These numbers are
           customer-facing and declared "never reused", so the series must not
           be allowed to walk back over numbers already issued. */
        await pool.query(`select setval($1, $2, true)`, [s.name, s.sourceNext - 1]);
        console.log(`  ${s.name} -> next ${s.sourceNext} (matching source)`);
      }
    }
    broken = [];
  }

  if (PROVE) {
    console.log("\nPROOF — insert a real row, check the id, delete it, roll back");
    const client = await pool.connect();
    const failures: string[] = [];
    try {
      await client.query("begin");
      for (const s of seqs) {
        if (!s.ownerTable || !s.ownerColumn) continue;
        const table = s.ownerTable;
        const idCol = s.ownerColumn;

        const { rows } = await client.query(`select * from "${table}" limit 1`);
        if (rows.length === 0) {
          console.log(`  skip    ${table.padEnd(w)}  (empty — nothing to clone)`);
          continue;
        }

        const uniques = await uniqueTextColumns(client, table);
        const cols = Object.keys(rows[0]).filter((c) => c !== idCol);
        const marker = `seqproof-${Date.now()}`;
        const params = cols.map((c) => {
          const v = rows[0][c];
          /* Perturb unique text so the clone cannot collide with its original. */
          if (uniques.includes(c) && typeof v === "string") return `${v}-${marker}`;
          return v;
        });
        const holes = cols.map((_, i) => `$${i + 1}`).join(", ");
        const quoted = cols.map((c) => `"${c}"`).join(", ");

        try {
          await client.query("savepoint sp");
          const ins = await client.query(
            `insert into "${table}" (${quoted}) values (${holes}) returning "${idCol}"`,
            params,
          );
          const newId = Number(ins.rows[0][idCol]);
          const ok = newId > (s.maxId ?? 0);
          if (!ok) failures.push(`${table}: sequence handed out ${newId}, max was ${s.maxId}`);

          const del = await client.query(`delete from "${table}" where "${idCol}" = $1 returning "${idCol}"`, [
            newId,
          ]);
          const deleted = del.rows.length === 1;
          if (!deleted) failures.push(`${table}: the test row did not delete`);

          console.log(
            `  ${ok && deleted ? "PASS" : "FAIL"}    ${table.padEnd(w)}  got id ${String(newId).padStart(5)}  (max was ${s.maxId})  deleted=${deleted}`,
          );
          await client.query("release savepoint sp");
        } catch (e) {
          await client.query("rollback to savepoint sp");
          const msg = e instanceof Error ? e.message.split("\n")[0] : String(e);
          failures.push(`${table}: ${msg}`);
          console.log(`  FAIL    ${table.padEnd(w)}  ${msg}`);
        }
      }
      await client.query("rollback");
      console.log("\n  transaction rolled back — no test row survives");
    } finally {
      client.release?.();
    }

    if (failures.length > 0) {
      console.log(`\nPROOF FAILED (${failures.length}):`);
      for (const f of failures) console.log(`  - ${f}`);
      process.exit(1);
    }
    console.log("  every copied table accepted an insert with a fresh id");
  }

  if (broken.length > 0) {
    console.log(`\n${broken.length} SEQUENCE(S) BEHIND — re-run with --fix\n`);
    process.exit(1);
  }
  console.log("\nAll sequences are past their maximum id.\n");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
