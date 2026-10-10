import { createPrivateKey, sign } from "node:crypto";
import type { Payload } from "payload";

/**
 * PHONE NOTIFICATIONS FOR THE SHOP — Web Push, with no library.
 *
 * Every device on which someone signed in to the admin and pressed "Turn on
 * alerts" holds a push subscription (stored in admin_push_subscriptions).
 * When an order is paid or an enquiry arrives, the server sends each one an
 * EMPTY push, signed with the shop's VAPID key. The admin's service worker
 * (public/admin-sw.js) wakes, asks /admin/pulse what arrived — with the
 * signed-in cookie, so nothing about a customer travels through Apple's or
 * Google's push servers — and shows the notification in the phone's
 * notification bar, with sound, even when the browser is closed.
 *
 * An empty push needs only a signed JWT (ES256), not payload encryption,
 * which is why node:crypto is enough.
 *
 * Configuration: VAPID_PRIVATE_KEY (base64url, secret) in the environment.
 * The public half is not secret and lives here so the browser can use it.
 * Without the private key nothing is sent and nothing fails.
 */

import { VAPID_PUBLIC_KEY } from "@backend/notify/push-public";

export { VAPID_PUBLIC_KEY };
const VAPID_SUBJECT = "mailto:dev@calanthe.ae";

type Row = { id: number; endpoint: string };
type DrizzleLike = { execute: (query: unknown) => Promise<unknown> };

const rowsOf = (result: unknown): Row[] =>
  Array.isArray(result) ? (result as Row[]) : (((result as { rows?: Row[] })?.rows ?? []) as Row[]);

async function db(payload: Payload) {
  const { sql } = await import("@payloadcms/db-postgres");
  const drizzle = (payload.db as unknown as { drizzle: DrizzleLike }).drizzle;
  return { sql, drizzle };
}

function vapidJwt(audience: string, privateD: string): string {
  const raw = Buffer.from(VAPID_PUBLIC_KEY, "base64url");
  const key = createPrivateKey({
    format: "jwk",
    key: {
      kty: "EC",
      crv: "P-256",
      d: privateD,
      x: raw.subarray(1, 33).toString("base64url"),
      y: raw.subarray(33, 65).toString("base64url"),
    },
  });
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${enc({ typ: "JWT", alg: "ES256" })}.${enc({
    aud: audience,
    exp: Math.floor(new Date().getTime() / 1000) + 12 * 3600,
    sub: VAPID_SUBJECT,
  })}`;
  const signature = sign("sha256", Buffer.from(unsigned), { key, dsaEncoding: "ieee-p1363" });
  return `${unsigned}.${signature.toString("base64url")}`;
}

/** Remember a device. Same endpoint again = the same device, kept once. */
export async function saveSubscription(payload: Payload, endpoint: string, userId: number): Promise<void> {
  const { sql, drizzle } = await db(payload);
  await drizzle.execute(sql`
    INSERT INTO admin_push_subscriptions (endpoint, user_id)
    VALUES (${endpoint}::text, ${userId}::int)
    ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, updated_at = now()
  `);
}

export async function removeSubscription(payload: Payload, endpoint: string): Promise<void> {
  const { sql, drizzle } = await db(payload);
  await drizzle.execute(sql`DELETE FROM admin_push_subscriptions WHERE endpoint = ${endpoint}::text`);
}

/**
 * Wake every staff device. Never throws: a notification that cannot be sent
 * must not cost the order its emails or the webhook its 200.
 */
export async function notifyStaffDevices(payload: Payload): Promise<void> {
  const privateD = process.env.VAPID_PRIVATE_KEY;
  if (!privateD) return;
  try {
    const { sql, drizzle } = await db(payload);
    const subs = rowsOf(
      await drizzle.execute(sql`
        SELECT s.id, s.endpoint FROM admin_push_subscriptions s
        JOIN users u ON u.id = s.user_id
        WHERE u.role IN ('admin', 'staff') AND coalesce(u.account_status, 'active') = 'active'
      `),
    );
    await Promise.all(
      subs.map(async (sub) => {
        try {
          const res = await fetch(sub.endpoint, {
            method: "POST",
            headers: {
              Authorization: `vapid t=${vapidJwt(new URL(sub.endpoint).origin, privateD)}, k=${VAPID_PUBLIC_KEY}`,
              TTL: "86400",
              Urgency: "high",
              "Content-Length": "0",
            },
          });
          /* Gone: the device unsubscribed or the browser was reset. */
          if (res.status === 404 || res.status === 410) {
            await drizzle.execute(sql`DELETE FROM admin_push_subscriptions WHERE id = ${sub.id}::int`);
          } else if (!res.ok) {
            payload.logger.warn(`push ${sub.id}: ${res.status}`);
          }
        } catch (error) {
          payload.logger.warn(`push ${sub.id}: ${error instanceof Error ? error.message : "failed"}`);
        }
      }),
    );
  } catch (error) {
    payload.logger.warn(`push: ${error instanceof Error ? error.message : "failed"}`);
  }
}
