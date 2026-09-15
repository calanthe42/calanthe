"use server";

import { headers as nextHeaders } from "next/headers";
import { revalidatePath } from "next/cache";
import { getPayload } from "payload";
import config from "@payload-config";
import { getMediaUsage } from "@backend/data/media-usage";
import { followUpIsoFromDateInput } from "@backend/domain/dates";
import { FormInputError } from "@backend/domain/form-error";
import { listNames, toMediaOption, type MediaOption } from "@backend/domain/media-option";
import {
  parseAedToFils,
  parseIdList,
  parseProductForm,
  parseSlug,
  parseWholeNumber,
  readChecked,
  readText,
  within,
  type ParsedProduct,
} from "@backend/domain/product-form";
import {
  lexicalToPlainText,
  plainTextToLexical,
  sameDescription,
} from "@backend/domain/richtext";

/**
 * Every write the business admin performs.
 *
 * NO `overrideAccess` ANYWHERE IN THIS FILE. Each action resolves the
 * signed-in user and passes it to Payload, so the collection's own access
 * rules decide what happens: staff cannot delete an order, cannot reassign a
 * customer, cannot touch pricing; nobody can edit an order's amounts or move
 * payment state. The admin UI is a client of the permission model, not an
 * exception to it — if an action is refused here, that is the model working.
 *
 * The only file in the codebase that does use overrideAccess is
 * actions/checkout.ts, for the documented reason stated there.
 *
 * Parsing lives in backend/domain (pure, unit-tested). These functions do only
 * what needs a server: who is asking, saving, and refreshing the pages that
 * show what changed.
 *
 * MESSAGES. Every result carries an English `message` and, where one exists, a
 * `code` — a path into the admin dictionary — with its `vars`. The admin shows
 * the code in the reader's language and falls back to the message. The backend
 * itself stays free of any knowledge of languages.
 */

export type ActionVars = Record<string, string | number>;

export type ActionResult =
  | { ok: true; message: string; code?: string; vars?: ActionVars; id?: number; media?: MediaOption }
  | { ok: false; message: string; code?: string; vars?: ActionVars };

type Failure = Extract<ActionResult, { ok: false }>;

async function authed() {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await nextHeaders() });
  return { payload, user };
}

type ValidationDetail = { message?: unknown; path?: unknown };

/** Turns anything thrown into a sentence a florist can act on. */
function failure(error: unknown, fallback: string, fallbackCode: string): Failure {
  if (error instanceof FormInputError) {
    return {
      ok: false,
      message: error.message,
      code: error.code ? `actions.validation.${error.code}` : undefined,
      vars: error.vars,
    };
  }

  const raw = error instanceof Error ? error.message : "";
  if (/not allowed|forbidden|unauthori[sz]ed/i.test(raw)) {
    return { ok: false, message: "You do not have permission to do that.", code: "actions.permission" };
  }

  const details = (error as { data?: { errors?: ValidationDetail[] } } | null)?.data?.errors;
  const first = Array.isArray(details) ? details[0] : undefined;
  const detail = typeof first?.message === "string" ? first.message : "";
  const combined = `${raw} ${detail} ${typeof first?.path === "string" ? first.path : ""}`;

  if ((/slug/i.test(combined) && /unique|duplicate|already/i.test(combined)) || /duplicate key/i.test(raw)) {
    return {
      ok: false,
      message: "That web address is already in use. Choose a different one.",
      code: "actions.slugTaken",
    };
  }
  /* Validation errors thrown by the collections' hooks are already written
     for people, in English. Anything long or multi-line is a stack, never
     shown. */
  if (detail && detail.length < 200) return { ok: false, message: detail };
  if (raw && raw.length < 300 && !raw.includes("\n")) return { ok: false, message: raw };
  return { ok: false, message: fallback, code: fallbackCode };
}

/**
 * The storefront reads the catalogue in its layout (search, cart pricing) and
 * on most pages, so a catalogue change refreshes all of it — otherwise an edit
 * made here would wait for the five-minute revalidation window to appear.
 */
function revalidateStorefront() {
  revalidatePath("/", "layout");
}

