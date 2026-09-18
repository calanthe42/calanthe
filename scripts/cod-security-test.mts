/**
 * End-to-end security and functionality suite for COD checkout, product CRUD
 * and role separation.
 *
 * Uses the real server actions and the real Payload access model. Every
 * fixture it creates is removed at the end.
 */
import { getPayload } from "payload";
import config from "../src/payload.config";
import { priceOrder } from "../src/backend/domain/pricing";
import type { Product } from "../src/payload-types";

const B = process.env.BASE_URL ?? "http://localhost:3000";
const pass: string[] = [];
const fail: string[] = [];

function check(name: string, ok: boolean, detail = "") {
  (ok ? pass : fail).push(name + (detail ? ` — ${detail}` : ""));
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  [${detail}]` : ""}`);
}

const payload = await getPayload({ config });
const stamp = Date.now();
const PW = "CodTest!aA1";

type Slug = "users" | "orders" | "products" | "media";
const made: { collection: Slug; id: number | string }[] = [];

async function login(email: string, password: string) {
  const res = await fetch(`${B}/api/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: B },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json().catch(() => ({}));
  return json?.token as string | undefined;
}

try {
  /* ---------------- fixtures ---------------- */
  const admin = await payload.create({
    collection: "users", overrideAccess: true,
    data: { email: `cod-admin-${stamp}@calanthe.invalid`, password: PW, role: "admin",
      firstName: "Owner", accountStatus: "active", _verified: true } as never,
  });
  made.push({ collection: "users", id: admin.id });

  const staff = await payload.create({
    collection: "users", overrideAccess: true,
    data: { email: `cod-staff-${stamp}@calanthe.invalid`, password: PW, role: "staff",
      firstName: "Florist", accountStatus: "active", _verified: true } as never,
  });
  made.push({ collection: "users", id: staff.id });

  const customer = await payload.create({
    collection: "users", overrideAccess: true,
    data: { email: `cod-cust-${stamp}@calanthe.invalid`, password: PW, role: "customer",
      firstName: "Aisha", accountStatus: "active", _verified: true } as never,
  });
  made.push({ collection: "users", id: customer.id });

  /* A real 1x1 PNG so the product can legitimately be made available. */
  const PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  const media = await payload.create({
    collection: "media", overrideAccess: true,
    data: { alt: "COD test pixel" } as never,
    file: { data: PNG, mimetype: "image/png", name: `cod-${stamp}.png`, size: PNG.length },
  });
  made.push({ collection: "media", id: media.id });

  const product = await payload.create({
    collection: "products", overrideAccess: true,
    data: {
      name: `COD Test Bloom ${stamp}`, slug: `cod-test-bloom-${stamp}`,
      priceFils: 48000, currency: "AED", category: "bouquet",
      images: [{ image: media.id }], available: true, sortOrder: 0,
    } as never,
  });
  made.push({ collection: "products", id: product.id });

  console.log("\n-- product CRUD (via the access model) --");
  check("Admin can create an available product with a photo", product.available === true);

  const renamed = await payload.update({
    collection: "products", id: product.id, user: admin, overrideAccess: false,
    data: { name: `COD Test Bloom ${stamp} v2`, priceFils: 52000 } as never,
  });
  check("Admin can edit a product", renamed.name.endsWith("v2") && Number(renamed.priceFils) === 52000);

  let staffBlocked = false;
  try {
    await payload.update({
      collection: "products", id: product.id, user: staff, overrideAccess: false,
      data: { priceFils: 1 } as never,
    });
  } catch { staffBlocked = true; }
  const afterStaff = await payload.findByID({ collection: "products", id: product.id, overrideAccess: true });
  check("Staff CANNOT change a product price", staffBlocked || Number(afterStaff.priceFils) === 52000,
    `price=${Number(afterStaff.priceFils)}`);

  let availBlocked = false;
  try {
    const noPhoto = await payload.create({
      collection: "products", overrideAccess: true,
      data: { name: `No photo ${stamp}`, slug: `no-photo-${stamp}`, priceFils: 1000,
        currency: "AED", category: "bouquet", available: true, images: [] } as never,
    });
    made.push({ collection: "products", id: noPhoto.id });
  } catch { availBlocked = true; }
  check("A product CANNOT go available without a photograph", availBlocked);

  /* ---------------- COD checkout ---------------- */
  console.log("\n-- COD checkout: the server prices the order --");
  const products = new Map<string, Product>([[String(product.id), afterStaff as Product]]);

  const honest = priceOrder(
    [{ productId: String(product.id), quantity: 2, sizeId: "deluxe", addonIds: ["vase"] }],
    products, "dubai",
  );
  /* 520 + 140 deluxe + 60 vase = 720 AED each, x2 = 1440, free delivery. */
  check("Server prices from the catalogue", honest.subtotalFils === 144000, `${honest.subtotalFils} fils`);
  check("Free delivery applied over the threshold", honest.deliveryFeeFils === 0);
  check("Total reconciles exactly", honest.totalFils === honest.subtotalFils + honest.deliveryFeeFils);

  const tampered = priceOrder(
    [{ productId: String(product.id), quantity: 2, sizeId: "deluxe", addonIds: ["vase"],
       // @ts-expect-error deliberately smuggling price fields a client might send
       unitPriceFils: 1, lineTotalFils: 2, totalFils: 3 }],
    products, "dubai",
  );
  check("Client-supplied prices are ignored", tampered.totalFils === honest.totalFils,
    `${tampered.totalFils} fils`);

  const order = await payload.create({
    collection: "orders", overrideAccess: true,
    data: {
      customerType: "registered", customer: customer.id,
      customerName: "Aisha Test", customerEmail: "aisha@calanthe.invalid",
      customerPhone: "+971500000001",
      deliveryAddress: "1 Test Street", deliveryEmirate: "dubai",
      deliveryDate: new Date(Date.now() + 86400000).toISOString(),
      deliveryTimeSlot: "13:00 - 17:00",
      items: honest.lines.map((l) => ({
        product: Number(l.product.id), productName: l.productName, productSlug: l.productSlug,
        quantity: l.quantity, unitPriceFils: l.unitPriceFils, lineTotalFils: l.lineTotalFils,
      })),
      subtotalFils: honest.subtotalFils, deliveryFeeFils: honest.deliveryFeeFils,
      discountFils: 0, totalFils: honest.totalFils, currency: "AED",
      paymentStatus: "PENDING", fulfilmentStatus: "NEW", source: "web-checkout-cod",
    } as never,
  });
  made.push({ collection: "orders", id: order.id });

  check("COD order is created with a real number", /^CAL-\d{6}$/.test(String(order.orderNumber)),
    String(order.orderNumber));
  check("COD order is NOT marked paid", order.paymentStatus === "PENDING");
  check("COD order links to the customer", order.customerType === "registered");

  /* ---------------- payment security ---------------- */
  console.log("\n-- payment security --");
  const adminTok = await login(admin.email as string, PW);
  const staffTok = await login(staff.email as string, PW);
  const custTok = await login(customer.email as string, PW);

  for (const [who, tok] of [["Admin", adminTok], ["Staff", staffTok], ["Customer", custTok]] as const) {
    await fetch(`${B}/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Origin: B, Authorization: `JWT ${tok}` },
      body: JSON.stringify({ paymentStatus: "PAID" }),
    });
    const after = await payload.findByID({ collection: "orders", id: order.id, overrideAccess: true });
    check(`${who} CANNOT mark an order PAID`, after.paymentStatus === "PENDING", after.paymentStatus);
  }

  /* Only the payment-provider context may move it. */
  const paid = await payload.update({
    collection: "orders", id: order.id, overrideAccess: true,
    context: { paymentProviderWrite: true }, data: { paymentStatus: "PAID" } as never,
  });
  check("Payment provider context CAN mark it paid", paid.paymentStatus === "PAID");
  await payload.update({
    collection: "orders", id: order.id, overrideAccess: true,
    context: { paymentProviderWrite: true }, data: { paymentStatus: "PENDING" } as never,
  });

  /* ---------------- fulfilment & snapshot ---------------- */
  console.log("\n-- fulfilment and snapshot --");
  const moved = await payload.update({
    collection: "orders", id: order.id, user: staff, overrideAccess: false,
    data: { fulfilmentStatus: "PREPARING", internalNotes: "on the bench" } as never,
  });
  check("Staff CAN move fulfilment forward", moved.fulfilmentStatus === "PREPARING");
  check("Staff CAN add internal notes", moved.internalNotes === "on the bench");

  await payload.update({
    collection: "orders", id: order.id, user: admin, overrideAccess: false,
    data: { totalFils: 1, customerName: "HACKED" } as never,
  }).catch(() => undefined);
  const afterEdit = await payload.findByID({ collection: "orders", id: order.id, overrideAccess: true });
  check("Nobody can edit an order total", Number(afterEdit.totalFils) === honest.totalFils);
  check("Nobody can edit the customer snapshot", afterEdit.customerName === "Aisha Test");

  /* ---------------- customer ownership ---------------- */
  console.log("\n-- customer ownership --");
  const other = await payload.create({
    collection: "users", overrideAccess: true,
    data: { email: `cod-other-${stamp}@calanthe.invalid`, password: PW, role: "customer",
      firstName: "Bilal", accountStatus: "active", _verified: true } as never,
  });
  made.push({ collection: "users", id: other.id });
  const otherTok = await login(other.email as string, PW);

  const mine = await fetch(`${B}/api/orders`, {
    headers: { Origin: B, Authorization: `JWT ${custTok}` },
  }).then((r) => r.json());
  check("Customer sees only their own orders", mine?.totalDocs === 1, `totalDocs=${mine?.totalDocs}`);

  const theirs = await fetch(`${B}/api/orders`, {
    headers: { Origin: B, Authorization: `JWT ${otherTok}` },
  }).then((r) => r.json());
  check("Customer B sees none of customer A's orders", theirs?.totalDocs === 0, `totalDocs=${theirs?.totalDocs}`);

  const direct = await fetch(`${B}/api/orders/${order.id}`, {
    headers: { Origin: B, Authorization: `JWT ${otherTok}` },
  });
  check("Customer B cannot open customer A's order by id", direct.status === 403 || direct.status === 404,
    `http ${direct.status}`);

  /* ---------------- admin access ---------------- */
  console.log("\n-- admin interface access --");
  for (const [who, tok, expected] of [
    ["Customer", custTok, false], ["Staff", staffTok, true], ["Admin", adminTok, true],
  ] as const) {
    const res = await fetch(`${B}/admin`, {
      headers: { Origin: B, Cookie: `payload-token=${tok}` }, redirect: "manual",
    });
    const reached = res.status === 200;
    check(`${who} ${expected ? "CAN" : "CANNOT"} reach /admin`, reached === expected, `http ${res.status}`);
  }

  const anon = await fetch(`${B}/admin`, { redirect: "manual" });
  check("Anonymous cannot reach /admin", anon.status !== 200, `http ${anon.status}`);

  console.log("\n-- storefront hides nothing it should show --");
  const publicProducts = await fetch(`${B}/api/products`).then((r) => r.json());
  check("Available product is publicly visible", publicProducts?.totalDocs >= 1,
    `totalDocs=${publicProducts?.totalDocs}`);
} finally {
  console.log("\n-- cleanup --");
  for (const { collection, id } of made.reverse()) {
    try {
      await payload.delete({ collection, id: id as number, overrideAccess: true });
    } catch (e) {
      console.log(`  WARN ${collection}/${id}: ${(e as Error).message}`);
    }
  }
  console.log(`  removed ${made.length} fixtures`);
}

console.log(`\nRESULT: ${pass.length} passed, ${fail.length} failed`);
if (fail.length) fail.forEach((f) => console.log("  - " + f));
process.exit(fail.length ? 1 : 0);
