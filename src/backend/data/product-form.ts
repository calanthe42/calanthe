import { getPayload } from "payload";
import { headers as nextHeaders } from "next/headers";
import config from "@payload-config";
import { toMediaOption, type MediaOption } from "@backend/domain/media-option";

/** Options the product and occasion editors need: real occasions and real uploaded photos. */
export async function getProductFormOptions(): Promise<{
  occasions: { label: string; value: string }[];
  media: MediaOption[];
}> {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await nextHeaders() });

  const [occasions, media] = await Promise.all([
    payload.find({ collection: "occasions", limit: 100, sort: "sortOrder", depth: 0, user }),
    payload.find({ collection: "media", limit: 300, sort: "-createdAt", depth: 0, user }),
  ]);

  return {
    occasions: occasions.docs.map((o) => ({ label: o.name, value: String(o.id) })),
    media: media.docs.map(toMediaOption).filter((m): m is MediaOption => m !== null),
  };
}
