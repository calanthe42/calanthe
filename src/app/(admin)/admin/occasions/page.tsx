import { ComingSoon, PageHeader } from "@admin/components/ui";

export const metadata = { title: "Occasions" };

export default function OccasionsPage() {
  return (
    <>
      <PageHeader
        title="Occasions"
        breadcrumb={[{ label: "Shop" }, { label: "Occasions" }]}
      />
      <ComingSoon area="Occasions"
        note="Five occasions already exist and are live on the website. This screen will let you rename them, reorder them and set their tile image." />
    </>
  );
}
