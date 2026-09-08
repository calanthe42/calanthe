import { ComingSoon, PageHeader } from "@admin/components/ui";

export const metadata = { title: "Enquiries" };

export default function EnquiriesPage() {
  return (
    <>
      <PageHeader
        title="Enquiries"
        breadcrumb={[{ label: "Orders" }, { label: "Enquiries" }]}
      />
      <ComingSoon area="Enquiries" />
    </>
  );
}
