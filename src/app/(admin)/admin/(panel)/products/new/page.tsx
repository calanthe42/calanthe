import { ActionLink, EmptyState, PageHeader } from "@admin/components/ui";
import { ProductForm } from "@admin/components/ProductForm";
import { getAdminSession } from "@backend/data/admin-session";
import { getProductFormOptions } from "@backend/data/product-form";

export const metadata = { title: "Add product" };

const BREADCRUMB = [
  { label: "Shop" },
  { label: "Products", href: "/admin/products" },
  { label: "New" },
];

export default async function NewProductPage() {
  const session = await getAdminSession();

  /* Creating products is owner-only in the permission model. Say so, rather
     than showing a form whose save would be refused. */
  if (!session?.isAdmin) {
    return (
      <>
        <PageHeader title="Add a product" breadcrumb={BREADCRUMB} />
        <EmptyState
          title="Only the owner can add products"
          message="You can open any existing product to see its details."
          action={<ActionLink href="/admin/products">Back to products</ActionLink>}
        />
      </>
    );
  }

  const { occasions, media } = await getProductFormOptions();

  return (
    <>
      <PageHeader
        title="Add a product"
        breadcrumb={BREADCRUMB}
        description="A name and a price are all it needs to save. It stays hidden from the shop until it has a photo and you choose to publish it."
      />
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
