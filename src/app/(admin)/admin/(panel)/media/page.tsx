import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";
import { MediaManager, type MediaItem } from "@admin/components/MediaManager";
import { getAdminI18n } from "@admin/i18n/server";
import { PageHeader } from "@admin/ui/PageHeader";
import { getAdminSession } from "@backend/data/admin-session";
import { getMediaUsage } from "@backend/data/media-usage";
import { toMediaOption, type MediaOption } from "@backend/domain/media-option";

/**
 * The photo library: upload, describe, find, see where a photo is used, delete.
 *
 * Uses the existing Media collection and whatever storage it is configured
 * with — local disk in development, Vercel Blob in production. No second
 * storage system exists or is created here.
 */

export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("media.title") };
}

export default async function AdminMediaPage() {
  const [i18n, session, payload, usage] = await Promise.all([
    getAdminI18n(),
    getAdminSession(),
    getPayload({ config }),
    getMediaUsage(),
  ]);
  const { t, plural } = i18n;
  const { user } = await payload.auth({ headers: await nextHeaders() });

  const media = await payload.find({
    collection: "media",
    limit: 1000,
    sort: "-createdAt",
    depth: 0,
    user,
    overrideAccess: false,
  });

  const items: MediaItem[] = media.docs
    .map(toMediaOption)
    .filter((m): m is MediaOption => m !== null)
    .map((m) => ({ ...m, usedBy: usage.get(m.id) ?? [] }));

  return (
    <>
      <PageHeader
        title={t("media.title")}
        breadcrumbs={[{ label: t("nav.sections.catalog") }, { label: t("media.title") }]}
        description={items.length > 0 ? plural("media.count", items.length) : t("media.description")}
      />
      {/* Deleting media is owner-only in the permission model. */}
      <MediaManager items={items} canDelete={Boolean(session?.isAdmin)} />
    </>
  );
}
