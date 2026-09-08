import { ComingSoon, PageHeader } from "@admin/components/ui";

export const metadata = { title: "Marketing" };

export default function MarketingPage() {
  return (
    <>
      <PageHeader
        title="Marketing"
        breadcrumb={[{ label: "Business" }, { label: "Marketing" }]}
      />
      <ComingSoon area="Marketing"
        note="Marketing consent is already recorded against every customer, with the date it was given. Campaign tools come with the email phase." />
    </>
  );
}
