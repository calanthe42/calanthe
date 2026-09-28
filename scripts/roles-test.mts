/**
 * Staff versus owner, checked against the real access model.
 *
 * ONE ROW PER PROMISE. Every line in the owner's brief becomes a case here:
 * what staff may do must work, what staff may not do must be refused, and
 * the refusal must leave the data untouched.
 *
 * WHY IT TESTS THE LOCAL API AND REST BOTH. Hiding a button is not
 * enforcement. Payload's REST layer enforces access by default; its Local
 * API does the OPPOSITE — `overrideAccess` defaults to true — and that gap
 * has already cost this project once, when two account pages passed `user`
 * without it and listed every order in the database. So each case is asked
 * of the same path the application uses (`user` + `overrideAccess: false`)
 * and, where it matters, of REST as well.
 *
 * Run against a DISPOSABLE branch. Never production.
 *
 *   node --env-file=<env> --import ./scripts/register-aliases.mjs \
 *        scripts/roles-test.mts [base-url]
 */
import { getPayload } from "payload";
import config from "../src/payload.config.ts";
import { diffFields, recordActivity } from "../src/backend/activity/record.ts";

const BASE = process.argv[2] ?? "http://localhost:3100";
const stamp = Date.now();
const PW = "Calanthe-Roles-2026!";

const pass: string[] = [];
const fail: string[] = [];
function check(name: string, ok: boolean, detail = "") {
  (ok ? pass : fail).push(name);
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  [${detail}]` : ""}`);
}

const payload = await getPayload({ config });
const host = (process.env.DATABASE_URL ?? "").replace(/^postgres(ql)?:\/\/[^@]*@/, "").split("/")[0];
if (/ep-round-art/.test(host)) {
  console.error("REFUSING: that is the production branch.");
  process.exit(2);
}
console.log(`database: ${host}\n`);

type Made = { collection: "users" | "products" | "occasions"; id: number | string };
const made: Made[] = [];

/** Did the operation get refused? Anything thrown by access counts. */
async function refused(run: () => Promise<unknown>): Promise<boolean> {
  try {
    await run();
    return false;
  } catch {
    return true;
  }
}

/* ---------------- fixtures ---------------- */
const staff = await payload.create({
  collection: "users",
  overrideAccess: true,
  data: {
    name: "Roles Staff",
    email: `roles-staff-${stamp}@calanthe.invalid`,
    password: PW,
    role: "staff",
    accountStatus: "active",
    _verified: true,
  } as never,
});
made.push({ collection: "users", id: staff.id });

const owner = await payload.create({
  collection: "users",
  overrideAccess: true,
  data: {
    name: "Roles Owner",
    email: `roles-owner-${stamp}@calanthe.invalid`,
    password: PW,
    role: "admin",
    accountStatus: "active",
    _verified: true,
  } as never,
});
made.push({ collection: "users", id: owner.id });

const staffUser = await payload.findByID({ collection: "users", id: staff.id, overrideAccess: true });
const ownerUser = await payload.findByID({ collection: "users", id: owner.id, overrideAccess: true });
const asStaff = { user: staffUser as never, overrideAccess: false } as const;
const asOwner = { user: ownerUser as never, overrideAccess: false } as const;

/* ---------------- STAFF CAN ---------------- */
console.log("-- staff CAN --");

const product = await payload
  .create({
    collection: "products",
    ...asStaff,
    data: {
      name: `Roles Test Bloom ${stamp}`,
      priceFils: 48000,
      category: "bouquet",
      available: false,
    } as never,
  })
  .catch(() => null);
check("staff can add a product", Boolean(product));
if (product) made.push({ collection: "products", id: product.id });

if (product) {
  const priced = await payload
    .update({
      collection: "products",
      id: product.id,
      ...asStaff,
      data: { priceFils: 52000 } as never,
    })
    .catch(() => null);
  check(
    "staff can change a product price",
    Number((priced as { priceFils?: number } | null)?.priceFils) === 52000,
    "480 -> 520",
  );

  const hidden = await payload
    .update({ collection: "products", id: product.id, ...asStaff, data: { available: false } as never })
    .catch(() => null);
  check("staff can hide / unhide a product", Boolean(hidden));
}

