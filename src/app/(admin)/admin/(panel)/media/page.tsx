import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";
import { PageHeader } from "@admin/components/ui";
import { MediaManager, type MediaItem } from "@admin/components/MediaManager";
import { getAdminSession } from "@backend/data/admin-session";
import { getMediaUsage } from "@backend/data/media-usage";
import { toMediaOption, type MediaOption } from "@backend/domain/media-option";

export const metadata = { title: "Media" };

export default async function AdminMediaPage() {
  const [session, payload, usage] = await Promise.all([
    getAdminSession(),
    getPayload({ config }),
    getMediaUsage(),
  ]);
  const { user } = await payload.auth({ headers: await nextHeaders() });

  const media = await payload.find({
    collection: "media",
    limit: 500,
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
        title="Media"
        breadcrumb={[{ label: "Shop" }, { label: "Media" }]}
        description={
          items.length > 0
            ? `${items.length} photo${items.length === 1 ? "" : "s"} in your library`
            : "Your photo library — for products and occasions."
        }
      />
      {/* Deleting media is owner-only in the permission model. */}
      <MediaManager items={items} canDelete={Boolean(session?.isAdmin)} />
    </>
  );
}
