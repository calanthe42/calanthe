import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The customer's account actions, with everything real except the outside
 * world: Payload, the cookie jar, the throttle and the mail.
 */

type Doc = Record<string, unknown>;

/* ---- the request ---- */
const jar = { set: vi.fn(), delete: vi.fn() };
vi.mock("next/headers", () => ({
  cookies: async () => jar,
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.9" }),
}));
vi.mock("@/lib/i18n/server", async () => {
  const { en } = await import("@/lib/i18n/dictionary");
  return { getDictionary: async () => ({ locale: "en", t: en }) };
});
vi.mock("@backend/security/throttle", () => ({
  LIMITS: { customerLogin: {}, loginIdentity: {}, register: {}, verifyResend: {}, passwordResetIp: {} },
  clientAddress: async () => "203.0.113.9",
  throttle: async () => ({ allowed: true, retryAfterSeconds: 0 }),
  waitHint: () => "",
}));
const sendEmail = vi.fn(async () => ({ ok: true }));
vi.mock("@backend/email/send", () => ({ sendEmail: (...args: unknown[]) => sendEmail(...(args as [])) }));
vi.mock("@backend/email/templates", () => ({ verifyAddress: () => ({ subject: "s", html: "h", text: "t" }) }));
vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_SERVER_URL: "https://www.calanthe.ae" } }));

/* ---- Payload ---- */
vi.mock("@payload-config", () => ({ default: {} }));
const fakePayload = {
  create: vi.fn(async ({ data }: { data: Doc }) => ({ id: 31, ...data })),
  login: vi.fn(async () => ({ token: "jwt-for-31", user: { id: 31, role: "customer" } })),
  find: vi.fn(async () => ({ docs: [] as Doc[] })),
  update: vi.fn(async ({ data }: { data: Doc }) => data),
  verifyEmail: vi.fn(async () => true),
  resetPassword: vi.fn(async () => ({ token: "jwt-from-reset", user: { id: 31, role: "customer" } as Doc })),
  db: { findOne: vi.fn(async () => null as Doc | null) },
  auth: vi.fn(async () => ({ user: null })),
};
vi.mock("payload", () => ({ getPayload: async () => fakePayload }));

const { customerRegister, resendCustomerVerification, resetCustomerPassword, verifyCustomerEmail } =
  await import("./account");

const form = (over: Record<string, string> = {}) => {
  const f = new FormData();
  const fields = {
    name: "Layla Ahmed",
    email: "Layla@Example.com",
    password: "flowers-for-layla",
    confirmPassword: "flowers-for-layla",
    terms: "on",
    ...over,
  };
  for (const [key, value] of Object.entries(fields)) if (value !== "") f.set(key, value);
  return f;
};

/* Payload's own shape for a unique-field collision (backend/payload/validation-errors.ts). */
const emailTaken = () =>
  Object.assign(new Error("The following field is invalid: email"), {
    data: { errors: [{ path: "email", message: "Value must be unique" }] },
  });

beforeEach(() => {
  vi.clearAllMocks();
  fakePayload.create.mockImplementation(async ({ data }: { data: Doc }) => ({ id: 31, ...data }));
  fakePayload.login.mockResolvedValue({ token: "jwt-for-31", user: { id: 31, role: "customer" } });
  fakePayload.find.mockResolvedValue({ docs: [] });
  fakePayload.update.mockImplementation(async ({ data }: { data: Doc }) => data);
  fakePayload.resetPassword.mockResolvedValue({ token: "jwt-from-reset", user: { id: 31, role: "customer" } });
  fakePayload.db.findOne.mockResolvedValue(null);
});

describe("customerRegister — the account works at once", () => {
  it("refuses without the Terms box, and creates nothing", async () => {
    const result = await customerRegister(form({ terms: "" }));
    expect(result).toEqual({
      ok: false,
      field: "terms",
      message: "Please agree to the Terms and the Privacy Policy to create your account.",
    });
    expect(fakePayload.create).not.toHaveBeenCalled();
  });

  it("creates a customer who may sign in, keeps when she agreed, and pins the role", async () => {
    const tampered = form();
    tampered.set("role", "admin");
    await customerRegister(tampered);

    const data = (fakePayload.create.mock.calls[0]![0] as { data: Doc }).data;
    expect(data).toMatchObject({ email: "layla@example.com", role: "customer", _verified: true });
    expect(typeof data.termsAcceptedAt).toBe("string");
    expect(new Date(String(data.termsAcceptedAt)).getTime()).toBeGreaterThan(Date.now() - 60_000);
    /* Confirming the address is a separate step: it is never set here. */
    expect(data).not.toHaveProperty("emailConfirmedAt");
  });

  it("signs her in with the session cookie Payload's own login sets", async () => {
    expect(await customerRegister(form())).toEqual({ ok: true, email: "layla@example.com", signedIn: true });
    expect(fakePayload.login).toHaveBeenCalledWith({
      collection: "users",
      data: { email: "layla@example.com", password: "flowers-for-layla" },
    });
    expect(jar.set).toHaveBeenCalledWith(
      "payload-token",
      "jwt-for-31",
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" }),
    );
  });

  it("still says the account exists if the new session cannot start", async () => {
    fakePayload.login.mockRejectedValue(new Error("down"));
    expect(await customerRegister(form())).toEqual({ ok: true, email: "layla@example.com", signedIn: false });
    expect(jar.set).not.toHaveBeenCalled();
  });

  it("never signs anyone in to an address that already has an account", async () => {
    fakePayload.create.mockRejectedValue(emailTaken());
    const result = await customerRegister(form());
    expect(result).toMatchObject({ ok: false, field: "email" });
    expect(fakePayload.login).not.toHaveBeenCalled();
    expect(jar.set).not.toHaveBeenCalled();
  });
});

