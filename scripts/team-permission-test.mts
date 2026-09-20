/**
 * Staff-administration access-control suite.
 *
 * Exercises the rules behind /admin/team over the REAL paths — HTTP for
 * everything a signed-in person could try, the Local API with
 * `overrideAccess: false` for the writes the server actions perform — then
 * removes every fixture. Nothing is left in the database.
 *
 * WHAT IT IS FOR. The Team screen hands an owner four powers that, done
 * wrongly, either lock the business out of itself or let a florist quietly
 * promote herself. The unit tests cover the arithmetic of the last-admin
 * guard; this covers the question the unit tests cannot: does the database
 * actually refuse the request.
 *
 * Run:  node --env-file=.env.local scripts/team-permission-test.mts
 * (Node 24 strips the types itself; imports therefore carry .ts extensions.)
 * The app must be serving on BASE_URL (default http://localhost:3000).
 *
 * THE PORT MATTERS. payload.config.ts sets `csrf: [NEXT_PUBLIC_SERVER_URL]`,
 * and Payload rejects a cookie-borne token whose request Origin is not on
 * that list. This suite authenticates with `Authorization: JWT` headers, so
 * it is unaffected — but team-flow-test.mts drives a browser, whose server
 * actions post with an Origin, and on the wrong port every one of them comes
 * back as "not signed in". Serve on the port NEXT_PUBLIC_SERVER_URL names.
 */
import { getPayload } from "payload";
import config from "../src/payload.config.ts";
import { temporaryPassword } from "../src/backend/domain/temporary-password.ts";

const B = process.env.BASE_URL ?? "http://localhost:3000";
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

function auth(token: string | undefined) {
  return token ? { Authorization: `JWT ${token}` } : {};
}

const payload = await getPayload({ config });
const stamp = Date.now();
const PW = "TeamPermTest!" + Math.random().toString(36).slice(2, 10);

const made: (string | number)[] = [];
async function make(data: Record<string, unknown>) {
  const doc = await payload.create({ collection: "users", overrideAccess: true, data: data as never });
  made.push(doc.id);
  return doc as unknown as { id: number; email: string };
}

/** Did this throw? Used where the expected outcome is a refusal. */
async function refused(run: () => Promise<unknown>): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "threw";
  }
}

