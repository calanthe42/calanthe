import Link from "next/link";
import { notFound } from "next/navigation";
import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";
import { PageHeader } from "@admin/components/ui";
import { ProductForm } from "@admin/components/ProductForm";
import { getProductFormOptions } from "@backend/data/product-form";

export const metadata = { title: "Edit product" };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) notFound();

  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await nextHeaders() });

  /* Read under the caller's own permissions — no overrideAccess. */
  const product = await payload
    .findByID({ collection: "products", id: numericId, depth: 1, user })
    .catch(() => null);

  if (!product) notFound();

  const { occasions, media } = await getProductFormOptions();

  return (
    <>
      <PageHeader
        title={product.name}
        breadcrumb={[
          { label: "Shop" },
          { label: "Products", href: "/admin/products" },
          { label: product.name },
        ]}
        action={
          product.available ? (
            <Link
              href={`/product/${product.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center rounded-md border border-hairline bg-white px-4 text-sm text-olive hover:bg-admin-sunken"
            >
              View on the shop ↗
            </Link>
          ) : (
            <span className="inline-flex min-h-11 items-center rounded-md bg-olive/10 px-3 text-xs text-olive">
              Hidden from the shop
            </span>
          )
        }
      />

      <ProductForm
        occasions={occasions}
        media={media}
        values={{
          id: product.id,
          name: product.name,
          slug: product.slug,
          shortDescription: product.shortDescription ?? undefined,
          /* fils -> AED for display; converted back on save. */
          priceAed: String(Number(product.priceFils) / 100),
          compareAtPriceAed: product.compareAtPriceFils
            ? String(Number(product.compareAtPriceFils) / 100)
            : undefined,
          category: product.category,
          flowers: (product.flowers ?? []) as string[],
          occasionIds: (product.occasions ?? [])
            .map((o) => (typeof o === "object" && o ? String(o.id) : String(o)))
            .filter(Boolean),
          imageIds: (product.images ?? [])
            .map((row) => (typeof row.image === "object" && row.image ? row.image.id : row.image))
            .filter((v): v is number => typeof v === "number"),
          available: Boolean(product.available),
          featured: Boolean(product.featured),
          bestseller: Boolean(product.bestseller),
          newArrival: Boolean(product.newArrival),
          seasonal: Boolean(product.seasonal),
          sortOrder: Number(product.sortOrder ?? 0),
        }}
      />
    </>
  );
}
