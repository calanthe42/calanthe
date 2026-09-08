import { ComingSoon, PageHeader } from "@admin/components/ui";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        breadcrumb={[{ label: "System" }, { label: "Settings" }]}
      />
      <ComingSoon area="Settings"
        note="Shop-wide settings are not yet a collection. Nothing here is missing from the system — it simply has no screen yet." />
    </>
  );
}
