import { notFound } from "next/navigation";
import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";
import { Banner, PageHeader, Pill, RowAction } from "@admin/components/ui";
import { ProductForm } from "@admin/components/ProductForm";
import { getAdminSession } from "@backend/data/admin-session";
import { getProductFormOptions } from "@backend/data/product-form";
import { lexicalToPlainText } from "@backend/domain/richtext";

export const metadata = { title: "Edit product" };

/** Integer fils to the dirham string an input shows: 48000 -> "480". */
const toAedInput = (fils: number | null | undefined) =>
  typeof fils === "number" && fils > 0 ? String(fils / 100) : undefined;

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const { created } = await searchParams;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) notFound();

  const [session, payload] = await Promise.all([getAdminSession(), getPayload({ config })]);
  const { user } = await payload.auth({ headers: await nextHeaders() });

  /* Read under the caller's own permissions — no overrideAccess. */
  const product = await payload
    .findByID({ collection: "products", id: numericId, depth: 0, user, overrideAccess: false })
    .catch(() => null);
  if (!product) notFound();

  const { occasions, media } = await getProductFormOptions();

  const imageIds = (product.images ?? [])
    .map((row) => (typeof row.image === "object" && row.image ? row.image.id : row.image))
    .filter((v): v is number => typeof v === "number");
  const live = Boolean(product.available) && imageIds.length > 0;
  const importedWithoutPhoto = imageIds.length === 0 && (product.legacyImages ?? []).length > 0;
  const isOwner = Boolean(session?.isAdmin);

  return (
    <>
      <PageHeader
        title={product.name}
        breadcrumb={[
          { label: "Shop" },
          { label: "Products", href: "/admin/products" },
          { label: product.name },
        ]}
        description={live ? "Live on the shop." : "Hidden from the shop."}
        action={
          live ? (
            <RowAction href={`/product/${product.slug}`} external>
              View on shop ↗
            </RowAction>
          ) : (
            <Pill>Hidden</Pill>
          )
        }
      />

      {created ? (
        <Banner>
          Product created. It stays hidden from the shop until it has a photo and “Available to
          buy” is ticked.
        </Banner>
      ) : null}

      {!isOwner ? (
        <Banner tone="info">Only the owner can change products. Every detail is shown here.</Banner>
      ) : null}

      {importedWithoutPhoto ? (
        <Banner tone="warning">
          This product came from the old website without a photo of its own. Add its real
          photograph under Photos, then tick “Available to buy” to put it on sale.
        </Banner>
      ) : null}

      <ProductForm
        occasions={occasions}
        media={media}
        readOnly={!isOwner}
        viewHref={live ? `/product/${product.slug}` : undefined}
        values={{
          id: product.id,
          name: product.name,
          slug: product.slug,
          shortDescription: product.shortDescription ?? undefined,
          descriptionText: lexicalToPlainText(product.description),
          /* fils -> AED for display; converted back on save. */
          priceAed: String(Number(product.priceFils) / 100),
          compareAtPriceAed: toAedInput(product.compareAtPriceFils),
          category: product.category,
          flowers: (product.flowers ?? []) as string[],
          occasionIds: (product.occasions ?? []).map((o) =>
            String(typeof o === "object" && o ? o.id : o),
          ),
          imageIds,
          available: Boolean(product.available),
          featured: Boolean(product.featured),
          bestseller: Boolean(product.bestseller),
          newArrival: Boolean(product.newArrival),
          seasonal: Boolean(product.seasonal),
          trackStock: Boolean(product.trackStock),
          stock: Number(product.stock ?? 0),
          sortOrder: Number(product.sortOrder ?? 0),
          seoTitle: product.seo?.title ?? undefined,
          seoDescription: product.seo?.description ?? undefined,
          noIndex: Boolean(product.seo?.noIndex),
        }}
      />
    </>
  );
}
