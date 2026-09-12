import { notFound } from "next/navigation";
import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";
import { OccasionForm } from "@admin/components/OccasionForm";
import { getAdminI18n } from "@admin/i18n/server";
import { Badge } from "@admin/ui/Badge";
import { ButtonLink } from "@admin/ui/Button";
import { PageHeader } from "@admin/ui/PageHeader";
import { getAdminSession } from "@backend/data/admin-session";
import { getProductFormOptions } from "@backend/data/product-form";

export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("occasions.title") };
}

export default async function EditOccasionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) notFound();

  const [{ t }, session, payload] = await Promise.all([getAdminI18n(), getAdminSession(), getPayload({ config })]);
  const { user } = await payload.auth({ headers: await nextHeaders() });
  const occasion = await payload
    .findByID({ collection: "occasions", id: numericId, depth: 0, user, overrideAccess: false })
    .catch(() => null);
  if (!occasion) notFound();

  const { media } = await getProductFormOptions();
  const liveHref = occasion.active ? `/occasions/${occasion.slug}` : undefined;

  return (
    <>
      <PageHeader
        title={occasion.name}
        breadcrumbs={[
          { label: t("nav.sections.catalog") },
          { label: t("occasions.title"), href: "/admin/occasions" },
          { label: occasion.name },
        ]}
        badge={
          occasion.active ? (
            <Badge tone="success" dot>
              {t("occasions.edit.visible")}
            </Badge>
          ) : (
            <Badge dot>{t("occasions.edit.hidden")}</Badge>
          )
        }
        actions={
          liveHref ? (
            <ButtonLink href={liveHref} external icon="store">
              {t("common.viewOnStore")}
            </ButtonLink>
          ) : undefined
        }
      />
      <OccasionForm
        media={media}
        isOwner={Boolean(session?.isAdmin)}
        liveHref={liveHref}
        values={{
          id: occasion.id,
          name: occasion.name,
          slug: occasion.slug,
          description: occasion.description ?? undefined,
          imageId: typeof occasion.image === "number" ? occasion.image : (occasion.image?.id ?? undefined),
          sortOrder: Number(occasion.sortOrder ?? 0),
          active: Boolean(occasion.active),
        }}
      />
    </>
  );
}
