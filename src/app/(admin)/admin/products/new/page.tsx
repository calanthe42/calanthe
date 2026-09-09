import { PageHeader } from "@admin/components/ui";
import { ProductForm } from "@admin/components/ProductForm";
import { getProductFormOptions } from "@backend/data/product-form";

export const metadata = { title: "New product" };

export default async function NewProductPage() {
  const { occasions, media } = await getProductFormOptions();

  return (
    <>
      <PageHeader
        title="Add a product"
        breadcrumb={[
          { label: "Shop" },
          { label: "Products", href: "/admin/products" },
          { label: "New" },
        ]}
        description="New products start hidden. Add a photograph, then make it available when you are ready."
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
          sortOrder: 0,
        }}
      />
    </>
  );
}