describe("resendCustomerVerification", () => {
  it("sends a fresh link to a customer who has not confirmed, and never locks her out", async () => {
    fakePayload.find.mockResolvedValue({ docs: [{ id: 31, role: "customer", emailConfirmedAt: null, name: "Layla" }] });
    await resendCustomerVerification("layla@example.com");
    const data = (fakePayload.update.mock.calls[0]![0] as { data: Doc }).data;
    expect(Object.keys(data)).toEqual(["_verificationToken"]);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("sends nothing to an address already confirmed, or to the team", async () => {
    fakePayload.find.mockResolvedValue({
      docs: [{ id: 31, role: "customer", emailConfirmedAt: "2026-10-30T09:00:00.000Z" }],
    });
    await resendCustomerVerification("layla@example.com");
    fakePayload.find.mockResolvedValue({ docs: [{ id: 2, role: "admin", emailConfirmedAt: null }] });
    await resendCustomerVerification("dev.calanthe@gmail.com");
    expect(sendEmail).not.toHaveBeenCalled();
    expect(fakePayload.update).not.toHaveBeenCalled();
  });
});

describe("verifyCustomerEmail", () => {
  it("confirms the address of the link's owner: that is what unlocks the gift", async () => {
    fakePayload.db.findOne.mockResolvedValue({ id: 31, emailConfirmedAt: null });
    expect(await verifyCustomerEmail("tok")).toEqual({ ok: true });
    expect(fakePayload.verifyEmail).toHaveBeenCalledWith({ collection: "users", token: "tok" });
    expect(fakePayload.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 31, overrideAccess: true, data: { emailConfirmedAt: expect.any(String) } }),
    );
  });

  it("keeps the first confirmation date", async () => {
    fakePayload.db.findOne.mockResolvedValue({ id: 31, emailConfirmedAt: "2026-10-01T00:00:00.000Z" });
    await verifyCustomerEmail("tok");
    expect(fakePayload.update).not.toHaveBeenCalled();
  });

  it("refuses a spent or unknown link", async () => {
    fakePayload.verifyEmail.mockRejectedValue(new Error("Verification token is invalid."));
    expect(await verifyCustomerEmail("old")).toMatchObject({ ok: false });
    expect(fakePayload.update).not.toHaveBeenCalled();
  });
});

describe("resetCustomerPassword — taking the account back", () => {
  const resetForm = (over: Record<string, string> = {}) => {
    const f = new FormData();
    const fields = { token: "reset-tok", password: "a-new-bouquet", confirmPassword: "a-new-bouquet", ...over };
    for (const [key, value] of Object.entries(fields)) f.set(key, value);
    return f;
  };

  /* The squatter's case: someone registered her address first and has been
     signed in since. Her reset must leave that session nothing to stand on. */
  it("ends every session the account had, once the new password is set", async () => {
    expect(await resetCustomerPassword(resetForm())).toEqual({ ok: true });
    expect(fakePayload.resetPassword).toHaveBeenCalledWith({
      collection: "users",
      data: { token: "reset-tok", password: "a-new-bouquet" },
      overrideAccess: true,
    });
    expect(fakePayload.update).toHaveBeenCalledWith({
      collection: "users",
      id: 31,
      overrideAccess: true,
      data: { sessions: [] },
    });
    /* The reset's own session is dropped too; no cookie is set for it. */
    expect(jar.set).not.toHaveBeenCalled();
  });

  it("touches nothing when the link is spent or unknown", async () => {
    fakePayload.resetPassword.mockRejectedValue(new Error("Token is either invalid or has expired."));
    expect(await resetCustomerPassword(resetForm())).toEqual({
      ok: false,
      message: "That link has expired or has already been used.",
    });
    expect(fakePayload.update).not.toHaveBeenCalled();
  });

  it("still reports the new password if the old sessions could not be ended", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    fakePayload.update.mockRejectedValue(new Error("connection reset"));
    expect(await resetCustomerPassword(resetForm())).toEqual({ ok: true });
    expect(quiet).toHaveBeenCalled();
    quiet.mockRestore();
  });

  it("checks the two passwords before spending the link", async () => {
    expect(await resetCustomerPassword(resetForm({ confirmPassword: "something-else" }))).toMatchObject({
      ok: false,
      field: "confirmPassword",
    });
    expect(fakePayload.resetPassword).not.toHaveBeenCalled();
  });
});
