/**
 * What Resend says about the emails we recorded as sent.
 *
 * "Sent" only means the provider accepted the request. Delivery is a
 * separate fact that only Resend can state, so this reads the message ids
 * out of email_log and asks.
 *
 * IT READS THE DATABASE FIRST AND CLOSES IT BEFORE POLLING. The poll sleeps
 * for minutes; a connection held open across it is one the database will
 * close underneath us, and node-postgres turns that into an unhandled error
 * that kills the process.
 *
 *   node --env-file=<env> --import ./scripts/register-aliases.mjs \
 *        scripts/check-email-delivery.mts [minutes]
 *
 * A developer utility: never imported by the application.
 */
import { getPayload } from "payload";
import config from "../src/payload.config.ts";

const MINUTES = Number(process.argv[2] ?? 60);

const payload = await getPayload({ config });
const since = new Date(Date.now() - MINUTES * 60_000).toISOString();

const res = await payload.find({
  collection: "email-log",
  where: { createdAt: { greater_than: since } },
  limit: 200,
  sort: "createdAt",
  depth: 0,
  overrideAccess: true,
});
const rows = res.docs as unknown as Record<string, unknown>[];

/* Everything needed is in memory now. */
await (payload.db as unknown as { pool?: { end: () => Promise<void> } }).pool
  ?.end()
  .catch(() => {});

const key = process.env.RESEND_API_KEY;
console.log(`\n${rows.length} email(s) in the last ${MINUTES} minutes\n`);
console.log("TYPE                 TO                        STATUS         MESSAGE ID");
console.log("-".repeat(104));

let delivered = 0;
let withId = 0;
for (const r of rows) {
  const id = r.providerId ? String(r.providerId) : "";
  if (!id) {
    console.log(
      `${String(r.type).padEnd(21)}${String(r.to).padEnd(26)}${String(r.status).toUpperCase().padEnd(15)}${
        r.error ? `(${String(r.error).slice(0, 50)})` : ""
      }`,
    );
    continue;
  }
  withId += 1;
  let event = "unknown";
  if (key) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await fetch(`https://api.resend.com/emails/${id}`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
      event = String(body?.last_event ?? "unknown");
      if (["delivered", "bounced", "complained", "delivery_delayed"].includes(event)) break;
      await new Promise((r2) => setTimeout(r2, 5000));
    }
  }
  if (event === "delivered") delivered += 1;
  console.log(
    `${String(r.type).padEnd(21)}${String(r.to).padEnd(26)}${event.toUpperCase().padEnd(15)}${id}`,
  );
}

console.log("-".repeat(104));
console.log(`${delivered} of ${withId} confirmed DELIVERED by Resend.`);
process.exit(delivered === withId ? 0 : 1);
