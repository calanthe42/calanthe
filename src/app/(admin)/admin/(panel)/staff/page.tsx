import { ComingSoon, PageHeader } from "@admin/components/ui";

export const metadata = { title: "Staff" };

export default function StaffPage() {
  return (
    <>
      <PageHeader
        title="Staff"
        breadcrumb={[{ label: "System" }, { label: "Staff" }]}
      />
      <ComingSoon area="Staff"
        note="Staff accounts are managed in the CMS today. Only an owner can create one or change a role." />
    </>
  );
}
