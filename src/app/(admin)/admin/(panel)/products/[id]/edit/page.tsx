import { notFound } from "next/navigation";
import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";
import { ProductForm } from "@admin/components/ProductForm";
import { getAdminI18n } from "@admin/i18n/server";
import { Badge } from "@admin/ui/Badge";
import { ButtonLink } from "@admin/ui/Button";
import { PageHeader } from "@admin/ui/PageHeader";
import { Notice } from "@admin/ui/States";
import { getAdminSession } from "@backend/data/admin-session";
import { getProductFormOptions } from "@backend/data/product-form";
import { lexicalToPlainText } from "@backend/domain/richtext";

export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("products.title") };
}

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

  const [{ t }, session, payload] = await Promise.all([getAdminI18n(), getAdminSession(), getPayload({ config })]);
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
  const storeHref = `/product/${product.slug}`;

  return (
    <>
      <PageHeader
        title={product.name}
        breadcrumbs={[
          { label: t("nav.sections.catalog") },
          { label: t("products.title"), href: "/admin/products" },
          { label: product.name },
        ]}
        badge={
          live ? (
            <Badge tone="success" dot>
              {t("products.edit.live")}
            </Badge>
          ) : (
            <Badge dot>{t("products.edit.hidden")}</Badge>
          )
        }
        actions={
          live ? (
            <ButtonLink href={storeHref} external icon="store">
              {t("common.viewOnStore")}
            </ButtonLink>
          ) : undefined
        }
      />

      {created ? <Notice tone="success">{t("products.edit.created")}</Notice> : null}
      {!isOwner ? <Notice>{t("products.edit.readOnly")}</Notice> : null}
      {importedWithoutPhoto ? <Notice tone="warning">{t("products.edit.importedNoPhoto")}</Notice> : null}

      <ProductForm
        occasions={occasions}
        media={media}
        readOnly={!isOwner}
        viewHref={live ? storeHref : undefined}
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
          occasionIds: (product.occasions ?? []).map((o) => String(typeof o === "object" && o ? o.id : o)),
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