try {
  /* ---------------- fixtures ---------------- */
  const owner = await make({
    email: `teamtest-owner-${stamp}@calanthe.invalid`,
    password: PW,
    role: "admin",
    firstName: "Owner",
    lastName: "Fixture",
    accountStatus: "active",
    _verified: true,
  });
  const staff = await make({
    email: `teamtest-staff-${stamp}@calanthe.invalid`,
    password: PW,
    role: "staff",
    firstName: "Staff",
    lastName: "Fixture",
    accountStatus: "active",
    _verified: true,
  });
  const customer = await make({
    email: `teamtest-cust-${stamp}@calanthe.invalid`,
    password: PW,
    role: "customer",
    firstName: "Customer",
    lastName: "Fixture",
    accountStatus: "active",
    _verified: true,
  });

  const ownerSession = await login(owner.email, PW);
  const staffSession = await login(staff.email, PW);
  const customerSession = await login(customer.email, PW);
  check("fixtures can sign in", Boolean(ownerSession.token && staffSession.token && customerSession.token));

  /* ---------------- 1. inviting ---------------- */

  /* Exactly what inviteTeamMember does: create as the owner, access on, with
     a generated password. The two things that could silently break it are a
     password the field rejects, and autoVerifyInvitedStaff failing to fire —
     which would leave the new florist unable to sign in at all, because the
     collection requires a verified address. */
  const issued = temporaryPassword();
  const invited = await payload.create({
    collection: "users",
    user: owner as never,
    overrideAccess: false,
    data: {
      firstName: "Invited",
      lastName: "Florist",
      email: `teamtest-invited-${stamp}@calanthe.invalid`,
      password: issued,
      role: "staff",
      accountStatus: "active",
    } as never,
  });
  made.push(invited.id);
  check("owner can create a staff account", Boolean(invited.id));
  check("invited staff is verified without an email", (invited as { _verified?: boolean })._verified === true);

  const invitedSession = await login(invited.email, issued);
  check("invited staff can sign in with the issued password", invitedSession.status === 200 && Boolean(invitedSession.token), `HTTP ${invitedSession.status}`);

  const staffCreate = await refused(() =>
    payload.create({
      collection: "users",
      user: staff as never,
      overrideAccess: false,
      data: {
        firstName: "Sneaky", email: `teamtest-sneak-${stamp}@calanthe.invalid`,
        password: PW, role: "admin", accountStatus: "active",
      } as never,
    }),
  );
  check("staff cannot create an account", staffCreate !== null, staffCreate ?? "was allowed");

  /* ---------------- 2. unlocking ---------------- */

  /* The hole this suite was written for: `unlock` had no access rule, and
     Payload treats an undefined rule as "any authenticated user". */
  async function unlock(token: string | undefined, email: string) {
    const res = await fetch(`${B}/api/users/unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth(token) },
      body: JSON.stringify({ email }),
    });
    return res.status;
  }

  check("staff cannot unlock another account", (await unlock(staffSession.token, owner.email)) === 403, `HTTP ${await unlock(staffSession.token, owner.email)}`);
  check("a customer cannot unlock an account", (await unlock(customerSession.token, owner.email)) === 403);
  check("an anonymous caller cannot unlock an account", (await unlock(undefined, owner.email)) === 403);
  check("the owner can unlock an account", (await unlock(ownerSession.token, staff.email)) === 200);

  /* ---------------- 3. reading the team ---------------- */

  const staffReadsOwner = await fetch(`${B}/api/users/${owner.id}`, { headers: auth(staffSession.token) });
  check("staff cannot read another account", staffReadsOwner.status === 403 || staffReadsOwner.status === 404, `HTTP ${staffReadsOwner.status}`);

  const staffList = await fetch(`${B}/api/users?limit=100`, { headers: auth(staffSession.token) });
  const staffDocs = (await staffList.json().catch(() => ({ docs: [] })))?.docs ?? [];
  check("staff listing users sees only themselves", staffDocs.length === 1 && staffDocs[0]?.id === staff.id, `${staffDocs.length} rows`);

  const ownerList = await fetch(`${B}/api/users?limit=200`, { headers: auth(ownerSession.token) });
  const ownerDocs = (await ownerList.json().catch(() => ({ docs: [] })))?.docs ?? [];
  check("the owner sees the whole team", ownerDocs.length >= 4, `${ownerDocs.length} rows`);

  /* ---------------- 4. privilege escalation ---------------- */

  const selfPromote = await fetch(`${B}/api/users/${staff.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...auth(staffSession.token) },
    body: JSON.stringify({ role: "admin" }),
  });
  const afterPromote = await payload.findByID({ collection: "users", id: staff.id, overrideAccess: true, depth: 0 });
  check("staff cannot promote themselves", afterPromote.role === "staff", `role is ${afterPromote.role} (HTTP ${selfPromote.status})`);

  const custPromote = await fetch(`${B}/api/users/${customer.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...auth(customerSession.token) },
    body: JSON.stringify({ role: "admin" }),
  });
  const afterCust = await payload.findByID({ collection: "users", id: customer.id, overrideAccess: true, depth: 0 });
  check("a customer cannot promote themselves", afterCust.role === "customer", `role is ${afterCust.role} (HTTP ${custPromote.status})`);

  const staffSuspendsOwner = await fetch(`${B}/api/users/${owner.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...auth(staffSession.token) },
    body: JSON.stringify({ accountStatus: "suspended" }),
  });
  const ownerStill = await payload.findByID({ collection: "users", id: owner.id, overrideAccess: true, depth: 0 });
  check("staff cannot suspend the owner", ownerStill.accountStatus === "active", `HTTP ${staffSuspendsOwner.status}`);

  /* ---------------- 5. suspension actually stops sign-in ---------------- */

  await payload.update({
    collection: "users",
    id: staff.id,
    user: owner as never,
    overrideAccess: false,
    data: { accountStatus: "suspended" } as never,
  });
  const suspendedLogin = await login(staff.email, PW);
  check("a suspended account cannot sign in", suspendedLogin.status !== 200 && !suspendedLogin.token, `HTTP ${suspendedLogin.status}`);

  await payload.update({
    collection: "users",
    id: staff.id,
    user: owner as never,
    overrideAccess: false,
    data: { accountStatus: "active" } as never,
  });
  const restoredLogin = await login(staff.email, PW);
  check("restoring access lets them sign in again", restoredLogin.status === 200, `HTTP ${restoredLogin.status}`);

  /* ---------------- 6. the last-admin guard, positive side ---------------- */

  /* The refusals are covered exhaustively by the unit tests, which can
     simulate "no other admin exists" — a state this script must never create
     against a real database. What is worth proving here is that the guard
     does NOT false-positive: with another usable admin present, the ordinary
     operations still work. */
  const demote = await refused(() =>
    payload.update({
      collection: "users", id: owner.id, overrideAccess: true, data: { role: "staff" } as never,
    }),
  );
  check("an admin can be demoted while another usable admin remains", demote === null, demote ?? "");
  await payload.update({ collection: "users", id: owner.id, overrideAccess: true, data: { role: "admin" } as never });

  const suspendAdmin = await refused(() =>
    payload.update({
      collection: "users", id: owner.id, overrideAccess: true, data: { accountStatus: "suspended" } as never,
    }),
  );
  check("an admin can be suspended while another usable admin remains", suspendAdmin === null, suspendAdmin ?? "");
  await payload.update({ collection: "users", id: owner.id, overrideAccess: true, data: { accountStatus: "active" } as never });

  /* ---------------- 7. removal ---------------- */

  const staffDeletes = await fetch(`${B}/api/users/${customer.id}`, { method: "DELETE", headers: auth(staffSession.token) });
  const stillThere = await payload.count({ collection: "users", overrideAccess: true, where: { id: { equals: customer.id } } });
  check("staff cannot delete an account", stillThere.totalDocs === 1, `HTTP ${staffDeletes.status}`);
} catch (error) {
  /* Without this the finally block's process.exit swallows the stack, and a
     suite that died on its first line reports "0 passed, 0 failed" — which
     reads like success and says nothing. */
  fail.push(`the run threw: ${error instanceof Error ? error.message : String(error)}`);
  console.error(error);
} finally {
  /* ---------------- cleanup ---------------- */
  let removed = 0;
  for (const id of made.reverse()) {
    try {
      await payload.delete({ collection: "users", id, overrideAccess: true });
      removed += 1;
    } catch (error) {
      console.error(`  CLEANUP FAILED for user ${id}:`, error instanceof Error ? error.message : error);
    }
  }
  const leftovers = await payload.count({
    collection: "users",
    overrideAccess: true,
    where: { email: { like: "teamtest-" } },
  });
  console.log(`\n  cleanup: ${removed}/${made.length} fixtures removed, ${leftovers.totalDocs} teamtest-* rows remain`);

  console.log(`\n${fail.length === 0 ? "ALL PASS" : "FAILURES"}  ${pass.length} passed, ${fail.length} failed`);
  for (const f of fail) console.log(`  FAIL  ${f}`);
  process.exit(fail.length === 0 && leftovers.totalDocs === 0 ? 0 : 1);
}
