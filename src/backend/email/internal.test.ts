import { beforeEach, describe, expect, it, vi } from "vitest";

/* The module reads the environment at import; give it one we can change. */
const fakeEnv = vi.hoisted(() => ({}) as Record<string, string | undefined>);
vi.mock("@/lib/env", () => ({ env: fakeEnv }));

import { COMPANY_EMAIL, CONTACT } from "@/lib/data";
import { internalAddresses, replyToAddress } from "./internal";

beforeEach(() => {
  for (const key of Object.keys(fakeEnv)) delete fakeEnv[key];
});

describe("the company's mailboxes", () => {
  it("are the seven addresses at calanthe.ae, spelled exactly", () => {
    expect(COMPANY_EMAIL).toEqual({
      orders: "orders@calanthe.ae",
      support: "support@calanthe.ae",
      manager: "manager@calanthe.ae",
      staff: "staff@calanthe.ae",
      dev: "dev@calanthe.ae",
      marketing: "marketing@calanthe.ae",
      careers: "careers@calanthe.ae",
    });
  });

  it("show customers the support address, never a personal one", () => {
    expect(CONTACT.email).toBe("support@calanthe.ae");
    expect(JSON.stringify(CONTACT)).not.toMatch(/gmail|hotmail|yahoo|outlook/i);
  });
});

describe("where the shop's own mail goes", () => {
  it("writes to the business by default: owner, florist and replies each have a mailbox", () => {
    expect(internalAddresses()).toEqual({ owner: "orders@calanthe.ae, manager@calanthe.ae, staff@calanthe.ae", florist: "staff@calanthe.ae" });
    expect(replyToAddress()).toBe("support@calanthe.ae");
  });

  it("lets each one be overridden on its own", () => {
    fakeEnv.EMAIL_OWNER = "boss@example.com";
    expect(internalAddresses()).toEqual({ owner: "boss@example.com", florist: "staff@calanthe.ae" });
    fakeEnv.EMAIL_STAFF = "florist@example.com";
    fakeEnv.EMAIL_REPLY_TO = "hello@example.com";
    expect(internalAddresses()).toEqual({ owner: "boss@example.com", florist: "florist@example.com" });
    expect(replyToAddress()).toBe("hello@example.com");
  });

  it("no longer sends the owner's mail to the reply-to address", () => {
    fakeEnv.EMAIL_REPLY_TO = "someone@example.com";
    expect(internalAddresses().owner).toBe("orders@calanthe.ae, manager@calanthe.ae, staff@calanthe.ae");
  });
});
