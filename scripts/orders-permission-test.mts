/**
 * Orders permission test.
 *
 * Creates ONE temporary staff account and ONE test order via the Local API,
 * exercises every restriction through the real access-control path, then
 * deletes both. Nothing is left in the database.
 */
import { getPayload } from "payload";
import config from "../src/payload.config";

const B = process.env.BASE_URL ?? "http://localhost:3010";
const pass = [];
const fail = [];

function check(name, condition, detail = "") {
  (condition ? pass : fail).push(`${name}${detail ? " — " + detail : ""}`);
  console.log(`  ${condition ? "PASS" : "FAIL"}  ${name}${detail ? "  [" + detail + "]" : ""}`);
}

const payload = await getPayload({ config });

const STAFF_EMAIL = `temp-staff-permtest-${Date.now()}@calanthe.invalid`;
const STAFF_PASS = "TempPermTest!" + Math.random().toString(36).slice(2, 10);

let staff, order;

try {
  /* ---------- fixtures (server-side, overrideAccess) ---------- */
  staff = await payload.create({
    collection: "users",
    overrideAccess: true,
    data: { email: STAFF_EMAIL, password: STAFF_PASS, name: "Temp Perm Test", role: "staff" },
  });
  console.log(`\nfixture: staff user id=${staff.id} role=${staff.role}`);

  order = await payload.create({
    collection: "orders",
    overrideAccess: true,
    data: {
      customerType: "guest",
      customerName: "Perm Test Guest",
      customerEmail: "guest@calanthe.invalid",
      customerPhone: "+971500000000",
      deliveryAddress: "1 Test Street, Al Reem Island",
      deliveryEmirate: "abu-dhabi",
      deliveryDate: new Date(Date.now() + 86400000).toISOString(),
      deliveryTimeSlot: "13:00 - 17:00",
      items: [
        {
          productName: "Test Arrangement",
          productSlug: "test-arrangement",
          quantity: 2,
          unitPriceFils: 48000,
          lineTotalFils: 96000,
        },
      ],
      subtotalFils: 96000,
      deliveryFeeFils: 3500,
      discountFils: 0,
      totalFils: 99500,
      currency: "AED",
      source: "permission-test",
    },
  });
  console.log(`fixture: order id=${order.id} orderNumber=${order.orderNumber}\n`);

  check("Order number minted in CAL-000000 format", /^CAL-\d{6}$/.test(order.orderNumber ?? ""), order.orderNumber);
  check("Guest order has null customer", order.customer == null);
  check("paymentStatus defaults to PENDING", order.paymentStatus === "PENDING");
  check("fulfilmentStatus defaults to NEW", order.fulfilmentStatus === "NEW");

  /* ---------- authenticate as staff over HTTP ---------- */
  const loginRes = await fetch(`${B}/api/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: STAFF_EMAIL, password: STAFF_PASS }),
  });
  const loginJson = await loginRes.json();
  const token = loginJson.token;
  check("Staff can authenticate", Boolean(token));
  const auth = { "Content-Type": "application/json", Authorization: `JWT ${token}` };

  /* ---------- anonymous ---------- */
  console.log("\n-- anonymous --");
  check("GET /api/orders denied", (await fetch(`${B}/api/orders`)).status === 403);
  check(
    "POST /api/orders denied",
    (await fetch(`${B}/api/orders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).status === 403,
  );
  check(
    "DELETE /api/orders/:id denied",
    (await fetch(`${B}/api/orders/${order.id}`, { method: "DELETE" })).status === 403,
  );

  /* ---------- staff ---------- */
  console.log("\n-- staff --");
  const staffRead = await fetch(`${B}/api/orders`, { headers: auth });
  check("Staff CAN read orders", staffRead.status === 200);

  const delRes = await fetch(`${B}/api/orders/${order.id}`, { method: "DELETE", headers: auth });
  check("Staff CANNOT delete an order", delRes.status === 403, `status ${delRes.status}`);

  const payRes = await fetch(`${B}/api/orders/${order.id}`, {
    method: "PATCH", headers: auth, body: JSON.stringify({ paymentStatus: "PAID" }),
  });
  const afterPay = await payload.findByID({ collection: "orders", id: order.id, overrideAccess: true });
  check("Staff CANNOT set paymentStatus to PAID", afterPay.paymentStatus === "PENDING", `still ${afterPay.paymentStatus} (http ${payRes.status})`);

  await fetch(`${B}/api/orders/${order.id}`, {
    method: "PATCH", headers: auth, body: JSON.stringify({ totalFils: 1, subtotalFils: 1, customerName: "HACKED" }),
  });
  const afterSnap = await payload.findByID({ collection: "orders", id: order.id, overrideAccess: true });
  check("Staff CANNOT alter totalFils", Number(afterSnap.totalFils) === 99500, `= ${afterSnap.totalFils}`);
  check("Staff CANNOT alter customerName", afterSnap.customerName === "Perm Test Guest", `= ${afterSnap.customerName}`);

  const itemRes = await fetch(`${B}/api/orders/${order.id}`, {
    method: "PATCH", headers: auth,
    body: JSON.stringify({ items: [{ productName: "SWAPPED", productSlug: "x", quantity: 99, unitPriceFils: 1, lineTotalFils: 99 }] }),
  });
  const afterItems = await payload.findByID({ collection: "orders", id: order.id, overrideAccess: true, depth: 0 });
  check("Staff CANNOT rewrite order items", afterItems.items?.[0]?.productName === "Test Arrangement", `= ${afterItems.items?.[0]?.productName} (http ${itemRes.status})`);

  const fulRes = await fetch(`${B}/api/orders/${order.id}`, {
    method: "PATCH", headers: auth, body: JSON.stringify({ fulfilmentStatus: "PREPARING" }),
  });
  const afterFul = await payload.findByID({ collection: "orders", id: order.id, overrideAccess: true });
  check("Staff CAN update fulfilmentStatus", afterFul.fulfilmentStatus === "PREPARING", `= ${afterFul.fulfilmentStatus} (http ${fulRes.status})`);

  await fetch(`${B}/api/orders/${order.id}`, {
    method: "PATCH", headers: auth, body: JSON.stringify({ assignedStaff: staff.id, internalNotes: "staff note" }),
  });
  const afterAssign = await payload.findByID({ collection: "orders", id: order.id, overrideAccess: true, depth: 0 });
  check("Staff CAN set assignedStaff", String(afterAssign.assignedStaff) === String(staff.id));
  check("Staff CAN add internalNotes", afterAssign.internalNotes === "staff note");

  /* ---------- server-side payment path still works ---------- */
  console.log("\n-- server (payment provider context) --");
  const paid = await payload.update({
    collection: "orders", id: order.id, overrideAccess: true,
    context: { paymentProviderWrite: true },
    data: { paymentStatus: "PAID" },
  });
  check("Payment provider context CAN set PAID", paid.paymentStatus === "PAID");

  let blocked = false;
  try {
    await payload.update({ collection: "orders", id: order.id, overrideAccess: true, data: { paymentStatus: "REFUNDED" } });
  } catch { blocked = true; }
  check("overrideAccess WITHOUT payment context is blocked", blocked);

  /* ---------- integrity ---------- */
  console.log("\n-- integrity --");
  let totalsRejected = false;
  try {
    await payload.create({
      collection: "orders", overrideAccess: true,
      data: {
        customerType: "guest", customerName: "x", customerEmail: "x@y.invalid", customerPhone: "+971500000001",
        deliveryAddress: "a", deliveryEmirate: "dubai", deliveryDate: new Date().toISOString(), deliveryTimeSlot: "t",
        items: [{ productName: "p", productSlug: "p", quantity: 2, unitPriceFils: 100, lineTotalFils: 999 }],
        subtotalFils: 999, deliveryFeeFils: 0, discountFils: 0, totalFils: 999, currency: "AED",
      },
    });
  } catch { totalsRejected = true; }
  check("Mismatched line total rejected", totalsRejected);

  let typeRejected = false;
  try {
    await payload.create({
      collection: "orders", overrideAccess: true,
      data: {
        customerType: "registered", customerName: "x", customerEmail: "x@y.invalid", customerPhone: "+971500000002",
        deliveryAddress: "a", deliveryEmirate: "dubai", deliveryDate: new Date().toISOString(), deliveryTimeSlot: "t",
        items: [{ productName: "p", productSlug: "p", quantity: 1, unitPriceFils: 100, lineTotalFils: 100 }],
        subtotalFils: 100, deliveryFeeFils: 0, discountFils: 0, totalFils: 100, currency: "AED",
      },
    });
  } catch { typeRejected = true; }
  check("registered order without customer rejected", typeRejected);

  /* ---------- other collections still work ---------- */
  console.log("\n-- regression --");
  check("Products still readable", (await fetch(`${B}/api/products`)).status === 200);
  check("Events still denied to anon", (await fetch(`${B}/api/events`)).status === 403);
} finally {
  console.log("\n-- cleanup --");
  if (order) {
    await payload.delete({ collection: "orders", id: order.id, overrideAccess: true });
    console.log("  deleted test order");
  }
  if (staff) {
    await payload.delete({ collection: "users", id: staff.id, overrideAccess: true });
    console.log("  deleted temp staff user");
  }
}

console.log(`\nRESULT: ${pass.length} passed, ${fail.length} failed`);
if (fail.length) { console.log("FAILURES:"); fail.forEach((f) => console.log("  - " + f)); }
process.exit(fail.length ? 1 : 0);
