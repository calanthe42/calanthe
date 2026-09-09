import { getPayload } from "payload";
import { headers as nextHeaders } from "next/headers";
import config from "@payload-config";
import type { MediaOption } from "@admin/components/ProductForm";

/** Options the product form needs: real occasions and real uploaded media. */
export async function getProductFormOptions(): Promise<{
  occasions: { label: string; value: string }[];
  media: MediaOption[];
}> {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await nextHeaders() });

  const [occasions, media] = await Promise.all([
    payload.find({ collection: "occasions", limit: 100, sort: "sortOrder", depth: 0, user }),
    payload.find({ collection: "media", limit: 200, sort: "-createdAt", depth: 0, user }),
  ]);

  return {
    occasions: occasions.docs.map((o) => ({ label: o.name, value: String(o.id) })),
    media: media.docs
      .filter((m) => Boolean(m.url))
      .map((m) => ({
        id: m.id,
        alt: m.alt ?? "",
        url: m.url as string,
        thumbnailUrl: m.sizes?.thumbnail?.url ?? undefined,
      })),
  };
}
