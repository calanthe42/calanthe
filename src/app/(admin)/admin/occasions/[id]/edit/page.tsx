import { notFound } from "next/navigation";
import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";
import { PageHeader } from "@admin/components/ui";
import { OccasionForm } from "@admin/components/OccasionForm";
import { getProductFormOptions } from "@backend/data/product-form";

export const metadata = { title: "Edit occasion" };

export default async function EditOccasionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) notFound();

  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await nextHeaders() });
  const occasion = await payload
    .findByID({ collection: "occasions", id: numericId, depth: 0, user })
    .catch(() => null);
  if (!occasion) notFound();

  const { media } = await getProductFormOptions();

  return (
    <>
      <PageHeader
        title={occasion.name}
        breadcrumb={[
          { label: "Shop" },
          { label: "Occasions", href: "/admin/occasions" },
          { label: occasion.name },
        ]}
      />
      <OccasionForm
        media={media}
        values={{
          id: occasion.id,
          name: occasion.name,
          slug: occasion.slug,
          imageId: typeof occasion.image === "number" ? occasion.image : (occasion.image?.id ?? undefined),
          sortOrder: Number(occasion.sortOrder ?? 0),
          active: Boolean(occasion.active),
        }}
      />
    </>
  );
}
