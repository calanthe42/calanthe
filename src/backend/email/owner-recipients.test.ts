import { expect, it, vi } from "vitest";

/* The module reads the environment at import; nothing set = the defaults. */
vi.mock("@/lib/env", () => ({ env: {} }));

import { ownerRecipients } from "@backend/email/order-emails";
import { internalAddresses } from "@backend/email/internal";

it("sends every order notice to orders@, manager@ and staff@", () => {
  expect(ownerRecipients(internalAddresses().owner)).toEqual([
    "orders@calanthe.ae",
    "manager@calanthe.ae",
    "staff@calanthe.ae",
  ]);
});

it("keeps each address once, and ignores blanks", () => {
  expect(ownerRecipients(" a@x.ae, ,b@x.ae, a@x.ae ")).toEqual(["a@x.ae", "b@x.ae"]);
  expect(ownerRecipients(undefined)).toEqual([]);
});
