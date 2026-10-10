import { expect, it } from "vitest";
import { ownerRecipients } from "@backend/email/order-emails";
import { internalAddresses } from "@backend/email/internal";
it("sends the order notice to orders@, manager@ and staff@", () => {
  expect(ownerRecipients(internalAddresses().owner)).toEqual(["orders@calanthe.ae", "manager@calanthe.ae", "staff@calanthe.ae"]);
});
