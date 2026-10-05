import { COMPANY_EMAIL } from "@/lib/data";
import { env } from "@/lib/env";
import type { InternalAddresses } from "./order-emails";

/**
 * Which of the company's mailboxes the shop's own mail goes to.
 *
 * Until calanthe.ae had real mailboxes, every internal message — the owner's
 * "an order arrived", the florist's job sheet — went to the single reply-to
 * address, which was somebody's personal inbox. Each now has its own:
 *
 *   owner's notices      manager@calanthe.ae   (EMAIL_OWNER overrides)
 *   florist's job sheet  staff@calanthe.ae     (EMAIL_STAFF overrides)
 *   a customer's reply   support@calanthe.ae   (EMAIL_REPLY_TO overrides)
 *
 * The defaults are the company's addresses (lib/data.ts), so a deployment
 * with nothing configured still writes to the business and never to a
 * person. Outside production nothing is sent to any of them unless it is on
 * EMAIL_ALLOWLIST (backend/email/allowlist.ts).
 */
export function internalAddresses(): Required<InternalAddresses> {
  return {
    owner: env.EMAIL_OWNER ?? COMPANY_EMAIL.manager,
    florist: env.EMAIL_STAFF ?? COMPANY_EMAIL.staff,
  };
}

/** Where a customer's reply to any of our emails lands. */
export function replyToAddress(): string {
  return env.EMAIL_REPLY_TO ?? COMPANY_EMAIL.support;
}
