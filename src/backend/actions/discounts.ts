"use server";

import { headers as nextHeaders } from "next/headers";
import { revalidatePath } from "next/cache";
import { getPayload, type Payload } from "payload";
import config from "@payload-config";
import { diffFields, recordActivity } from "@backend/activity/record";
import { loadDiscountProducts } from "@backend/data/discount-form";
import {
  discountFields,
  parseDiscountForm,
  type DiscountKind,
  type ParsedDiscount,
} from "@backend/domain/discount-form";
import {
  discountImpact,
  liveTermsChanged,
  tooDeepFor,
  type DiscountPreview,
} from "@backend/domain/discount-impact";
import { FormInputError } from "@backend/domain/form-error";
import { discountStatus } from "@/lib/discounts";
import { formatFils } from "@/lib/money";
import { actorOf, failure, type ActionResult } from "./admin-shared";

/**
 * Every write the owner makes to a discount.
 *
 * NO `overrideAccess` ANYWHERE IN THIS FILE. Each action resolves the
 * signed-in user and passes it to Payload, and the `discounts` collection is
 * owner-only for read, create, update and delete — so a florist calling any
 * of these is refused by the collection itself, with the same "you do not
 * have permission" every other admin action gives. Prices are the owner's
 * decision; this file does not need to say so twice.
 *
 * A DISCOUNT IS SAVED AS A DRAFT UNLESS SHE EXPLICITLY ACTIVATES IT. Going
 * live reprices the shop for everyone at once, and every order paid at that
 * price is honoured — so "live" is never a side effect of pressing Save:
 *
 *   · the form's Active switch is OFF by default, and a save without it is a
 *     draft: nothing changes on the store;
 *   · a save that would make the discount live NOW must carry the owner's
 *     confirmation (`confirmActivation`), which the screen sets only after
 *     showing her what will change, in numbers, from `previewDiscount`;
 *   · without that confirmation nothing is saved and the answer is
 *     `actions.discount.confirmNeeded` — the screen then shows the dialog.
 *
 * The same holds for the Activate button (`setDiscountActive`) and for
 * editing the terms of a discount that is already live. Scheduling one for
 * later, saving a draft, deactivating, and renaming a live discount change
 * nothing customers pay today and need no confirmation.
 *
 * Parsing is in backend/domain/discount-form.ts and the "what will change"
 * arithmetic in backend/domain/discount-impact.ts — both pure and tested.
 *
 * A DISCOUNT CODE CANNOT BE APPLIED TO A PAYMENT REQUEST. A florist sets
 * that amount by hand; the order collection refuses any discount on it.
 */

const LOGGED = [
  "title",
  "code",
  "valueType",
  "percentOff",
  "amountOffFils",
  "appliesTo",
  "startsAt",
  "endsAt",
  "active",
  "minSubtotalFils",
  "usageLimit",
  "oncePerCustomer",
] as const;

async function authed() {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await nextHeaders() });
  return { payload, user };
}

/** A change to a discount is on the site at the next request. */
function revalidate(id?: number) {
  revalidatePath("/admin/discounts");
  if (id !== undefined) revalidatePath(`/admin/discounts/${id}/edit`);
  /* The storefront reads sales in its layout and on most pages. */
  revalidatePath("/", "layout");
}

const CONFIRM_NEEDED: ActionResult = {
  ok: false,
  message: "Confirm that this discount should go live before it is saved as active.",
  code: "actions.discount.confirmNeeded",
};

/** Would this discount, saved active, be live right now? */
const liveNow = (window: { startsAt?: string | null; endsAt?: string | null }, now: Date): boolean =>
  discountStatus({ active: true, startsAt: window.startsAt, endsAt: window.endsAt }, now) === "active";

/** The sentence after a save, by what the discount now is. */
function savedResult(
  doc: { id: number; active?: boolean | null; startsAt?: string | null; endsAt?: string | null },
  now: Date,
): ActionResult {
  const status = discountStatus(
    { active: doc.active === true, startsAt: doc.startsAt, endsAt: doc.endsAt },
    now,
  );
  if (status === "active") {
    return {
      ok: true,
      message: "Discount saved. It is live on the store.",
      code: "actions.discount.savedLive",
      id: doc.id,
    };
  }
  if (status === "scheduled" && doc.startsAt) {
    const date = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Dubai",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(doc.startsAt));
    return {
      ok: true,
      message: `Discount saved. It starts on ${date}.`,
      code: "actions.discount.savedScheduled",
      vars: { date },
      id: doc.id,
    };
  }
  if (status === "expired") {
    return {
      ok: true,
      message: "Discount saved. Its end date has passed, so it is not running.",
      code: "actions.discount.savedExpired",
      id: doc.id,
    };
  }
  return {
    ok: true,
    message: "Discount saved as a draft.",
    code: "actions.discount.savedDraft",
    id: doc.id,
  };
}

