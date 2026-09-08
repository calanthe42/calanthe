import { ComingSoon, PageHeader } from "@admin/components/ui";

export const metadata = { title: "Events" };

export default function EventsPage() {
  return (
    <>
      <PageHeader
        title="Events"
        breadcrumb={[{ label: "Orders" }, { label: "Events" }]}
      />
      <ComingSoon area="Events" />
    </>
  );
}