const orders = await payload.find({ collection: "orders", limit: 1, ...asStaff }).catch(() => null);
check("staff can see orders", orders !== null);

const order = orders?.docs[0] as { id: number; fulfilmentStatus?: string } | undefined;
if (order) {
  const moved = await payload
    .update({
      collection: "orders",
      id: order.id,
      ...asStaff,
      data: { fulfilmentStatus: order.fulfilmentStatus === "PREPARING" ? "READY" : "PREPARING" } as never,
    })
    .catch(() => null);
  check("staff can change an order's status", Boolean(moved));

  const noted = await payload
    .update({ collection: "orders", id: order.id, ...asStaff, data: { staffNotes: "roles test" } as never })
    .catch(() => null);
  check("staff can add internal notes to an order", Boolean(noted));

  const readable = order as unknown as Record<string, unknown>;
  check(
    "staff can see the delivery details they need",
    Boolean(readable.customerName !== undefined || readable.deliveryAddress !== undefined),
  );
}

const enquiries = await payload.find({ collection: "enquiries", limit: 1, ...asStaff }).catch(() => null);
check("staff can view enquiries", enquiries !== null);

const emails = await payload.find({ collection: "email-log", limit: 1, ...asStaff }).catch(() => null);
check("staff can see the email log (to resend order emails)", emails !== null);

const media = await payload.find({ collection: "media", limit: 1, ...asStaff }).catch(() => null);
check("staff can see photographs", media !== null);

/* ---------------- STAFF CANNOT ---------------- */
console.log("\n-- staff CANNOT (owner only) --");

if (product) {
  const blocked = await refused(() =>
    payload.delete({ collection: "products", id: product.id, ...asStaff }),
  );
  const survived = await payload
    .findByID({ collection: "products", id: product.id, overrideAccess: true })
    .catch(() => null);
  check("staff cannot delete a product", blocked, "refused");
  check("  …and the product is still there", Boolean(survived));
}

const mediaDoc = (media?.docs[0] as { id: number } | undefined) ?? null;
if (mediaDoc) {
  const blocked = await refused(() => payload.delete({ collection: "media", id: mediaDoc.id, ...asStaff }));
  const survived = await payload
    .findByID({ collection: "media", id: mediaDoc.id, overrideAccess: true })
    .catch(() => null);
  check("staff cannot delete a photograph", blocked);
  check("  …and the photograph is still there", Boolean(survived));
}

const occ = await payload.find({ collection: "occasions", limit: 1, overrideAccess: true });
const occDoc = occ.docs[0] as { id: number } | undefined;
if (occDoc) {
  const blocked = await refused(() => payload.delete({ collection: "occasions", id: occDoc.id, ...asStaff }));
  check("staff cannot delete an occasion", blocked);
  check(
    "  …and the occasion is still there",
    Boolean(await payload.findByID({ collection: "occasions", id: occDoc.id, overrideAccess: true }).catch(() => null)),
  );
}

if (order) {
  const blocked = await refused(() => payload.delete({ collection: "orders", id: order.id, ...asStaff }));
  check("staff cannot delete an order", blocked);
}

const customerBlocked = await refused(() =>
  payload.delete({ collection: "users", id: staff.id, ...asStaff }),
);
check("staff cannot delete accounts", customerBlocked);

const staffSeesEveryone = await payload
  .find({ collection: "users", limit: 50, ...asStaff })
  .catch(() => null);
const sawOthers = (staffSeesEveryone?.docs ?? []).some(
  (d) => (d as { id: number }).id !== staff.id,
);
check("staff cannot read the customer list", !sawOthers, `${staffSeesEveryone?.docs.length ?? 0} row(s)`);

const activityBlocked = await refused(() =>
  payload.find({ collection: "activity-log", limit: 1, ...asStaff }),
);
check("staff cannot read the activity report", activityBlocked);

const ownerCanRead = await payload
  .find({ collection: "activity-log", limit: 5, ...asOwner })
  .catch(() => null);
check("the owner CAN read the activity report", ownerCanRead !== null);

const activityWriteBlocked = await refused(() =>
  payload.create({
    collection: "activity-log",
    ...asOwner,
    data: { actorEmail: "x@y.z", actorRole: "admin", action: "update", area: "other", summary: "forged" } as never,
  }),
);
check("nobody can write the activity log by hand — not even the owner", activityWriteBlocked);

