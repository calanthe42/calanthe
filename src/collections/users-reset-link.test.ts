import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_SERVER_URL: "https://www.calanthe.ae" } }));

import { Users } from "./Users";

type ForgotConfig = { generateEmailHTML: (args: { token: string; user: { role: string; firstName?: string } }) => string };
const html = (role: string) =>
  ((Users.auth as { forgotPassword: ForgotConfig }).forgotPassword).generateEmailHTML({ token: "abc123", user: { role, firstName: "Layla" } });

describe("the password reset email", () => {
  it("sends staff and owners to the admin's reset page", () => {
    expect(html("admin")).toContain("https://www.calanthe.ae/admin/reset-password?token=abc123");
    expect(html("staff")).toContain("https://www.calanthe.ae/admin/reset-password?token=abc123");
  });

  it("sends customers to the storefront's reset page — a page that exists", () => {
    expect(html("customer")).toContain("https://www.calanthe.ae/account/reset-password?token=abc123");
    expect(html("customer")).not.toContain("/account/reset?");
  });
});