/* ------------------------------------------------------------------ */
/* Products                                                            */
/* ------------------------------------------------------------------ */

function productFields(parsed: ParsedProduct) {
  return {
    name: parsed.name,
    shortDescription: parsed.shortDescription,
    priceFils: parsed.priceFils,
    compareAtPriceFils: parsed.compareAtPriceFils,
    currency: "AED" as const,
    category: parsed.category,
    flowers: parsed.flowers,
    occasions: parsed.occasions,
    images: parsed.imageIds.map((image) => ({ image })),
    available: parsed.available,
    featured: parsed.featured,
    bestseller: parsed.bestseller,
    newArrival: parsed.newArrival,
    seasonal: parsed.seasonal,
    trackStock: parsed.trackStock,
    sortOrder: parsed.sortOrder,
    ...(parsed.stock !== undefined ? { stock: parsed.stock } : {}),
  };
}

export async function createProduct(form: FormData): Promise<ActionResult> {
  const { payload, user } = await authed();
  try {
    const parsed = parseProductForm(form);
    const description = plainTextToLexical(parsed.descriptionText);

    const doc = await payload.create({
      collection: "products",
      user,
      overrideAccess: false,
      data: {
        ...productFields(parsed),
        /* No slug given: the collection's hook derives one from the name. */
        ...(parsed.slug ? { slug: parsed.slug } : {}),
        ...(description ? { description } : {}),
        seo: {
          title: parsed.seoTitle,
          description: parsed.seoDescription,
          noIndex: parsed.noIndex,
        },
      } as never,
    });

    revalidatePath("/admin/products");
    revalidateStorefront();
    return {
      ok: true,
      message: `“${doc.name}” created.`,
      code: "actions.product.created",
      vars: { name: doc.name },
      id: doc.id,
    };
  } catch (error) {
    return failure(error, "The product could not be created.", "actions.product.createFailed");
  }
}

