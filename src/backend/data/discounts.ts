import { cache } from "react";
import { getPayload, type Payload, type Where } from "payload";
import config from "@payload-config";
import type { Discount } from "@/payload-types";
import {
  isWellFormedCode,
  normaliseCode,
  type CouponRule,
  type SaleRule,
  type SaleScope,
} from "@/lib/discounts";

/**
 * The only place the storefront and checkout read discounts from the database.
 *
 * WHY overrideAccess: true, AND WHY THAT IS SAFE. The `discounts` collection
 * is readable by the owner alone — a code is a secret, a price is her
 * decision. A shopper has no user at all, so a read under the caller's own
 * permissions returns nothing and no sale or code would ever apply. Every
 * read here therefore bypasses access control, deliberately, and this module
 * is the allow-list that makes that safe: each function names the fields it
 * returns, and nothing else about a discount can leave it. In particular a
 * rule's `title` (the owner's internal name), `timesUsed` and `usageLimit`
 * stay on the server — backend/data/products.ts passes the browser a label
 * and a price, nothing more.
 *
 * The admin's own screens and actions do NOT use this file's bypass: they
 * pass the signed-in user and let the collection refuse a florist.
 *
 * No `import "server-only"` for the same reason as data/products.ts: the
 * Payload CLI loads this graph in plain Node.
 */

type Id = number | string | { id: number | string } | null | undefined;

const idOf = (value: Id): string | null => {
  if (value === null || value === undefined) return null;
  return String(typeof value === "object" ? value.id : value);
};

const ids = (values: readonly Id[] | null | undefined): string[] =>
  (values ?? []).map(idOf).filter((id): id is string => id !== null);

const value = (doc: Discount) => ({
  valueType: doc.valueType,
  percentOff: Number(doc.percentOff ?? 0),
  amountOffFils: Number(doc.amountOffFils ?? 0),
});

const timing = (doc: Discount) => ({
  active: doc.active === true,
  startsAt: doc.startsAt ?? null,
  endsAt: doc.endsAt ?? null,
});

/** Discount document → the rule the pricing engine reads. Pure. */
export function toSaleRule(doc: Discount): SaleRule {
  return {
    id: String(doc.id),
    title: doc.title,
    labelEn: doc.labelEn ?? "",
    labelAr: doc.labelAr ?? "",
    appliesTo: (doc.appliesTo ?? "all") as SaleScope,
    productIds: ids(doc.products),
    occasionIds: ids(doc.occasions),
    categories: [...(doc.categories ?? [])],
    ...value(doc),
    ...timing(doc),
  };
}

/** Discount document → the code the pricing engine reads. Pure. */
export function toCouponRule(doc: Discount): CouponRule {
  const limit = doc.usageLimit;
  return {
    id: String(doc.id),
    title: doc.title,
    code: doc.code ?? "",
    minSubtotalFils: Number(doc.minSubtotalFils ?? 0),
    usageLimit: limit === null || limit === undefined ? null : Number(limit),
    timesUsed: Number(doc.timesUsed ?? 0),
    oncePerCustomer: doc.oncePerCustomer === true,
    ...value(doc),
    ...timing(doc),
  };
}

/**
 * Every automatic sale that could be live right now.
 *
 * The query narrows; it does not decide. `bestSaleFor` re-checks each rule
 * against the clock it is given, so a sale that ended a millisecond ago is
 * ignored even if this query still returned it.
 */
export async function loadLiveSaleRules(payload: Payload, now: Date): Promise<SaleRule[]> {
  const at = now.toISOString();
  const found = await payload.find({
    collection: "discounts",
    /* See the note at the top of this file. */
    overrideAccess: true,
    where: {
      and: [
        { kind: { equals: "automatic" } },
        { active: { equals: true } },
        { or: [{ startsAt: { exists: false } }, { startsAt: { less_than_equal: at } }] },
        { or: [{ endsAt: { exists: false } }, { endsAt: { greater_than: at } }] },
      ],
    },
    depth: 0,
    limit: 100,
    pagination: false,
  });
  return found.docs.map(toSaleRule);
}

/**
 * The live sales, once per request.
 *
 * STRICT: a failure throws. Checkout uses this one — if the sales cannot be
 * read, an order must not be priced as though there were none.
 */
