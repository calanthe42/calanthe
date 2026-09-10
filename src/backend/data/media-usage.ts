import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";
import {
  collectMediaUsage,
  type OccasionMediaRefs,
  type ProductMediaRefs,
} from "@backend/domain/media-option";

/**
 * Which products and occasions use each photograph, read as the signed-in user.
 *
 * Under normal access control: admin and staff can read the whole catalogue,
 * so usage is complete for anyone who can open the media library.
 */
export async function getMediaUsage(): Promise<Map<number, string[]>> {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await nextHeaders() });

  const [products, occasions] = await Promise.all([
    payload.find({ collection: "products", limit: 1000, depth: 0, user, overrideAccess: false }),
    payload.find({ collection: "occasions", limit: 500, depth: 0, user, overrideAccess: false }),
  ]);

  return collectMediaUsage(
    products.docs as ProductMediaRefs[],
    occasions.docs as OccasionMediaRefs[],
  );
}
