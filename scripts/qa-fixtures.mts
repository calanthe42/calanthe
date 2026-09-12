/**
 * Temporary data for browser QA, and its removal.
 *
 * The real database holds a hidden catalogue and nothing else, so most admin
 * screens would be empty and prove nothing. This creates the smallest set of
 * REAL records that exercises every screen — through Payload, so every hook
 * and validation applies exactly as it would in life — records what it made,
 * and deletes all of it again afterwards.
 *
 *   node --env-file=.env.local <tsx> scripts/qa-fixtures.mts create  <state.json>
 *   node --env-file=.env.local <tsx> scripts/qa-fixtures.mts cleanup <state.json>
 *
 * SAFETY. Everything created carries a marker: accounts are `qa-*` at the
 * reserved `@calanthe.invalid` domain, records are named "QA …", the photo's
 * alt text starts with "QA ". Cleanup deletes by state file AND sweeps those
 * markers, so an interrupted run leaves nothing behind. Nothing without a
 * marker is ever touched, and the one real product that is borrowed has its
 * gallery and availability restored exactly.
 *
 * The state file is written after every create, so a failure halfway through
 * is still fully cleanable.
 *
 * A developer utility: never imported by the application.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { getPayload } from "payload";
import config from "../src/payload.config";

type State = {
  ownerEmail: string;
  ownerPassword: string;
  staffEmail: string;
  staffPassword: string;
  users: number[];
  orders: number[];
  enquiries: number[];
  events: number[];
  media: number[];
  product?: { id: number; available: boolean; imageIds: number[] };
};

const [command, statePath] = process.argv.slice(2);
if (!command || !statePath) {
  console.error("usage: qa-fixtures.mts <create|cleanup> <state.json>");
  process.exit(1);
}

const payload = await getPayload({ config });
const DAY_MS = 86_400_000;
const stamp = Date.now();

/* A 1×1 PNG: enough for sharp to process into the four sizes. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function orderData(overrides: Record<string, unknown>) {
  const unit = 48_000;
  const quantity = 2;
  const line = unit * quantity;
  const delivery = 2_500;
  return {
    customerType: "guest",
    customerName: "QA Buyer",
    customerEmail: `qa-buyer-${stamp}@calanthe.invalid`,
    customerPhone: "+971500000000",
    deliveryAddress: "QA Villa 1, Test Street",
    deliveryEmirate: "dubai",
    deliveryTimeSlot: "13:00 – 17:00",
    items: [
      { productName: "QA Amber Hour", productSlug: "qa-amber-hour", quantity, unitPriceFils: unit, lineTotalFils: line },
    ],
    subtotalFils: line,
    deliveryFeeFils: delivery,
    discountFils: 0,
    totalFils: line + delivery,
    currency: "AED",
    fulfilmentStatus: "NEW",
    paymentStatus: "PENDING",
    source: "checkout-cod",
    ...overrides,
  };
}

if (command === "create") {
  const state: State = {
    ownerEmail: `qa-owner-${stamp}@calanthe.invalid`,
    ownerPassword: `QaOwner!${stamp}`,
    staffEmail: `qa-staff-${stamp}@calanthe.invalid`,
    staffPassword: `QaStaff!${stamp}`,
    users: [],
    orders: [],
    enquiries: [],
    events: [],
    media: [],
  };
  /* Written after every step: an interrupted run is still cleanable. */
  const save = () => writeFileSync(statePath, JSON.stringify(state, null, 2));
  save();

  const account = async (role: "admin" | "staff" | "customer", email: string, password: string, first: string) => {
    const user = await payload.create({
      collection: "users",
      data: { email, password, role, accountStatus: "active", firstName: "Qa", lastName: first, _verified: true } as never,
    });
    state.users.push(user.id);
    save();
    return user;
  };

  await account("admin", state.ownerEmail, state.ownerPassword, "Owner");
  await account("staff", state.staffEmail, state.staffPassword, "Staff");
  await account("customer", `qa-customer-${stamp}@calanthe.invalid`, `QaCustomer!${stamp}`, "Customer");

  /* A photograph, so the media library and a live product exist. */
  const photo = await payload.create({
    collection: "media",
    data: { alt: "QA fixture photograph" } as never,
    file: { data: PNG, mimetype: "image/png", name: `qa-fixture-${stamp}.png`, size: PNG.length },
  });
  state.media.push(photo.id);
  save();

  /* Borrow one real product: give it the photo and publish it, then put it
     back exactly as it was during cleanup. */
  const products = await payload.find({ collection: "products", limit: 1, sort: "sortOrder", depth: 0 });
  const product = products.docs[0];
  if (product) {
    state.product = {
      id: product.id,
      available: Boolean(product.available),
      imageIds: (product.images ?? [])
        .map((row) => (typeof row.image === "object" && row.image ? row.image.id : row.image))
        .filter((v): v is number => typeof v === "number"),
    };
    save();
    await payload.update({
      collection: "products",
      id: product.id,
      data: { images: [{ image: photo.id }], available: true } as never,
    });
  }

  const today = new Date();
  const orders = [
    /* Due today, still new: "to confirm" and "today's deliveries". */
    { deliveryDate: new Date(today.getTime() + 3 * 3_600_000).toISOString() },
    /* Overdue: past its delivery day and still open. */
    {
      deliveryDate: new Date(today.getTime() - 2 * DAY_MS).toISOString(),
      fulfilmentStatus: "PREPARING",
      customerName: "QA Overdue",
    },
    /* Delivered and paid: gives "paid" a real figure and ranks a product. */
    {
      deliveryDate: new Date(today.getTime() - 4 * DAY_MS).toISOString(),
      fulfilmentStatus: "DELIVERED",
      paymentStatus: "PAID",
      customerName: "QA Delivered",
      recipientName: "QA Recipient",
      recipientPhone: "+971500000009",
      cardMessage: "With love, from QA.",
      ...(product
        ? {
            items: [
              {
                productName: product.name,
                productSlug: product.slug,
                quantity: 2,
                unitPriceFils: 48_000,
                lineTotalFils: 96_000,
                product: product.id,
              },
            ],
          }
        : {}),
    },
  ];
  for (const overrides of orders) {
    const order = await payload.create({ collection: "orders", data: orderData(overrides) as never });
    state.orders.push(order.id);
    save();
  }

  /* The collection refuses a follow-up date in the past — deliberately, so a
     mistyped reminder is caught (backend/payload/hooks/enquiryIntegrity.ts).
     A fixture therefore cannot produce an OVERDUE follow-up; this is the next
     09:00 in the UAE, which exercises the field and the row's follow-up
     column. The dashboard's "follow-ups due" alert stays untested by fixtures
     as a result, and the QA report says so. */
  const uaeDay = new Date(today.getTime() + 4 * 3_600_000).toISOString().slice(0, 10);
  const atNine = new Date(`${uaeDay}T09:00:00+04:00`);
  const nextFollowUp = atNine.getTime() > today.getTime() ? atNine : new Date(atNine.getTime() + DAY_MS);

  const enquiries = [
    {
      type: "BUILD_YOUR_OWN",
      contactName: "QA Enquirer",
      contactEmail: `qa-enquiry-${stamp}@calanthe.invalid`,
      contactPhone: "+971500000002",
      subject: "QA: a hand-tied bouquet in blush",
      message: "Something soft in blush and cream, for a birthday.",
      status: "NEW",
      priority: "HIGH",
      source: "WEBSITE",
      buildYourOwn: {
        style: "romantic",
        flowers: ["roses", "peonies"],
        colours: ["blush", "white-cream"],
        size: "standard",
        quantity: 1,
        budgetFils: 60_000,
        deliveryLocation: "Dubai Marina",
        cardMessage: "Happy birthday",
      },
    },
    {
      type: "CONTACT",
      contactName: "QA Follow-up",
      contactEmail: `qa-followup-${stamp}@calanthe.invalid`,
      subject: "QA: a follow-up to make",
      message: "Please call me back about a standing order.",
      status: "IN_REVIEW",
      priority: "NORMAL",
      source: "WHATSAPP",
      followUpAt: nextFollowUp.toISOString(),
    },
  ];
  for (const data of enquiries) {
    const enquiry = await payload.create({ collection: "enquiries", data: data as never });
    state.enquiries.push(enquiry.id);
    save();
  }

  const event = await payload.create({
    collection: "events",
    data: {
      name: "QA Wedding Client",
      email: `qa-event-${stamp}@calanthe.invalid`,
      phone: "+971500000003",
      eventType: "wedding",
      description: "Ceremony and reception florals for 120 guests, palette in cream and olive.",
      status: "NEW",
      eventLocation: "QA Ballroom, Dubai",
      estimatedGuests: 120,
      budgetFils: 1_500_000,
      requestedServices: ["bridal-bouquet", "ceremony", "centrepieces"],
    } as never,
  });
  state.events.push(event.id);
  save();

  console.log(
    [
      "FIXTURES CREATED",
      `  owner: ${state.ownerEmail} / ${state.ownerPassword}`,
      `  staff: ${state.staffEmail} / ${state.staffPassword}`,
      `  orders: ${state.orders.length}  enquiries: ${state.enquiries.length}  events: ${state.events.length}  media: ${state.media.length}  users: ${state.users.length}`,
      `  product published: ${state.product?.id ?? "none"}`,
      `  state: ${statePath}`,
    ].join("\n"),
  );
  process.exit(0);
}