export const getLiveSaleRules = cache(async (): Promise<SaleRule[]> => {
  const payload = await getPayload({ config });
  return loadLiveSaleRules(payload, new Date());
});

/**
 * The same, for pages. A storefront page that cannot read the sales shows
 * regular prices rather than failing: the shop stays open, and checkout —
 * which is strict — will refuse to charge a total the customer was not shown.
 */
export const getLiveSaleRulesForDisplay = cache(async (): Promise<SaleRule[]> => {
  try {
    return await getLiveSaleRules();
  } catch (error) {
    console.error("[discounts] live sales could not be read; showing regular prices", error);
    return [];
  }
});

/**
 * A code, by what the customer typed — or null.
 *
 * The shape is checked BEFORE the database is asked, and the match is an
 * equality on the normalised code: nothing typed into the box can become a
 * pattern. Null for an unknown code and for a malformed one alike; whether
 * the code is live is the pricing engine's question, not this one's.
 */
export async function findCoupon(payload: Payload, raw: string): Promise<CouponRule | null> {
  const code = normaliseCode(raw);
  if (!isWellFormedCode(code)) return null;

  const found = await payload.find({
    collection: "discounts",
    overrideAccess: true,
    where: { and: [{ kind: { equals: "code" } }, { code: { equals: code } }] },
    depth: 0,
    limit: 1,
    pagination: false,
  });
  const doc = found.docs[0];
  return doc ? toCouponRule(doc) : null;
}

/** Has a PAID order from this email already used this code? */
export async function emailHasRedeemed(
  payload: Payload,
  couponId: string,
  email: string,
): Promise<boolean> {
  const address = email.trim().toLowerCase();
  if (!address) return false;
  const { totalDocs } = await payload.count({
    collection: "orders",
    overrideAccess: true,
    where: {
      and: [
        { couponDiscount: { equals: Number(couponId) } },
        { customerEmail: { equals: address } },
        { couponRedeemedAt: { exists: true } },
      ],
    },
  });
  return totalDocs > 0;
}

/* ------------------------------------------------------------------ */
/* Claims                                                              */
/* ------------------------------------------------------------------ */

/**
 * What counts as "a use" of a code, for the purpose of refusing the next one.
 *
 * `timesUsed` counts PAID orders only, and it must: an abandoned basket is
 * not a use. But a limit checked only against paid orders is not a limit —
 * twenty people can each start a checkout with a "first twenty" code and all
 * pay afterwards. So an order that is still payable HOLDS a claim:
 *
 *   redeemed          counted for ever (a refund does not give a use back)
 *   not cancelled     PENDING and still payable, or paid a moment ago
 *
 * A cancelled, unpaid order holds nothing. backend/payments/coupon-claims.ts
 * cancels the ones that went stale — and their PaymentIntents with them — so
 * a claim cannot be held open indefinitely, and a held order cannot be paid
 * after its claim was given to someone else.
 */
export function claimWhere(couponId: string): Where {
  return {
    and: [
      { couponDiscount: { equals: Number(couponId) } },
      {
        or: [
          { couponRedeemedAt: { exists: true } },
          { fulfilmentStatus: { not_equals: "CANCELLED" } },
        ],
      },
    ],
  };
}

export type CouponClaims = { total: number; forEmail: number };

/** Live claims on a code — optionally leaving one order (the caller's) out. */
export async function countCouponClaims(
  payload: Payload,
  couponId: string,
  options: { email?: string; excludeOrderId?: number } = {},
): Promise<CouponClaims> {
  const base: Where[] = [claimWhere(couponId)];
  if (options.excludeOrderId !== undefined) {
    base.push({ id: { not_equals: options.excludeOrderId } });
  }
  const address = options.email?.trim().toLowerCase();

  const [total, forEmail] = await Promise.all([
    payload.count({ collection: "orders", overrideAccess: true, where: { and: base } }),
    address
      ? payload.count({
          collection: "orders",
          overrideAccess: true,
          where: { and: [...base, { customerEmail: { equals: address } }] },
        })
      : Promise.resolve({ totalDocs: 0 }),
  ]);
  return { total: total.totalDocs, forEmail: forEmail.totalDocs };
}
