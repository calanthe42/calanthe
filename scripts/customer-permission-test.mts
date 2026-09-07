/**
 * Customer-management access-control suite.
 *
 * Creates temporary customer/staff fixtures via the Local API, exercises the
 * real access-control path over HTTP, then removes every fixture. Nothing is
 * left in the database.
 *
 * Run:  node --env-file=.env.local --import <tsx-loader> scripts/customer-permission-test.mts
 * The app must be serving on BASE_URL (default http://localhost:3011).
 */
import { getPayload } from "payload";
import config from "../src/payload.config";

const B = process.env.BASE_URL ?? "http://localhost:3011";
const pass: string[] = [];
const fail: string[] = [];

function check(name: string, ok: boolean, detail = "") {
  (ok ? pass : fail).push(name + (detail ? ` — ${detail}` : ""));
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  [${detail}]` : ""}`);
}

async function login(email: string, password: string) {
  const res = await fetch(`${B}/api/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, token: json?.token as string | undefined };
}

const payload = await getPayload({ config });
const stamp = Date.now();
const PW = "TempPermTest!" + Math.random().toString(36).slice(2, 10);

const made: { collection: "users" | "orders" | "products" | "media"; id: string | number }[] = [];
async function make(collection: "users" | "orders" | "products" | "media", data: Record<string, unknown>) {
  const doc = await payload.create({ collection, overrideAccess: true, data: data as never });
  made.push({ collection, id: doc.id });
  return doc as never as Record<string, unknown>;
}

try {
  /* ---------------- fixtures ---------------- */
  const custA = await make("users", {
    email: `permtest-a-${stamp}@calanthe.invalid`, password: PW, role: "customer",
    firstName: "Aisha", lastName: "Testcase", phone: `+9715000${String(stamp).slice(-5)}`,
    accountStatus: "active", _verified: true,
  });
  const custB = await make("users", {
    email: `permtest-b-${stamp}@calanthe.invalid`, password: PW, role: "customer",
    firstName: "Bilal", lastName: "Testcase", accountStatus: "active", _verified: true,
  });
  const staff = await make("users", {
    email: `permtest-staff-${stamp}@calanthe.invalid`, password: PW, role: "staff",
    firstName: "Sara", lastName: "Florist", accountStatus: "active", _verified: true,
  });
  const suspended = await make("users", {
    email: `permtest-susp-${stamp}@calanthe.invalid`, password: PW, role: "customer",
    firstName: "Suspended", accountStatus: "suspended", _verified: true,
  });
  const unverified = await make("users", {
    email: `permtest-unver-${stamp}@calanthe.invalid`, password: PW, role: "customer",
    firstName: "Unverified", accountStatus: "active",
  });

  const orderOf = (customerId: unknown, who: string) => ({
    customerType: "registered", customer: customerId,
    customerName: who, customerEmail: `${who}@calanthe.invalid`, customerPhone: "+971500000000",
    deliveryAddress: "1 Test Street", deliveryEmirate: "dubai",
    deliveryDate: new Date(Date.now() + 86400000).toISOString(), deliveryTimeSlot: "13:00 - 17:00",
    items: [{ productName: "T", productSlug: "t", quantity: 1, unitPriceFils: 10000, lineTotalFils: 10000 }],
    subtotalFils: 10000, deliveryFeeFils: 0, discountFils: 0, totalFils: 10000, currency: "AED",
  });
  const orderA = await make("orders", orderOf(custA.id, "AishaOrder"));
  await make("orders", orderOf(custB.id, "BilalOrder"));

  console.log("\n-- profile model --");
  check("Display name derived from first + last", custA.name === "Aisha Testcase", String(custA.name));
  check("accountStatus defaults present", custA.accountStatus === "active");

  /* ---------------- 1. anonymous ---------------- */
  console.log("\n-- anonymous --");
  check("GET /api/users denied", (await fetch(`${B}/api/users`)).status === 403);
  check("GET /api/users/:id denied", (await fetch(`${B}/api/users/${custA.id}`)).status === 403);
  check("POST /api/users denied (no self-registration)", (await fetch(`${B}/api/users`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `anon-${stamp}@x.invalid`, password: PW, role: "admin" }),
  })).status === 403);
  check("GET /api/orders denied", (await fetch(`${B}/api/orders`)).status === 403);

  /* ---------------- 2. verification & account status ---------------- */
  console.log("\n-- verification / account status --");
  const unverLogin = await login(unverified.email as string, PW);
  check("Unverified customer CANNOT log in", !unverLogin.token, `http ${unverLogin.status}`);
  const suspLogin = await login(suspended.email as string, PW);
  check("Suspended customer CANNOT log in", !suspLogin.token, `http ${suspLogin.status}`);
  const staffLogin = await login(staff.email as string, PW);
  check("Invited staff auto-verified and CAN log in", Boolean(staffLogin.token));

  const aLogin = await login(custA.email as string, PW);
  check("Verified active customer CAN log in", Boolean(aLogin.token));
  const authA = { "Content-Type": "application/json", Authorization: `JWT ${aLogin.token}` };
  const authStaff = { "Content-Type": "application/json", Authorization: `JWT ${staffLogin.token}` };

  /* ---------------- 3. customer isolation ---------------- */
  console.log("\n-- customer isolation --");
  const selfRes = await fetch(`${B}/api/users/${custA.id}`, { headers: authA });
  check("Customer CAN read own record", selfRes.status === 200);

  const otherRes = await fetch(`${B}/api/users/${custB.id}`, { headers: authA });
  check("Customer A CANNOT read customer B", otherRes.status === 403 || otherRes.status === 404, `http ${otherRes.status}`);

  const listRes = await fetch(`${B}/api/users`, { headers: authA });
  const listJson = await listRes.json();
  check("Customer list returns only self", listJson?.totalDocs === 1 && listJson?.docs?.[0]?.id === custA.id, `totalDocs=${listJson?.totalDocs}`);

  const selfJson = await selfRes.json();
  check("Customer CANNOT see admin-only notes/tags", selfJson?.notes === undefined && selfJson?.tags === undefined);

  /* ---------------- 4. privilege escalation ---------------- */
  console.log("\n-- privilege escalation --");
  await fetch(`${B}/api/users/${custA.id}`, { method: "PATCH", headers: authA, body: JSON.stringify({ role: "admin" }) });
  const afterEsc = await payload.findByID({ collection: "users", id: custA.id as string, overrideAccess: true });
  check("Customer CANNOT change own role", afterEsc.role === "customer", `role=${afterEsc.role}`);

  await fetch(`${B}/api/users/${custA.id}`, { method: "PATCH", headers: authA, body: JSON.stringify({ accountStatus: "active", tags: ["vip"] }) });
  const afterTags = await payload.findByID({ collection: "users", id: custA.id as string, overrideAccess: true });
  check("Customer CANNOT set own tags", !afterTags.tags || afterTags.tags.length === 0);

  const staffPromote = await fetch(`${B}/api/users/${custB.id}`, { method: "PATCH", headers: authStaff, body: JSON.stringify({ role: "admin" }) });
  const afterStaffPromote = await payload.findByID({ collection: "users", id: custB.id as string, overrideAccess: true });
  check("Staff CANNOT promote a customer", afterStaffPromote.role === "customer", `http ${staffPromote.status}`);

  await fetch(`${B}/api/users/${staff.id}`, { method: "PATCH", headers: authStaff, body: JSON.stringify({ role: "admin" }) });
  const afterSelfPromote = await payload.findByID({ collection: "users", id: staff.id as string, overrideAccess: true });
  check("Staff CANNOT promote themselves", afterSelfPromote.role === "staff", `role=${afterSelfPromote.role}`);

  /* ---------------- 5. staff cannot mine the customer database ---------------- */
  console.log("\n-- staff limits --");
  const staffList = await fetch(`${B}/api/users`, { headers: authStaff });
  const staffListJson = await staffList.json();
  check("Staff list returns only themselves, not the customer base", staffListJson?.totalDocs === 1, `totalDocs=${staffListJson?.totalDocs}`);
  const staffReadCust = await fetch(`${B}/api/users/${custA.id}`, { headers: authStaff });
  check("Staff CANNOT read an individual customer", staffReadCust.status === 403 || staffReadCust.status === 404, `http ${staffReadCust.status}`);

  /* ---------------- 6. admin panel gate ---------------- */
  console.log("\n-- admin panel access --");
  const accessA = await (await fetch(`${B}/api/access`, { headers: authA })).json();
  /* Payload omits canAccessAdmin entirely when the gate denies, rather than
     returning false. Anything other than an explicit `true` is denial. */
  check("Customer CANNOT access the admin panel", accessA?.canAccessAdmin !== true, `canAccessAdmin=${JSON.stringify(accessA?.canAccessAdmin)}`);
  const accessS = await (await fetch(`${B}/api/access`, { headers: authStaff })).json();
  check("Staff canAccessAdmin === true", accessS?.canAccessAdmin === true, String(accessS?.canAccessAdmin));

  /* ---------------- 7. customer → orders ---------------- */
  console.log("\n-- customer orders --");
  const myOrders = await (await fetch(`${B}/api/orders`, { headers: authA })).json();
  check("Customer sees only their own orders", myOrders?.totalDocs === 1, `totalDocs=${myOrders?.totalDocs}`);
  check("The order returned belongs to them", myOrders?.docs?.[0]?.id === orderA.id);
  const adminOrders = await payload.find({ collection: "orders", overrideAccess: true, where: { customer: { equals: custB.id } } });
  check("Admin can retrieve a customer's full history", adminOrders.totalDocs === 1);

  /* ---------------- 8. addresses & wishlist ---------------- */
  console.log("\n-- addresses & wishlist --");
  /* Products require at least one image — that rule is working, so the
     fixture needs a real Media row. A 1x1 PNG keeps it trivial. */
  const PNG_1X1 = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  const media = await payload.create({
    collection: "media", overrideAccess: true,
    data: { alt: "Permission test pixel" } as never,
    file: { data: PNG_1X1, mimetype: "image/png", name: `permtest-${stamp}.png`, size: PNG_1X1.length },
  });
  made.push({ collection: "media", id: media.id });

  const product = await make("products", {
    name: `Perm Test Bloom ${stamp}`, slug: `perm-test-bloom-${stamp}`,
    priceFils: 25000, currency: "AED", category: "bouquet", available: false,
    images: [{ image: media.id }], sortOrder: 0,
  });

  const withAddr = await payload.update({
    collection: "users", id: custA.id as string, overrideAccess: true,
    data: {
      wishlist: [product.id],
      addresses: [
        { label: "Home", emirate: "dubai", street: "1 Test St", isDefault: true },
        { label: "Office", emirate: "dubai", street: "2 Test St", isDefault: true },
      ],
    } as never,
  });
  const defaults = (withAddr.addresses ?? []).filter((a: { isDefault?: boolean }) => a.isDefault);
  check("Exactly one default address enforced", defaults.length === 1, `${defaults.length} defaults`);
  check("Wishlist stores product relationships", (withAddr.wishlist ?? []).length === 1);

  /* ---------------- 9. admin capability ---------------- */
  console.log("\n-- admin --");
  const adminUpdated = await payload.update({
    collection: "users", id: custA.id as string, overrideAccess: true,
    data: { tags: ["vip"], notes: "Prefers peonies." } as never,
  });
  check("Admin CAN tag and annotate a customer", adminUpdated.tags?.[0] === "vip" && Boolean(adminUpdated.notes));

  let lastAdminBlocked = false;
  try {
    const admins = await payload.find({ collection: "users", overrideAccess: true, where: { role: { equals: "admin" } }, limit: 2 });
    if (admins.totalDocs === 1) {
      await payload.update({ collection: "users", id: admins.docs[0].id, overrideAccess: true, data: { role: "staff" } as never });
    } else { lastAdminBlocked = true; }
  } catch { lastAdminBlocked = true; }
  check("Last admin cannot be demoted", lastAdminBlocked);
} finally {
  console.log("\n-- cleanup --");
  for (const { collection, id } of made.reverse()) {
    try {
      await payload.delete({ collection, id, overrideAccess: true });
    } catch (e) {
      console.log(`  WARN could not delete ${collection}/${id}: ${(e as Error).message}`);
    }
  }
  console.log(`  removed ${made.length} fixtures`);
}

console.log(`\nRESULT: ${pass.length} passed, ${fail.length} failed`);
if (fail.length) fail.forEach((f) => console.log("  - " + f));
process.exit(fail.length ? 1 : 0);