/**
 * A fixed sale deeper than 90% of a product it applies to is refused, naming
 * the product. (Pricing caps it regardless; this catches the typing mistake.)
 */
async function refuseTooDeep(payload: Payload, user: unknown, parsed: ParsedDiscount): Promise<void> {
  if (parsed.kind !== "automatic" || parsed.valueType !== "fixed") return;
  const products = await loadDiscountProducts(payload, user);
  const deep = tooDeepFor(parsed, products);
  if (deep) {
    throw new FormInputError(
      `“${deep.name}” costs ${formatFils(deep.priceFils)}. A sale can take at most 90% off a product.`,
      "discountTooDeep",
      { name: deep.name, price: formatFils(deep.priceFils) },
    );
  }
}

/**
 * What saving this form as ACTIVE would change — for the confirmation dialog.
 *
 * Validates exactly as a save does and writes nothing. Owner-only by the
 * same route as everything else: the products are read as the caller, and a
 * read of the discounts collection decides whether she may be here at all.
 */
export async function previewDiscount(kind: DiscountKind, form: FormData): Promise<DiscountPreview> {
  const { payload, user } = await authed();
  try {
    /* The cheapest possible owner check: staff cannot read this collection. */
    await payload.find({ collection: "discounts", limit: 1, depth: 0, user, overrideAccess: false });

    const parsed = parseDiscountForm(form, kind);
    await refuseTooDeep(payload, user, parsed);
    const products = kind === "automatic" ? await loadDiscountProducts(payload, user) : [];
    return {
      ok: true,
      /* Only what customers can buy counts as "a price that changes". */
      impact: discountImpact(parsed, products.filter((p) => p.available), new Date()),
    };
  } catch (error) {
    return failure(error, "The discount could not be checked.", "actions.discount.saveFailed");
  }
}

export async function createDiscount(kind: DiscountKind, form: FormData): Promise<ActionResult> {
  const { payload, user } = await authed();
  try {
    if (kind !== "automatic" && kind !== "code") {
      throw new FormInputError("Choose a discount type.", "valueTypeRequired");
    }
    const parsed = parseDiscountForm(form, kind);
    await refuseTooDeep(payload, user, parsed);

    const now = new Date();
    if (parsed.active && liveNow(parsed, now) && !parsed.confirmed) return CONFIRM_NEEDED;

    const doc = await payload.create({
      collection: "discounts",
      user,
      overrideAccess: false,
      data: { kind, ...discountFields(parsed, parsed.active) } as never,
    });

    await recordActivity(payload, {
      actor: actorOf(user),
      action: "create",
      area: "other",
      collection: "discounts",
      itemId: doc.id,
      itemLabel: doc.title,
      changes: diffFields({}, doc as unknown as Record<string, unknown>, LOGGED),
    });

    revalidate(doc.id);
    return savedResult(doc, now);
  } catch (error) {
    return failure(error, "The discount could not be saved.", "actions.discount.saveFailed", "code");
  }
}

export async function updateDiscount(id: number, form: FormData): Promise<ActionResult> {
  const { payload, user } = await authed();
  try {
    const existing = await payload.findByID({
      collection: "discounts",
      id,
      depth: 0,
      user,
      overrideAccess: false,
    });

    /* The kind is fixed at creation; the form is read as that kind. */
    const parsed = parseDiscountForm(form, existing.kind);
    await refuseTooDeep(payload, user, parsed);

    const now = new Date();
    const data = discountFields(parsed, parsed.active);

    /* Going live, or changing what a live discount does, needs her yes. */
    const wasLive = existing.active === true && liveNow(existing, now);
    const becomesLive = parsed.active && liveNow(parsed, now);
    const termsChanged = liveTermsChanged(
      existing as unknown as Record<string, unknown>,
      data as Record<string, unknown>,
    );
    if (becomesLive && (!wasLive || termsChanged) && !parsed.confirmed) return CONFIRM_NEEDED;

    const updated = await payload.update({
      collection: "discounts",
      id,
      user,
      overrideAccess: false,
      data: data as never,
    });

    await recordActivity(payload, {
      actor: actorOf(user),
      action: "update",
      area: "other",
      collection: "discounts",
      itemId: id,
      itemLabel: updated.title,
      changes: diffFields(
        existing as unknown as Record<string, unknown>,
        updated as unknown as Record<string, unknown>,
        LOGGED,
      ),
    });

    revalidate(id);
    return savedResult(updated, now);
  } catch (error) {
    return failure(error, "The discount could not be saved.", "actions.discount.saveFailed", "code");
  }
}

/**
 * The Activate / Deactivate switch.
 *
 * Activating a discount that would be live NOW needs `confirmed: true` —
 * the screen passes it only after the owner has read the confirmation built
 * from `getDiscountImpact`. Deactivating needs nothing: it makes the
 * discount a draft, and nothing a customer pays goes down.
 */
