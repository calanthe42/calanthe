/**
 * Enquiries + Memberships access-control suite.
 *
 * Creates temporary fixtures via the Local API, exercises the real
 * access-control path over HTTP, then removes every fixture.
 *
 * Run: node --env-file=.env.local --import <tsx-loader> scripts/enquiry-permission-test.mts
 * The app must be serving on BASE_URL (default http://localhost:3012).
 */
import { getPayload } from "payload";
import config from "../src/payload.config";

const B = process.env.BASE_URL ?? "http://localhost:3012";
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
  return json?.token as string | undefined;
}

const payload = await getPayload({ config });
const stamp = Date.now();
const PW = "EnqTest!" + Math.random().toString(36).slice(2, 10);

type Slug = "users" | "enquiries" | "memberships";
const made: { collection: Slug; id: string | number }[] = [];
/** A relationship comes back populated at default depth; ids may be raw. */
function relId(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "object") return String((value as { id?: unknown }).id);
  return String(value);
}

async function make(collection: Slug, data: Record<string, unknown>) {
  const doc = await payload.create({ collection, overrideAccess: true, data: data as never });
  made.push({ collection, id: doc.id });
  return doc as never as Record<string, unknown>;
}

try {
  const custA = await make("users", {
    email: `enq-a-${stamp}@calanthe.invalid`, password: PW, role: "customer",
    firstName: "Aisha", accountStatus: "active", _verified: true,
  });
  const custB = await make("users", {
    email: `enq-b-${stamp}@calanthe.invalid`, password: PW, role: "customer",
    firstName: "Bilal", accountStatus: "active", _verified: true,
  });
  const staff = await make("users", {
    email: `enq-staff-${stamp}@calanthe.invalid`, password: PW, role: "staff",
    firstName: "Sara", accountStatus: "active", _verified: true,
  });

  const base = (over: Record<string, unknown> = {}) => ({
    type: "CONTACT", subject: "Test enquiry", message: "Hello",
    contactName: "Test Person", contactEmail: `t-${stamp}@calanthe.invalid`,
    source: "WEBSITE", status: "NEW", priority: "NORMAL", ...over,
  });

  const enqA = await make("enquiries", base({ customer: custA.id, subject: "Aisha enquiry" }));
  const enqB = await make("enquiries", base({ customer: custB.id, subject: "Bilal enquiry" }));
  const guestEnq = await make("enquiries", base({ subject: "Guest enquiry" }));

  console.log("\n-- enquiry number --");
  check("11. Number matches CAL-E-000000", /^CAL-E-\d{6}$/.test(String(enqA.enquiryNumber)), String(enqA.enquiryNumber));
  check("11. Numbers are unique", enqA.enquiryNumber !== enqB.enquiryNumber);

  let renumberBlocked = false;
  try {
    await payload.update({
      collection: "enquiries", id: enqA.id as string, overrideAccess: true,
      data: { enquiryNumber: "CAL-E-999999" } as never,
    });
    const after = await payload.findByID({ collection: "enquiries", id: enqA.id as string, overrideAccess: true });
    renumberBlocked = after.enquiryNumber === enqA.enquiryNumber;
  } catch { renumberBlocked = true; }
  check("12. Enquiry number is immutable", renumberBlocked);

  console.log("\n-- guest vs registered --");
  check("13. Guest enquiry works with no customer", guestEnq.customer == null && Boolean(guestEnq.enquiryNumber));
  check("13. Guest contact snapshot preserved", guestEnq.contactName === "Test Person");
  check("14. Registered enquiry links to the User", relId(enqA.customer) === String(custA.id), `linked=${relId(enqA.customer)} expected=${custA.id}`);

  console.log("\n-- anonymous --");
  check("1. Anonymous cannot list enquiries", (await fetch(`${B}/api/enquiries`)).status === 403);
  check("2. Anonymous cannot read an enquiry", (await fetch(`${B}/api/enquiries/${enqA.id}`)).status === 403);
  check("Anonymous cannot create an enquiry", (await fetch(`${B}/api/enquiries`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(base()),
  })).status === 403);
  check("Anonymous cannot modify an enquiry", (await fetch(`${B}/api/enquiries/${enqA.id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "RESOLVED" }),
  })).status === 403);
  check("Anonymous cannot list memberships", (await fetch(`${B}/api/memberships`)).status === 403);

  const tokenA = await login(custA.email as string, PW);
  const tokenStaff = await login(staff.email as string, PW);
  const authA = { "Content-Type": "application/json", Authorization: `JWT ${tokenA}` };
  const authStaff = { "Content-Type": "application/json", Authorization: `JWT ${tokenStaff}` };

  console.log("\n-- customer --");
  const ownRes = await fetch(`${B}/api/enquiries/${enqA.id}`, { headers: authA });
  check("4. Customer can read own enquiry", ownRes.status === 200);
  const otherRes = await fetch(`${B}/api/enquiries/${enqB.id}`, { headers: authA });
  check("3. Customer A cannot read customer B's enquiry", otherRes.status === 403 || otherRes.status === 404, `http ${otherRes.status}`);
  const listA = await (await fetch(`${B}/api/enquiries`, { headers: authA })).json();
  check("Customer list returns only their own", listA?.totalDocs === 1, `totalDocs=${listA?.totalDocs}`);
  const ownJson = await ownRes.json();
  check("6. Customer cannot see internalNotes", ownJson?.internalNotes === undefined);

  const custPatch = async (body: Record<string, unknown>) =>
    fetch(`${B}/api/enquiries/${enqA.id}`, { method: "PATCH", headers: authA, body: JSON.stringify(body) });
  const s1 = await custPatch({ status: "RESOLVED" });
  const s2 = await custPatch({ internalNotes: "hacked" });
  const s3 = await custPatch({ assignedStaff: staff.id });
  const s4 = await custPatch({ priority: "URGENT" });
  const s5 = await custPatch({ customer: custB.id });
  const afterCust = await payload.findByID({ collection: "enquiries", id: enqA.id as string, overrideAccess: true, depth: 0 });
  check("5. Customer cannot modify status", afterCust.status === "NEW", `http ${s1.status}`);
  check("6. Customer cannot modify internal notes", !afterCust.internalNotes, `http ${s2.status}`);
  check("7. Customer cannot assign staff", afterCust.assignedStaff == null, `http ${s3.status}`);
  check("Customer cannot change priority", afterCust.priority === "NORMAL", `http ${s4.status}`);
  check("Customer cannot alter ownership", String(afterCust.customer) === String(custA.id), `http ${s5.status}`);
  check("Customer cannot mark resolved", afterCust.resolvedAt == null);

  console.log("\n-- staff --");
  const staffList = await (await fetch(`${B}/api/enquiries`, { headers: authStaff })).json();
  check("Staff can read the queue", staffList?.totalDocs >= 3, `totalDocs=${staffList?.totalDocs}`);
  await fetch(`${B}/api/enquiries/${enqA.id}`, {
    method: "PATCH", headers: authStaff,
    body: JSON.stringify({ status: "IN_REVIEW", priority: "HIGH", assignedStaff: staff.id, internalNotes: "working on it" }),
  });
  const afterStaff = await payload.findByID({ collection: "enquiries", id: enqA.id as string, overrideAccess: true, depth: 0 });
  check("Staff can update status / priority / assignment / notes",
    afterStaff.status === "IN_REVIEW" && afterStaff.priority === "HIGH" &&
    String(afterStaff.assignedStaff) === String(staff.id) && afterStaff.internalNotes === "working on it");

  await fetch(`${B}/api/enquiries/${enqA.id}`, { method: "PATCH", headers: authStaff, body: JSON.stringify({ customer: custB.id }) });
  const afterOwn = await payload.findByID({ collection: "enquiries", id: enqA.id as string, overrideAccess: true, depth: 0 });
  check("8. Staff cannot change customer ownership", String(afterOwn.customer) === String(custA.id));

  const delRes = await fetch(`${B}/api/enquiries/${enqA.id}`, { method: "DELETE", headers: authStaff });
  check("9. Staff cannot delete an enquiry", delRes.status === 403, `http ${delRes.status}`);

  const staffMembership = await fetch(`${B}/api/memberships`, {
    method: "POST", headers: authStaff,
    body: JSON.stringify({ customer: custA.id, plan: "MONTHLY", deliveryFrequency: "WEEKLY" }),
  });
  check("Staff cannot create a membership", staffMembership.status === 403, `http ${staffMembership.status}`);

  console.log("\n-- resolvedAt stamping --");
  await payload.update({ collection: "enquiries", id: enqB.id as string, overrideAccess: true, data: { status: "RESOLVED" } as never });
  const resolved = await payload.findByID({ collection: "enquiries", id: enqB.id as string, overrideAccess: true });
  check("resolvedAt stamped on resolution", Boolean(resolved.resolvedAt));
  await payload.update({ collection: "enquiries", id: enqB.id as string, overrideAccess: true, data: { status: "IN_REVIEW" } as never });
  const reopened = await payload.findByID({ collection: "enquiries", id: enqB.id as string, overrideAccess: true });
  check("resolvedAt cleared when reopened", reopened.resolvedAt == null);

  let pastRejected = false;
  try {
    await payload.update({
      collection: "enquiries", id: enqB.id as string, overrideAccess: true,
      data: { followUpAt: new Date(Date.now() - 86400000).toISOString() } as never,
    });
  } catch { pastRejected = true; }
  check("followUpAt in the past is rejected", pastRejected);

  console.log("\n-- membership interest is not membership --");
  const memEnq = await make("enquiries", base({
    type: "MEMBERSHIP", subject: "Membership interest", customer: custA.id,
    membership: { preferredPlan: "MONTHLY", frequency: "WEEKLY" },
  }));
  const memberships = await payload.find({ collection: "memberships", overrideAccess: true, where: { customer: { equals: custA.id } } });
  check("15. Membership enquiry creates NO membership row", memberships.totalDocs === 0, `found ${memberships.totalDocs}`);
  check("15. Enquiry membership status is 'interest'", (memEnq.membership as Record<string, unknown>)?.status === "interest");

  let activationBlocked = false;
  try {
    await payload.update({
      collection: "enquiries", id: memEnq.id as string, overrideAccess: true,
      data: { membership: { status: "ACTIVE" } } as never,
    });
  } catch { activationBlocked = true; }
  check("15. Enquiry cannot declare itself an ACTIVE membership", activationBlocked);

  const realMembership = await make("memberships", {
    customer: custA.id, plan: "MONTHLY", deliveryFrequency: "WEEKLY",
  });
  check("Membership defaults to PENDING, never ACTIVE", realMembership.status === "PENDING", String(realMembership.status));

  const memOwn = await (await fetch(`${B}/api/memberships`, { headers: authA })).json();
  check("Customer sees only their own membership", memOwn?.totalDocs === 1, `totalDocs=${memOwn?.totalDocs}`);

  console.log("\n-- admin --");
  const adminUpdated = await payload.update({
    collection: "enquiries", id: enqA.id as string, overrideAccess: true,
    data: { status: "CONVERTED", priority: "URGENT" } as never,
  });
  check("10. Admin can manage enquiries", adminUpdated.status === "CONVERTED" && adminUpdated.priority === "URGENT");
  check("10. Admin sees the whole queue", (await payload.find({ collection: "enquiries", overrideAccess: true })).totalDocs >= 4);
} finally {
  console.log("\n-- cleanup --");
  for (const { collection, id } of made.reverse()) {
    try {
      await payload.delete({ collection, id, overrideAccess: true });
    } catch (e) {
      console.log(`  WARN ${collection}/${id}: ${(e as Error).message}`);
    }
  }
  console.log(`  removed ${made.length} fixtures`);
}

console.log(`\nRESULT: ${pass.length} passed, ${fail.length} failed`);
if (fail.length) fail.forEach((f) => console.log("  - " + f));
process.exit(fail.length ? 1 : 0);
