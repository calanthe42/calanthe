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
 *   order notices        orders@, manager@ and staff@calanthe.ae (EMAIL_OWNER overrides; comma list)
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
    /* Every new and paid order goes to all three mailboxes, so if one person
       misses it another sees it (the client's rule, 10 Oct 2026). */
    owner: env.EMAIL_OWNER ?? [COMPANY_EMAIL.orders, COMPANY_EMAIL.manager, COMPANY_EMAIL.staff].join(", "),
    florist: env.EMAIL_STAFF ?? COMPANY_EMAIL.staff,
  };
}

/** Where a customer's reply to any of our emails lands. */
export function replyToAddress(): string {
  return env.EMAIL_REPLY_TO ?? COMPANY_EMAIL.support;
}
