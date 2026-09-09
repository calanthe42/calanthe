"use server";

import { headers as nextHeaders } from "next/headers";
import { revalidatePath } from "next/cache";
import { getPayload } from "payload";
import config from "@payload-config";

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
 */

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

async function authed() {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await nextHeaders() });
  return { payload, user };
}

/** Turns Payload's thrown errors into something a florist can read. */
function toMessage(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : "";
  if (/not allowed|forbidden/i.test(raw)) {
    return "You do not have permission to do that.";
  }
  /* Validation errors from hooks are already written for humans. */
  if (raw && raw.length < 300) return raw;
  return fallback;
}

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");
const on = (v: FormDataEntryValue | null) => v === "on" || v === "true";

/**
 * AED in the form, fils in the database.
 *
 * The owner types 480. Nobody in this business thinks in fils, and
 * "Price (fils): 48000" is how a bouquet gets listed at a hundred times its
 * price. Rounding happens once, here, at the boundary.
 */
function aedFieldToFils(value: FormDataEntryValue | null): number | undefined {
  const raw = str(value);
  if (raw === "") return undefined;
  const aed = Number(raw);
  if (!Number.isFinite(aed) || aed < 0) throw new Error("Enter a price like 480 or 480.50.");
  return Math.round(aed * 100);
}

/* ------------------------------------------------------------------ */
/* Products                                                            */
/* ------------------------------------------------------------------ */

function productDataFromForm(form: FormData) {
  const priceFils = aedFieldToFils(form.get("priceAed"));
  if (priceFils === undefined) throw new Error("A price is required.");

  const compareAtPriceFils = aedFieldToFils(form.get("compareAtPriceAed"));

  const occasions = form
    .getAll("occasions")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n));

  const flowers = form.getAll("flowers").map(String).filter(Boolean);

  /* Media ids chosen in the picker, in the order they were chosen. */
  const images = form
    .getAll("imageIds")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n))
    .map((id) => ({ image: id }));

  return {
    name: str(form.get("name")),
    shortDescription: str(form.get("shortDescription")) || undefined,
    priceFils,
    ...(compareAtPriceFils !== undefined ? { compareAtPriceFils } : {}),
    currency: "AED",
    category: str(form.get("category")) || "bouquet",
    flowers,
    occasions,
    images,
    available: on(form.get("available")),
    featured: on(form.get("featured")),
    bestseller: on(form.get("bestseller")),
    newArrival: on(form.get("newArrival")),
    seasonal: on(form.get("seasonal")),
    sortOrder: Number(str(form.get("sortOrder")) || 0),
  };
}

export async function createProduct(form: FormData): Promise<ActionResult> {
  const { payload, user } = await authed();
  try {
    const data = productDataFromForm(form);
    if (!data.name) return { ok: false, message: "A product name is required." };

    const slug = str(form.get("slug"));
    const doc = await payload.create({
      collection: "products",
      user,
      overrideAccess: false,
      data: { ...data, ...(slug ? { slug } : {}) } as never,
    });
    revalidatePath("/admin/products");
    revalidatePath("/shop");
    return { ok: true, message: `“${doc.name}” created.` };
  } catch (error) {
    return { ok: false, message: toMessage(error, "The product could not be created.") };
  }
}

