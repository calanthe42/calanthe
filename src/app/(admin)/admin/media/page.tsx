import { ComingSoon, PageHeader } from "@admin/components/ui";

export const metadata = { title: "Media" };

export default function MediaPage() {
  return (
    <>
      <PageHeader
        title="Media"
        breadcrumb={[{ label: "Shop" }, { label: "Media" }]}
      />
      <ComingSoon area="Media"
        note="Photography uploads work today in the CMS and are stored permanently. This screen will become the visual library." />
    </>
  );
}
