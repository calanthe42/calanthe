import { ComingSoon, PageHeader } from "@admin/components/ui";

export const metadata = { title: "Delivery" };

export default function DeliveryPage() {
  return (
    <>
      <PageHeader
        title="Delivery"
        breadcrumb={[{ label: "Business" }, { label: "Delivery" }]}
      />
      <ComingSoon area="Delivery"
        note="Delivery zones and fees are not yet a database collection — they are still configuration. This screen arrives with them." />
    </>
  );
}
