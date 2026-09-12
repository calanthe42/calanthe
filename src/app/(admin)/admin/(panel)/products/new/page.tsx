import { ProductForm } from "@admin/components/ProductForm";
import { getAdminI18n } from "@admin/i18n/server";
import { ButtonLink } from "@admin/ui/Button";
import { PageHeader } from "@admin/ui/PageHeader";
import { EmptyState } from "@admin/ui/States";
import { getAdminSession } from "@backend/data/admin-session";
import { getProductFormOptions } from "@backend/data/product-form";

export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("products.new.title") };
}

export default async function NewProductPage() {
  const [{ t }, session] = await Promise.all([getAdminI18n(), getAdminSession()]);
  const breadcrumbs = [
    { label: t("nav.sections.catalog") },
    { label: t("products.title"), href: "/admin/products" },
    { label: t("products.new.title") },
  ];

  /* Creating products is owner-only in the permission model. Say so, rather
     than showing a form whose save would be refused. */
  if (!session?.isAdmin) {
    return (
      <>
        <PageHeader title={t("products.new.title")} breadcrumbs={breadcrumbs} />
        <EmptyState
          icon="flower"
          title={t("products.new.ownerOnlyTitle")}
          body={t("products.new.ownerOnlyBody")}
          action={<ButtonLink href="/admin/products">{t("products.new.back")}</ButtonLink>}
        />
      </>
    );
  }

  const { occasions, media } = await getProductFormOptions();

  return (
    <>
      <PageHeader title={t("products.new.title")} breadcrumbs={breadcrumbs} description={t("products.new.description")} />
      <ProductForm
        occasions={occasions}
        media={media}
        values={{
          name: "",
          priceAed: "",
          category: "bouquet",
          flowers: [],
          occasionIds: [],
          imageIds: [],
          available: false,
          featured: false,
          bestseller: false,
          newArrival: false,
          seasonal: false,
          trackStock: false,
          stock: 0,
          sortOrder: 0,
          noIndex: false,
        }}
      />
    </>
  );
}