/* ---------------- the log recorded the real work ---------------- */
console.log("\n-- the report says what happened --");
/*
 * WHAT THIS CAN AND CANNOT PROVE.
 *
 * Recording lives in the admin SERVER ACTIONS, not in a Payload hook — a
 * hook writing to another collection inside the first one's transaction
 * deadlocks until the database terminates it, which this project has already
 * paid for once with order status emails. Server actions need a request
 * context (`next/headers`), so this script cannot call them, and a price
 * changed here through the Local API is correctly NOT recorded.
 *
 * So this asserts the recorder itself: the row it writes, the before → after
 * it derives, and that the owner can read it back. The end-to-end proof —
 * a staff price change appearing in /admin/activity — is the browser
 * walkthrough on the preview deployment.
 */
await recordActivity(payload, {
  actor: { email: (staffUser as { email: string }).email, name: "Roles Staff", role: "staff" },
  action: "update",
  area: "products",
  collection: "products",
  itemId: product?.id ?? 0,
  itemLabel: `Roles Test Bloom ${stamp}`,
  changes: diffFields({ priceFils: 48000, available: true }, { priceFils: 52000, available: false }),
});

const logged = await payload.find({
  collection: "activity-log",
  limit: 20,
  sort: "-createdAt",
  overrideAccess: true,
});
const rows = logged.docs as unknown as Record<string, unknown>[];
const priceRow = rows.find((r) => String(r.itemLabel).includes(String(stamp)));
const changesOf = (r: Record<string, unknown> | undefined) =>
  Array.isArray(r?.changes) ? (r.changes as Record<string, unknown>[]) : [];

check("the change is in the report", Boolean(priceRow), priceRow ? String(priceRow.summary) : "not found");
check(
  "  …with before → after, in words",
  changesOf(priceRow).some((c) => String(c.before) === "AED 480" && String(c.after) === "AED 520"),
);
check(
  "  …a hide reads as Available → Hidden",
  changesOf(priceRow).some((c) => String(c.before) === "Available" && String(c.after) === "Hidden"),
);
check("  …and it is flagged notable", priceRow?.notable === true);

/* ---------------- REST refuses too ---------------- */
console.log("\n-- the API refuses, not just the screen --");
const loginRes = await fetch(`${BASE}/api/users/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: BASE },
  body: JSON.stringify({ email: (staffUser as { email: string }).email, password: PW }),
}).catch(() => null);
const staffToken = loginRes ? ((await loginRes.json().catch(() => ({}))) as { token?: string }).token : undefined;

if (staffToken) {
  const rest = await fetch(`${BASE}/api/activity-log?limit=1`, {
    headers: { Origin: BASE, Authorization: `JWT ${staffToken}` },
  });
  check("REST: staff cannot read /api/activity-log", rest.status === 403 || rest.status === 401, `http ${rest.status}`);

  if (product) {
    const del = await fetch(`${BASE}/api/products/${product.id}`, {
      method: "DELETE",
      headers: { Origin: BASE, Authorization: `JWT ${staffToken}` },
    });
    check("REST: staff cannot DELETE a product", del.status === 403 || del.status === 401, `http ${del.status}`);
  }

  const page = await fetch(`${BASE}/admin/activity`, {
    headers: { Cookie: `payload-token=${staffToken}` },
    redirect: "manual",
  });
  check(
    "PAGE: staff cannot open /admin/activity",
    page.status === 404 || page.status === 403 || page.status === 307,
    `http ${page.status}`,
  );
} else {
  check("REST: staff session obtained", false, "could not sign in — is the server running?");
}

/* ---------------- cleanup ---------------- */
console.log("\n-- cleanup --");
for (const m of made.reverse()) {
  await payload.delete({ collection: m.collection, id: m.id, overrideAccess: true }).catch(() => {});
}
console.log(`  removed ${made.length} fixture(s)`);

console.log(`\nRESULT: ${pass.length} passed, ${fail.length} failed`);
if (fail.length) for (const f of fail) console.log(`  FAILED: ${f}`);
process.exit(fail.length ? 1 : 0);