export async function updateProduct(id: number, form: FormData): Promise<ActionResult> {
  const { payload, user } = await authed();
  try {
    const parsed = parseProductForm(form);

    const existing = await payload.findByID({
      collection: "products",
      id,
      depth: 0,
      user,
      overrideAccess: false,
    });

    const shareImage = existing.seo?.image;
    const data: Record<string, unknown> = {
      ...productFields(parsed),
      seo: {
        title: parsed.seoTitle,
        description: parsed.seoDescription,
        noIndex: parsed.noIndex,
        /* Not edited on this screen; carried so saving never clears it. */
        image: typeof shareImage === "object" && shareImage ? shareImage.id : (shareImage ?? null),
      },
    };

    /* An empty web address on an existing product means "keep it". */
    if (parsed.slug) data.slug = parsed.slug;

    /* Only when the words changed — see backend/domain/richtext.ts. A price
       edit must never flatten formatting added elsewhere. */
    if (!sameDescription(parsed.descriptionText, lexicalToPlainText(existing.description))) {
      data.description = plainTextToLexical(parsed.descriptionText);
    }

    await payload.update({
      collection: "products",
      id,
      user,
      overrideAccess: false,
      data: data as never,
    });

    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${id}/edit`);
    revalidateStorefront();
    return { ok: true, message: "Changes saved.", code: "actions.product.saved" };
  } catch (error) {
    return failure(error, "Your changes could not be saved.", "actions.product.saveFailed");
  }
}

export async function deleteProduct(id: number): Promise<ActionResult> {
  const { payload, user } = await authed();
  try {
    /* Products that have been ordered are hidden, never deleted: the orders
       keep their own snapshot, but the catalogue's history should too
       (collections/Products.ts). */
    const ordered = await payload
      .count({
        collection: "orders",
        user,
        overrideAccess: false,
        where: { "items.product": { equals: id } },
      })
      .then((r) => r.totalDocs)
      .catch(() => 0);

    if (ordered > 0) {
      return {
        ok: false,
        message: `This product is part of ${ordered} order${ordered === 1 ? "" : "s"}, so it is kept for your records. Turn off “Available to buy” to hide it instead.`,
        code: "actions.product.ordered",
        vars: { count: ordered },
      };
    }

    const doc = await payload.delete({ collection: "products", id, user, overrideAccess: false });
    revalidatePath("/admin/products");
    revalidateStorefront();
    return {
      ok: true,
      message: `“${doc.name}” deleted.`,
      code: "actions.product.deleted",
      vars: { name: doc.name },
    };
  } catch (error) {
    return failure(error, "The product could not be deleted.", "actions.product.deleteFailed");
  }
}

/* ------------------------------------------------------------------ */
/* Media                                                               */
/* ------------------------------------------------------------------ */

const UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_ALT_LENGTH = 200;

const DESCRIBE_FIRST: Failure = {
  ok: false,
  message: "Describe the photograph first — for example “Blush peonies in a cream vase”.",
  code: "actions.media.describe",
};
const ALT_TOO_LONG: Failure = {
  ok: false,
  message: "Keep the alt text under 200 characters.",
  code: "actions.media.altTooLong",
};

/**
 * Upload a photograph.
 *
 * Goes through Payload's upload pipeline, so it lands in whatever storage is
 * configured — Vercel Blob in production, local disk in development — and
 * sharp still generates the four sizes. Nothing about storage changes here.
 *
 * Returns the new photo so the picker can show and select it immediately,
 * without a page reload losing whatever the owner has typed into the product.
 */
export async function uploadMedia(form: FormData): Promise<ActionResult> {
  const { payload, user } = await authed();
  const file = form.get("file");
  const alt = readText(form.get("alt"));

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose a photograph to upload.", code: "actions.media.chooseFile" };
  }
  if (!UPLOAD_TYPES.includes(file.type)) {
    return { ok: false, message: "Use a JPEG, PNG, WebP or AVIF photograph.", code: "actions.media.badType" };
  }
  if (!alt) return DESCRIBE_FIRST;
  if (alt.length > MAX_ALT_LENGTH) return ALT_TOO_LONG;
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      message: "That photo is larger than 4 MB. Please use a smaller file.",
      code: "actions.media.tooLarge",
    };
  }

  try {
    const doc = await payload.create({
      collection: "media",
      user,
      overrideAccess: false,
      data: { alt } as never,
      file: {
        data: Buffer.from(await file.arrayBuffer()),
        mimetype: file.type,
        name: file.name,
        size: file.size,
      },
    });
    revalidatePath("/admin/media");
    const media = toMediaOption(doc);
    return {
      ok: true,
      message: "Photo uploaded.",
      code: "actions.media.uploaded",
      id: doc.id,
      ...(media ? { media } : {}),
    };
  } catch (error) {
    return failure(error, "The upload failed. Please try again.", "actions.media.uploadFailed");
  }
}

/**
 * Change a photograph's alt text.
 *
 * Staff may do this (media update is staff-level in the permission model).
 * The storefront shows alt text on product pages, so it is refreshed too.
 */
export async function updateMediaAlt(id: number, form: FormData): Promise<ActionResult> {
  const { payload, user } = await authed();
  const alt = readText(form.get("alt"));
  if (!alt) return DESCRIBE_FIRST;
  if (alt.length > MAX_ALT_LENGTH) return ALT_TOO_LONG;

  try {
    await payload.update({ collection: "media", id, user, overrideAccess: false, data: { alt } as never });
    revalidatePath("/admin/media");
    revalidateStorefront();
    return { ok: true, message: "Alt text saved.", code: "actions.media.altSaved" };
  } catch (error) {
    return failure(error, "The alt text could not be saved.", "actions.media.altFailed");
  }
}

export async function deleteMedia(id: number): Promise<ActionResult> {
  const { payload, user } = await authed();
  try {
    /* Refused while anything uses it, naming what does — rather than a
       product page quietly losing its photograph. */
    const usedBy = (await getMediaUsage()).get(id) ?? [];
    if (usedBy.length > 0) {
      return {
        ok: false,
        message: `This photo is used by ${listNames(usedBy)}. Remove it there first, then delete it.`,
        code: "actions.media.inUse",
        vars: { names: usedBy.join(", ") },
      };
    }
    await payload.delete({ collection: "media", id, user, overrideAccess: false });
    revalidatePath("/admin/media");
    return { ok: true, message: "Photo deleted.", code: "actions.media.deleted" };
  } catch (error) {
    return failure(error, "The photo could not be deleted.", "actions.media.deleteFailed");
  }
}

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */

const FULFILMENT_DONE: Record<string, string> = {
  CONFIRMED: "Order confirmed.",
  PREPARING: "Marked as being prepared.",
  READY: "Marked ready to go.",
  OUT_FOR_DELIVERY: "Marked out for delivery.",
  DELIVERED: "Marked delivered.",
  CANCELLED: "Order cancelled.",
};

/**
 * Fulfilment only.
 *
 * There is deliberately no payment equivalent of this function. Payment state
 * moves through a provider webhook and nowhere else (docs/ADMIN.md §3: "No
 * button marks an order paid. There is nothing to click."). Adding one here
 * would defeat guardPaymentStatus and the field-level lock behind it.
 */
export async function updateOrderFulfilment(
  id: number,
  fulfilmentStatus: string,
): Promise<ActionResult> {
  const { payload, user } = await authed();
  try {
    await payload.update({
      collection: "orders",
      id,
      user,
      overrideAccess: false,
      data: { fulfilmentStatus } as never,
    });
    revalidatePath("/admin/orders");
    revalidatePath("/admin");
    const known = fulfilmentStatus in FULFILMENT_DONE;
    return {
      ok: true,
      message: FULFILMENT_DONE[fulfilmentStatus] ?? "Status updated.",
      code: known ? `actions.order.fulfilment.${fulfilmentStatus}` : "actions.order.statusUpdated",
    };
  } catch (error) {
    return failure(error, "The status could not be updated.", "actions.order.statusFailed");
  }
}

export async function updateOrderOperations(id: number, form: FormData): Promise<ActionResult> {
  const { payload, user } = await authed();
  try {
    const assigned = parseIdList(form.getAll("assignedStaff"))[0];
    await payload.update({
      collection: "orders",
      id,
      user,
      overrideAccess: false,
      data: {
        internalNotes: readText(form.get("internalNotes")),
        assignedStaff: assigned ?? null,
      } as never,
    });
    revalidatePath("/admin/orders");
    return { ok: true, message: "Order notes saved.", code: "actions.order.notesSaved" };
  } catch (error) {
    return failure(error, "The order could not be updated.", "actions.order.updateFailed");
  }
}

/* ------------------------------------------------------------------ */
/* Occasions                                                           */
/* ------------------------------------------------------------------ */

function occasionFields(form: FormData) {
  const name = within(readText(form.get("name")), 80, "The name");
  if (!name) throw new FormInputError("Give the occasion a name.", "occasionName");

  const description = within(readText(form.get("description")), 600, "The description");
  const slug = parseSlug(readText(form.get("slug")));
  const [imageId] = parseIdList(form.getAll("imageId"));

  return {
    name,
    ...(slug ? { slug } : {}),
    description: description || null,
    image: imageId ?? null,
    sortOrder: parseWholeNumber(readText(form.get("sortOrder")), "Order", true) ?? 0,
    active: readChecked(form.get("active")),
  };
}

export async function createOccasion(form: FormData): Promise<ActionResult> {
  const { payload, user } = await authed();
  try {
    const data = occasionFields(form);
    const doc = await payload.create({
      collection: "occasions",
      user,
      overrideAccess: false,
      data: data as never,
    });
    revalidatePath("/admin/occasions");
    revalidateStorefront();
    return {
      ok: true,
      message: `“${doc.name}” created.`,
      code: "actions.occasion.created",
      vars: { name: doc.name },
      id: doc.id,
    };
  } catch (error) {
    return failure(error, "The occasion could not be created.", "actions.occasion.createFailed");
  }
}

export async function updateOccasion(id: number, form: FormData): Promise<ActionResult> {
  const { payload, user } = await authed();
  try {
    await payload.update({
      collection: "occasions",
      id,
      user,
      overrideAccess: false,
      data: occasionFields(form) as never,
    });
    revalidatePath("/admin/occasions");
    revalidatePath(`/admin/occasions/${id}/edit`);
    revalidateStorefront();
    return { ok: true, message: "Changes saved.", code: "actions.occasion.saved" };
  } catch (error) {
    return failure(error, "Your changes could not be saved.", "actions.occasion.saveFailed");
  }
}

export async function deleteOccasion(id: number): Promise<ActionResult> {
  const { payload, user } = await authed();
  try {
    /* Deleting an occasion silently strips it from every product that uses
       it. Refuse instead, and say how many. */
    const used = await payload
      .count({
        collection: "products",
        user,
        overrideAccess: false,
        where: { occasions: { in: [id] } },
      })
      .then((r) => r.totalDocs)
      .catch(() => 0);

    if (used > 0) {
      return {
        ok: false,
        message: `${used} product${used === 1 ? " uses" : "s use"} this occasion. Remove it from ${used === 1 ? "that product" : "those products"} first, or turn off “Show on the store” to hide it.`,
        code: "actions.occasion.used",
        vars: { count: used },
      };
    }

    await payload.delete({ collection: "occasions", id, user, overrideAccess: false });
    revalidatePath("/admin/occasions");
    revalidateStorefront();
    return { ok: true, message: "Occasion deleted.", code: "actions.occasion.deleted" };
  } catch (error) {
    return failure(error, "The occasion could not be deleted.", "actions.occasion.deleteFailed");
  }
}

/* ------------------------------------------------------------------ */
/* Enquiries and events                                                */
/* ------------------------------------------------------------------ */

export async function updateEnquiry(id: number, form: FormData): Promise<ActionResult> {
  const { payload, user } = await authed();
  try {
    const assigned = parseIdList(form.getAll("assignedStaff"))[0];

    /* The follow-up day is only sent when it changed. Re-sending an
       unchanged day that has since passed would be refused by the
       collection's no-past-dates rule, and nothing else could be saved. */
    const followUpDate = readText(form.get("followUpDate"));
    const followUpOriginal = readText(form.get("followUpDateOriginal"));
    const followUp =
      followUpDate === followUpOriginal
        ? {}
        : { followUpAt: followUpDate ? followUpIsoFromDateInput(followUpDate, new Date()) : null };

    await payload.update({
      collection: "enquiries",
      id,
      user,
      overrideAccess: false,
      data: {
        status: readText(form.get("status")),
        priority: readText(form.get("priority")),
        assignedStaff: assigned ?? null,
        internalNotes: readText(form.get("internalNotes")),
        ...followUp,
      } as never,
    });
    revalidatePath("/admin/enquiries");
    revalidatePath(`/admin/enquiries/${id}`);
    revalidatePath("/admin");
    return { ok: true, message: "Enquiry saved.", code: "actions.enquiry.saved" };
  } catch (error) {
    return failure(error, "The enquiry could not be saved.", "actions.enquiry.failed");
  }
}

export async function updateEvent(id: number, form: FormData): Promise<ActionResult> {
  const { payload, user } = await authed();
  try {
    const assigned = parseIdList(form.getAll("assignedStaff"))[0];
    const quote = parseAedToFils(readText(form.get("quoteAmountAed")), "Quote");
    await payload.update({
      collection: "events",
      id,
      user,
      overrideAccess: false,
      data: {
        status: readText(form.get("status")),
        assignedStaff: assigned ?? null,
        internalNotes: readText(form.get("internalNotes")),
        /* Admin-only at field level; a staff attempt is stripped by Payload,
           which is why this is passed unconditionally and not guarded here. */
        ...(quote !== null ? { quoteAmountFils: quote } : {}),
      } as never,
    });
    revalidatePath("/admin/events");
    revalidatePath(`/admin/events/${id}`);
    return { ok: true, message: "Event saved.", code: "actions.event.saved" };
  } catch (error) {
    return failure(error, "The event could not be saved.", "actions.event.failed");
  }
}
