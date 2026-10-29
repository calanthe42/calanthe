/**
 * THE WELCOME GIFT — the rules that need no database.
 *
 * A new account's first order takes the welcome discount: one code-kind row
 * marked `discounts.welcome`, applied by the server and never typed. It is
 * given once per PERSON, and a person is the inbox an address reaches, not
 * the text that was typed. At Gmail `ne.ttt+3@gmail.com`, `nettt+5@gmail.com`
 * and `nettt@googlemail.com` are one mailbox; counted as three people, the
 * gift would be free for ever to anyone with one Gmail account.
 *
 * Pure, so it is tested here. backend/data/welcome.ts asks the same
 * questions of the orders table and writes the same key in SQL.
 */

/** The cache tag of the gift row (backend/data/welcome.ts), revalidated when the owner edits a discount. */
export const WELCOME_TAG = "welcome-offer";

/** Domains that ignore dots in the local part: Gmail, under both its names. */
export const DOTLESS_DOMAINS: readonly string[] = ["gmail.com", "googlemail.com"];

/**
 * The mailbox an address reaches: lower case, a `+tag` dropped at any
 * domain, and at Gmail the dots dropped and googlemail folded into gmail.
 * Split at the FIRST `@`, as Postgres `split_part` does, so the two agree.
 */
export function emailIdentityKey(email: string): string {
  const address = String(email ?? "").trim().toLowerCase();
  const at = address.indexOf("@");
  if (at <= 0 || at === address.length - 1) return address;

  let local = address.slice(0, at);
  let domain = address.slice(at + 1);
  const plus = local.indexOf("+");
  if (plus >= 0) local = local.slice(0, plus);
  if (DOTLESS_DOMAINS.includes(domain)) {
    local = local.replace(/\./g, "");
    domain = "gmail.com";
  }
  return `${local}@${domain}`;
}

/** Payment states that mean an order was really paid for. */
export const PAID_PAYMENT_STATES = ["PAID", "AUTHORIZED", "REFUNDED", "PARTIALLY_REFUNDED"] as const;

export type WelcomeAccount = {
  role?: string | null;
  accountStatus?: string | null;
  anonymisedAt?: string | null;
  /** When she followed the link we emailed (or Google confirmed it). */
  emailConfirmedAt?: string | null;
};

/**
 * May this signed-in account be offered the gift at all, before any order
 * is counted? A customer, not suspended or closed, not anonymised, and with
 * her address confirmed — the confirmation is what makes "one per inbox"
 * mean anything. An account works before that; the gift does not.
 */
export function accountMayHaveWelcome(user: WelcomeAccount | null | undefined): boolean {
  if (!user || user.role !== "customer") return false;
  if (user.accountStatus === "suspended" || user.accountStatus === "closed") return false;
  if (user.anonymisedAt) return false;
  return Boolean(user.emailConfirmedAt);
}

/**
 * What the orders say about one person.
 *
 *   paidOrders   orders of hers that were paid for, with or without the gift
 *   claims       orders that hold the gift: redeemed, or not cancelled
 */
export type WelcomeStanding = { paidOrders: number; claims: number };

/** The gift is for a FIRST order, and only once. */
export const welcomeStillOpen = (standing: WelcomeStanding): boolean =>
  standing.paidOrders === 0 && standing.claims === 0;