if (command === "cleanup") {
  const removed: string[] = [];
  const problems: string[] = [];
  const state: State | null = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : null;

  const drop = async (collection: "orders" | "enquiries" | "events" | "media" | "users" | "products", id: number, why: string) => {
    await payload
      .delete({ collection, id })
      .then(() => removed.push(`${collection} ${id} ${why}`))
      .catch((error) => problems.push(`${collection} ${id}: ${String(error).slice(0, 120)}`));
  };

  /* 1. Anything the state file knows about, orders first (they reference the
        product and the customer). */
  for (const id of state?.orders ?? []) await drop("orders", id, "");
  for (const id of state?.enquiries ?? []) await drop("enquiries", id, "");
  for (const id of state?.events ?? []) await drop("events", id, "");

  /* 2. Sweep by marker, for anything an interrupted run left behind. */
  const sweep = async (
    collection: "orders" | "enquiries" | "events" | "products",
    where: Record<string, unknown>,
  ) => {
    const found = await payload.find({ collection, where: where as never, limit: 200, depth: 0 }).catch(() => null);
    for (const doc of found?.docs ?? []) await drop(collection, doc.id, "(marker)");
  };
  await sweep("orders", { or: [{ customerEmail: { like: "qa-buyer-" } }, { customerName: { like: "QA " } }] });
  await sweep("enquiries", { contactEmail: { like: "@calanthe.invalid" } });
  await sweep("events", { email: { like: "@calanthe.invalid" } });
  /* Products the browser run created, never real catalogue rows. */
  await sweep("products", { name: { like: "QA Bouquet" } });

  /* 3. Put borrowed products back BEFORE their photo is deleted, so no
        product is ever left pointing at a missing image. */
  const qaPhotos = await payload.find({ collection: "media", where: { alt: { like: "QA " } }, limit: 200, depth: 0 });
  const qaPhotoIds = new Set(qaPhotos.docs.map((doc) => doc.id));

  const catalogue = await payload.find({ collection: "products", limit: 1000, depth: 0 });
  for (const product of catalogue.docs) {
    const ids = (product.images ?? [])
      .map((row) => (typeof row.image === "object" && row.image ? row.image.id : row.image))
      .filter((v): v is number => typeof v === "number");
    const keep = ids.filter((id) => !qaPhotoIds.has(id));
    if (keep.length === ids.length) continue;

    const restore = state?.product?.id === product.id ? state.product : null;
    await payload
      .update({
        collection: "products",
        id: product.id,
        data: {
          images: (restore ? restore.imageIds : keep).map((image) => ({ image })),
          /* A product cannot be available without a photo, so it goes back to
             hidden when nothing is left. */
          available: restore ? restore.available : keep.length > 0 && Boolean(product.available),
        } as never,
      })
      .then(() => removed.push(`product ${product.id} restored`))
      .catch((error) => problems.push(`product ${product.id}: ${String(error).slice(0, 120)}`));
  }

  for (const doc of qaPhotos.docs) await drop("media", doc.id, "(marker)");

  /* 4. Temporary accounts last: only the reserved QA domain, never a real one. */
  const accounts = await payload.find({
    collection: "users",
    where: { and: [{ email: { like: "qa-" } }, { email: { like: "@calanthe.invalid" } }] },
    limit: 200,
    depth: 0,
  });
  for (const doc of accounts.docs) await drop("users", doc.id, `(${doc.email})`);

  if (existsSync(statePath)) writeFileSync(statePath, JSON.stringify({ cleanedAt: new Date().toISOString() }, null, 2));

  console.log(
    [
      `FIXTURES REMOVED (${removed.length})`,
      ...removed.map((line) => `  - ${line}`),
      ...(problems.length ? ["", `PROBLEMS (${problems.length})`, ...problems.map((line) => `  ! ${line}`)] : []),
    ].join("\n"),
  );
  process.exit(0);
}

console.error(`unknown command: ${command}`);
process.exit(1);
