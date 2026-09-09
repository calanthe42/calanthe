import { PageHeader } from "@admin/components/ui";
import { OccasionForm } from "@admin/components/OccasionForm";
import { getProductFormOptions } from "@backend/data/product-form";

export const metadata = { title: "New occasion" };

export default async function NewOccasionPage() {
  const { media } = await getProductFormOptions();
  return (
    <>
      <PageHeader
        title="Add an occasion"
        breadcrumb={[
          { label: "Shop" },
          { label: "Occasions", href: "/admin/occasions" },
          { label: "New" },
        ]}
      />
      <OccasionForm media={media} values={{ name: "", sortOrder: 0, active: true }} />
    </>
  );
}