export async function updateProduct(id: number, form: FormData): Promise<ActionResult> {
  const { payload, user } = await authed();
  try {
    const data = productDataFromForm(form);
    if (!data.name) return { ok: false, message: "A product name is required." };

    const doc = await payload.update({
      collection: "products",
      id,
      user,
      overrideAccess: false,
      data: data as never,
    });
    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${id}/edit`);
    revalidatePath("/shop");
    revalidatePath(`/product/${doc.slug}`);
    return { ok: true, message: "Changes saved." };
  } catch (error) {
    return { ok: false, message: toMessage(error, "Your changes could not be saved.") };
  }
}

export async function deleteProduct(id: number): Promise<ActionResult> {
  const { payload, user } = await authed();
  try {
    await payload.delete({ collection: "products", id, user, overrideAccess: false });
    revalidatePath("/admin/products");
    revalidatePath("/shop");
    return { ok: true, message: "Product deleted." };
  } catch (error) {
    return { ok: false, message: toMessage(error, "The product could not be deleted.") };
  }
}

/* ------------------------------------------------------------------ */
/* Media                                                               */
/* ------------------------------------------------------------------ */

/**
 * Upload a photograph.
 *
 * Goes through Payload's upload pipeline, so it lands in whatever storage is
 * configured — Vercel Blob in production, local disk in development — and
 * sharp still generates the four sizes. Nothing about storage changes here.
 */
export async function uploadMedia(form: FormData): Promise<ActionResult> {
  const { payload, user } = await authed();
  const file = form.get("file");
  const alt = str(form.get("alt"));

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose a photograph to upload." };
  }
  if (!alt) {
    return { ok: false, message: "Describe the photograph so it is accessible." };
  }
  /* Matches the server limit, so the person gets a sentence rather than a 413. */
  if (file.size > 4 * 1024 * 1024) {
    return { ok: false, message: "That image is larger than 4 MB. Please use a smaller file." };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await payload.create({
      collection: "media",
      user,
      overrideAccess: false,
      data: { alt } as never,
      file: {
        data: buffer,
        mimetype: file.type,
        name: file.name,
        size: file.size,
      },
    });
    revalidatePath("/admin/media");
    return { ok: true, message: "Photograph uploaded." };
  } catch (error) {
    return { ok: false, message: toMessage(error, "The upload failed. Please try again.") };
  }
}

export async function deleteMedia(id: number): Promise<ActionResult> {
  const { payload, user } = await authed();
  try {
    await payload.delete({ collection: "media", id, user, overrideAccess: false });
    revalidatePath("/admin/media");
    return { ok: true, message: "Photograph removed." };
  } catch (error) {
    return {
      ok: false,
      message: toMessage(error, "It could not be removed — it may still be used by a product."),
    };
  }
}

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */

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
    return { ok: true, message: `Marked as ${fulfilmentStatus.toLowerCase().replace(/_/g, " ")}.` };
  } catch (error) {
    return { ok: false, message: toMessage(error, "The status could not be updated.") };
  }
}

export async function updateOrderOperations(id: number, form: FormData): Promise<ActionResult> {
  const { payload, user } = await authed();
  const assigned = str(form.get("assignedStaff"));
  try {
    await payload.update({
      collection: "orders",
      id,
      user,
      overrideAccess: false,
      data: {
        internalNotes: str(form.get("internalNotes")),
        assignedStaff: assigned ? Number(assigned) : null,
      } as never,
    });
    revalidatePath("/admin/orders");
    return { ok: true, message: "Order updated." };
  } catch (error) {
    return { ok: false, message: toMessage(error, "The order could not be updated.") };
  }
}

/* ------------------------------------------------------------------ */
/* Occasions                                                           */
/* ------------------------------------------------------------------ */

function occasionDataFromForm(form: FormData) {
  const image = str(form.get("imageId"));
  return {
    name: str(form.get("name")),
    ...(str(form.get("slug")) ? { slug: str(form.get("slug")) } : {}),
    ...(image ? { image: Number(image) } : { image: null }),
    sortOrder: Number(str(form.get("sortOrder")) || 0),
    active: on(form.get("active")),
  };
}

export async function createOccasion(form: FormData): Promise<ActionResult> {
  const { payload, user } = await authed();
  try {
    const data = occasionDataFromForm(form);
    if (!data.name) return { ok: false, message: "An occasion name is required." };
    await payload.create({
      collection: "occasions",
      user,
      overrideAccess: false,
      data: data as never,
    });
    revalidatePath("/admin/occasions");
    revalidatePath("/occasions");
    return { ok: true, message: `“${data.name}” created.` };
  } catch (error) {
    return { ok: false, message: toMessage(error, "The occasion could not be created.") };
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
      data: occasionDataFromForm(form) as never,
    });
    revalidatePath("/admin/occasions");
    revalidatePath("/occasions");
    return { ok: true, message: "Changes saved." };
  } catch (error) {
    return { ok: false, message: toMessage(error, "Your changes could not be saved.") };
  }
}

export async function deleteOccasion(id: number): Promise<ActionResult> {
  const { payload, user } = await authed();
  try {
    await payload.delete({ collection: "occasions", id, user, overrideAccess: false });
    revalidatePath("/admin/occasions");
    revalidatePath("/occasions");
    return { ok: true, message: "Occasion deleted." };
  } catch (error) {
    return { ok: false, message: toMessage(error, "The occasion could not be deleted.") };
  }
}

/* ------------------------------------------------------------------ */
/* Enquiries and events                                                */
/* ------------------------------------------------------------------ */

export async function updateEnquiry(id: number, form: FormData): Promise<ActionResult> {
  const { payload, user } = await authed();
  const assigned = str(form.get("assignedStaff"));
  const followUp = str(form.get("followUpAt"));
  try {
    await payload.update({
      collection: "enquiries",
      id,
      user,
      overrideAccess: false,
      data: {
        status: str(form.get("status")),
        priority: str(form.get("priority")),
        assignedStaff: assigned ? Number(assigned) : null,
        internalNotes: str(form.get("internalNotes")),
        ...(followUp ? { followUpAt: new Date(followUp).toISOString() } : {}),
      } as never,
    });
    revalidatePath("/admin/enquiries");
    return { ok: true, message: "Enquiry updated." };
  } catch (error) {
    return { ok: false, message: toMessage(error, "The enquiry could not be updated.") };
  }
}

export async function updateEvent(id: number, form: FormData): Promise<ActionResult> {
  const { payload, user } = await authed();
  const assigned = str(form.get("assignedStaff"));
  const quote = aedFieldToFils(form.get("quoteAmountAed"));
  try {
    await payload.update({
      collection: "events",
      id,
      user,
      overrideAccess: false,
      data: {
        status: str(form.get("status")),
        assignedStaff: assigned ? Number(assigned) : null,
        internalNotes: str(form.get("internalNotes")),
        /* Admin-only at field level; a staff attempt is stripped by Payload,
           which is why this is passed unconditionally and not guarded here. */
        ...(quote !== undefined ? { quoteAmountFils: quote } : {}),
      } as never,
    });
    revalidatePath("/admin/events");
    return { ok: true, message: "Event updated." };
  } catch (error) {
    return { ok: false, message: toMessage(error, "The event could not be updated.") };
  }
}
