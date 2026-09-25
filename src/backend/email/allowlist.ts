/**
 * Who a non-production deployment is allowed to email.
 *
 * WHY THIS IS NOT OPTIONAL. Preview runs against a COPY OF REAL CUSTOMER
 * DATA. Without a gate, moving a test order to "out for delivery" on a
 * preview deployment sends a real person a real email about a delivery that
 * is not happening, from an address they trust. The blast radius of a
 * staging environment should never include the customer.
 *
 * Production sends to everyone. Anywhere else sends only to the addresses
 * the owner has listed, and an unlisted address is SUPPRESSED — written to
 * the log with a reason, never silently dropped, because "the email did not
 * arrive" must always have an answer.
 */

export type AllowlistDecision =
  | { allowed: true }
  | { allowed: false; reason: string };

function normalise(address: string): string {
  return address.trim().toLowerCase();
}

/** Pulls the bare address out of `Name <a@b.c>`. */
export function bareAddress(address: string): string {
  const match = /<([^>]+)>/.exec(address);
  return normalise(match ? match[1] : address);
}

export function parseAllowlist(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;\s]+/)
    .map(normalise)
    .filter((a) => a.includes("@"));
}

export function decideRecipient(
  to: string,
  options: { vercelEnv: string | undefined; allowlist: string | undefined },
): AllowlistDecision {
  /* Production is the only environment that may email a stranger. */
  if (options.vercelEnv === "production") return { allowed: true };

  const list = parseAllowlist(options.allowlist);
  if (list.length === 0) {
    return {
      allowed: false,
      reason:
        "non-production deployment with an empty EMAIL_ALLOWLIST — nothing is sent outside production until addresses are listed",
    };
  }

  const target = bareAddress(to);
  if (list.includes(target)) return { allowed: true };

  /* A domain entry (`@example.com`) allows everyone at it, which is useful
     for a team's own domain and useless as an accidental wildcard. */
  const domain = target.slice(target.indexOf("@"));
  if (list.includes(domain)) return { allowed: true };

  return {
    allowed: false,
    reason: `${target} is not on EMAIL_ALLOWLIST for the ${options.vercelEnv ?? "local"} environment`,
  };
}
