import { ComingSoon, PageHeader } from "@admin/components/ui";

export const metadata = { title: "Memberships" };

export default function MembershipsPage() {
  return (
    <>
      <PageHeader
        title="Memberships"
        breadcrumb={[{ label: "Business" }, { label: "Memberships" }]}
      />
      <ComingSoon area="Memberships" />
    </>
  );
}
