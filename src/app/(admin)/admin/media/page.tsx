import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";
import { PageHeader } from "@admin/components/ui";
import { MediaManager } from "@admin/components/MediaManager";

export const metadata = { title: "Media" };

export default async function AdminMediaPage() {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await nextHeaders() });

  const media = await payload.find({
    collection: "media",
    limit: 200,
    sort: "-createdAt",
    depth: 0,
    user,
  });

  const items = media.docs
    .filter((m) => Boolean(m.url))
    .map((m) => ({
      id: m.id,
      alt: m.alt ?? "",
      url: m.url as string,
      thumbnailUrl: m.sizes?.thumbnail?.url ?? undefined,
      filename: m.filename ?? undefined,
      filesize: m.filesize ? Number(m.filesize) : undefined,
      width: m.width ? Number(m.width) : undefined,
      height: m.height ? Number(m.height) : undefined,
    }));

  return (
    <>
      <PageHeader
        title="Media"
        breadcrumb={[{ label: "Shop" }, { label: "Media" }]}
        description={
          items.length > 0
            ? `${items.length} photograph${items.length === 1 ? "" : "s"} in the library`
            : undefined
        }
      />
      <MediaManager items={items} />
    </>
  );
}
