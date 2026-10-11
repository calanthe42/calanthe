"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getPayload } from "payload";
import config from "@payload-config";
import { recordActivity } from "@backend/activity/record";
import { actorOf } from "@backend/actions/admin-shared";
import { getAdminSession } from "@backend/data/admin-session";
import { SITE_FLAGS_TAG, SITE_FLAG_KEYS, type SiteFlagKey } from "@backend/data/site-flags";

type DrizzleLike = { execute: (query: unknown) => Promise<unknown> };

export type SiteFlagResult = { ok: true; code: string; message: string } | { ok: false; code: string; message: string };

const LABEL: Record<SiteFlagKey, string> = { eventsLive: "Events page", guestFavorsLive: "Guest favours" };

/** Owner only. Turns a website switch on or off; the storefront follows on the next page load. */
export async function setSiteFlag(key: string, on: boolean): Promise<SiteFlagResult> {
  const session = await getAdminSession();
  if (!session?.isAdmin) {
    return { ok: false, code: "website.notOwner", message: "Only an owner can change the website." };
  }
  if (!(SITE_FLAG_KEYS as readonly string[]).includes(key)) {
    return { ok: false, code: "website.unknown", message: "That switch does not exist." };
  }
  const flag = key as SiteFlagKey;

  const payload = await getPayload({ config });
  const { sql } = await import("@payloadcms/db-postgres");
  const drizzle = (payload.db as unknown as { drizzle: DrizzleLike }).drizzle;
  await drizzle.execute(sql`
    INSERT INTO site_settings (key, value, updated_at, updated_by)
    VALUES (${flag}::text, ${on ? "true" : "false"}::jsonb, now(), ${session.user.id}::int)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by
  `);

  revalidateTag(SITE_FLAGS_TAG);
  revalidatePath("/", "layout");

  await recordActivity(payload, {
    actor: actorOf(session.user),
    action: "update",
    area: "other",
    itemLabel: LABEL[flag],
    summary: `${LABEL[flag]} turned ${on ? "on" : "off"} on the website`,
  });

  return on
    ? { ok: true, code: "website.turnedOn", message: `${LABEL[flag]} is now visible on the website.` }
    : { ok: true, code: "website.turnedOff", message: `${LABEL[flag]} is now hidden from the website.` };
}
