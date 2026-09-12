import { OccasionForm } from "@admin/components/OccasionForm";
import { getAdminI18n } from "@admin/i18n/server";
import { ButtonLink } from "@admin/ui/Button";
import { PageHeader } from "@admin/ui/PageHeader";
import { EmptyState } from "@admin/ui/States";
import { getAdminSession } from "@backend/data/admin-session";
import { getProductFormOptions } from "@backend/data/product-form";

export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("occasions.new.title") };
}

export default async function NewOccasionPage() {
  const [{ t }, session] = await Promise.all([getAdminI18n(), getAdminSession()]);
  const breadcrumbs = [
    { label: t("nav.sections.catalog") },
    { label: t("occasions.title"), href: "/admin/occasions" },
    { label: t("occasions.new.title") },
  ];

  if (!session?.isAdmin) {
    return (
      <>
        <PageHeader title={t("occasions.new.title")} breadcrumbs={breadcrumbs} />
        <EmptyState
          icon="occasion"
          title={t("occasions.new.ownerOnlyTitle")}
          body={t("occasions.new.ownerOnlyBody")}
          action={<ButtonLink href="/admin/occasions">{t("occasions.new.back")}</ButtonLink>}
        />
      </>
    );
  }

  const { media } = await getProductFormOptions();

  return (
    <>
      <PageHeader title={t("occasions.new.title")} breadcrumbs={breadcrumbs} description={t("occasions.new.description")} />
      <OccasionForm media={media} isOwner values={{ name: "", sortOrder: 0, active: true }} />
    </>
  );
}