export async function setDiscountActive(
  id: number,
  active: boolean,
  confirmed = false,
): Promise<ActionResult> {
  const { payload, user } = await authed();
  try {
    const existing = await payload.findByID({
      collection: "discounts",
      id,
      depth: 0,
      user,
      overrideAccess: false,
    });

    const now = new Date();
    if (active && existing.active !== true && liveNow(existing, now) && confirmed !== true) {
      return CONFIRM_NEEDED;
    }

    const updated = await payload.update({
      collection: "discounts",
      id,
      user,
      overrideAccess: false,
      data: { active },
    });

    await recordActivity(payload, {
      actor: actorOf(user),
      action: "update",
      area: "other",
      collection: "discounts",
      itemId: id,
      itemLabel: updated.title,
      changes: diffFields(
        existing as unknown as Record<string, unknown>,
        updated as unknown as Record<string, unknown>,
        ["active"],
      ),
    });

    revalidate(id);
    if (!active) {
      return { ok: true, message: "Discount deactivated.", code: "actions.discount.deactivated", id };
    }
    const saved = savedResult(updated, now);
    return saved.ok && saved.code === "actions.discount.savedLive"
      ? { ok: true, message: "Discount activated.", code: "actions.discount.activated", id }
      : saved;
  } catch (error) {
    return failure(error, "The discount could not be saved.", "actions.discount.saveFailed");
  }
}

/**
 * What activating an EXISTING discount would change — for the confirmation
 * the Activate button shows. Reads the stored discount; writes nothing.
 */
export async function getDiscountImpact(id: number): Promise<DiscountPreview> {
  const { payload, user } = await authed();
  try {
    const doc = await payload.findByID({
      collection: "discounts",
      id,
      depth: 0,
      user,
      overrideAccess: false,
    });
    const ids = (values: unknown): number[] =>
      (Array.isArray(values) ? values : [])
        .map((v) => Number(typeof v === "object" && v !== null ? (v as { id: unknown }).id : v))
        .filter((n) => Number.isInteger(n) && n > 0);

    const parsed: ParsedDiscount = {
      kind: doc.kind,
      title: doc.title,
      code: doc.code ?? null,
      valueType: doc.valueType,
      percentOff: doc.percentOff ?? null,
      amountOffFils: doc.amountOffFils ?? null,
      appliesTo: doc.appliesTo ?? "all",
      productIds: ids(doc.products),
      occasionIds: ids(doc.occasions),
      categories: [...(doc.categories ?? [])],
      labelEn: doc.labelEn ?? null,
      labelAr: doc.labelAr ?? null,
      startsAt: doc.startsAt ?? null,
      endsAt: doc.endsAt ?? null,
      active: true,
      confirmed: false,
      minSubtotalFils: doc.minSubtotalFils ?? null,
      usageLimit: doc.usageLimit ?? null,
      oncePerCustomer: doc.oncePerCustomer === true,
    };
    const products = doc.kind === "automatic" ? await loadDiscountProducts(payload, user) : [];
    return {
      ok: true,
      impact: discountImpact(parsed, products.filter((p) => p.available), new Date()),
    };
  } catch (error) {
    return failure(error, "The discount could not be checked.", "actions.discount.saveFailed");
  }
}

export async function deleteDiscount(id: number): Promise<ActionResult> {
  const { payload, user } = await authed();
  try {
    /* Read first: it is the owner check, and the name is needed afterwards. */
    const doc = await payload.findByID({
      collection: "discounts",
      id,
      depth: 0,
      user,
      overrideAccess: false,
    });

    /* A discount that an order used is kept: the order has its own snapshot,
       but the owner's history of what she ran should survive too. */
    const used = await payload
      .count({
        collection: "orders",
        user,
        overrideAccess: false,
        where: { or: [{ couponDiscount: { equals: id } }, { "items.sale": { equals: id } }] },
      })
      .then((r) => r.totalDocs);

    if (used > 0) {
      return {
        ok: false,
        message: `This discount was used on ${used} order${used === 1 ? "" : "s"}, so it is kept for your records. Deactivate it instead.`,
        code: "actions.discount.used",
        vars: { count: used },
      };
    }

    await payload.delete({ collection: "discounts", id, user, overrideAccess: false });

    await recordActivity(payload, {
      actor: actorOf(user),
      action: "delete",
      area: "other",
      collection: "discounts",
      itemId: id,
      itemLabel: doc.title,
    });

    revalidate();
    return {
      ok: true,
      message: `“${doc.title}” deleted.`,
      code: "actions.discount.deleted",
      vars: { name: doc.title },
    };
  } catch (error) {
    return failure(error, "The discount could not be deleted.", "actions.discount.deleteFailed");
  }
}
