import { notFound } from "next/navigation";
import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";
import { PageHeader, Pill, RowAction } from "@admin/components/ui";
import { OccasionForm } from "@admin/components/OccasionForm";
import { getAdminSession } from "@backend/data/admin-session";
import { getProductFormOptions } from "@backend/data/product-form";

export const metadata = { title: "Edit occasion" };

export default async function EditOccasionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) notFound();

  const [session, payload] = await Promise.all([getAdminSession(), getPayload({ config })]);
  const { user } = await payload.auth({ headers: await nextHeaders() });
  const occasion = await payload
    .findByID({ collection: "occasions", id: numericId, depth: 0, user, overrideAccess: false })
    .catch(() => null);
  if (!occasion) notFound();

  const { media } = await getProductFormOptions();
  const liveHref = occasion.active ? `/occasions/${occasion.slug}` : undefined;

  return (
    <>
      <PageHeader
        title={occasion.name}
        breadcrumb={[
          { label: "Shop" },
          { label: "Occasions", href: "/admin/occasions" },
          { label: occasion.name },
        ]}
        description={occasion.active ? "Visible on the shop." : "Hidden from the shop."}
        action={
          liveHref ? (
            <RowAction href={liveHref} external>
              View on shop ↗
            </RowAction>
          ) : (
            <Pill>Hidden</Pill>
          )
        }
      />
      <OccasionForm
        media={media}
        isOwner={Boolean(session?.isAdmin)}
        liveHref={liveHref}
        values={{
          id: occasion.id,
          name: occasion.name,
          slug: occasion.slug,
          description: occasion.description ?? undefined,
          imageId:
            typeof occasion.image === "number" ? occasion.image : (occasion.image?.id ?? undefined),
          sortOrder: Number(occasion.sortOrder ?? 0),
          active: Boolean(occasion.active),
        }}
      />
    </>
  );
}
