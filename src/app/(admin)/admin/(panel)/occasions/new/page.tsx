import { ActionLink, EmptyState, PageHeader } from "@admin/components/ui";
import { OccasionForm } from "@admin/components/OccasionForm";
import { getAdminSession } from "@backend/data/admin-session";
import { getProductFormOptions } from "@backend/data/product-form";

export const metadata = { title: "Add occasion" };

const BREADCRUMB = [
  { label: "Shop" },
  { label: "Occasions", href: "/admin/occasions" },
  { label: "New" },
];

export default async function NewOccasionPage() {
  const session = await getAdminSession();

  if (!session?.isAdmin) {
    return (
      <>
        <PageHeader title="Add an occasion" breadcrumb={BREADCRUMB} />
        <EmptyState
          title="Only the owner can add occasions"
          message="You can edit the existing occasions from the list."
          action={<ActionLink href="/admin/occasions">Back to occasions</ActionLink>}
        />
      </>
    );
  }

  const { media } = await getProductFormOptions();

  return (
    <>
      <PageHeader
        title="Add an occasion"
        breadcrumb={BREADCRUMB}
        description="Eid, Mother’s Day, a new season — each occasion gets its own page on the shop."
      />
      <OccasionForm media={media} isOwner values={{ name: "", sortOrder: 0, active: true }} />
    </>
  );
}
