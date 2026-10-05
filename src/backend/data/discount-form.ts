import { getPayload, type Payload } from "payload";
import { headers as nextHeaders } from "next/headers";
import config from "@payload-config";
import type { Media, Product } from "@/payload-types";
import { toMediaOption } from "@backend/domain/media-option";
import type { ImpactProduct } from "@backend/domain/discount-impact";
import { PRODUCT_CATEGORIES } from "@backend/domain/product-form";
import { saleTargetOf } from "@backend/domain/pricing";

/**
 * What the discount editor needs to offer and to preview: the real products
 * (with the facts a sale matches on), the real occasions and the categories.
 *
 * Read as the signed-in user, never with overrideAccess: this is the admin,
 * and the collections decide what a florist may see.
 */

export type DiscountFormProduct = ImpactProduct & {
  /** False when hidden from the shop: a sale on it changes nothing customers see. */
  available: boolean;
  thumbnailUrl?: string;
};

export type DiscountFormOptions = {
  products: DiscountFormProduct[];
  occasions: { id: string; name: string }[];
  categories: { value: string; label: string }[];
};

function thumbnailOf(product: Product): string | undefined {
  const first = product.images?.[0]?.image;
  if (!first || typeof first !== "object") return undefined;
  const option = toMediaOption(first as Media);
  return option?.thumbnailUrl ?? option?.url ?? undefined;
}

/** Every product, as the sale rules see it. Shared by the form and the preview. */
export async function loadDiscountProducts(
  payload: Payload,
  user: unknown,
): Promise<DiscountFormProduct[]> {
  const found = await payload.find({
    collection: "products",
    limit: 500,
    sort: "sortOrder",
    /* Depth 1 for the first photograph; occasions are read as ids either way. */
    depth: 1,
    user: user as never,
    overrideAccess: false,
    pagination: false,
  });
  return found.docs.map((doc) => ({
    ...saleTargetOf(doc),
    name: doc.name,
    available: doc.available === true,
    ...(thumbnailOf(doc) ? { thumbnailUrl: thumbnailOf(doc) } : {}),
  }));
}

export async function getDiscountFormOptions(): Promise<DiscountFormOptions> {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await nextHeaders() });

  const [products, occasions] = await Promise.all([
    loadDiscountProducts(payload, user),
    payload.find({
      collection: "occasions",
      limit: 100,
      sort: "sortOrder",
      depth: 0,
      user,
      overrideAccess: false,
    }),
  ]);

  return {
    products,
    occasions: occasions.docs.map((o) => ({ id: String(o.id), name: o.name })),
    categories: PRODUCT_CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
  };
}
