import { NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { getAdminSession } from "@backend/data/admin-session";
import { removeSubscription, saveSubscription } from "@backend/notify/push";

/**
 * POST /admin/push   { endpoint }  — this device wants order notifications
 * DELETE /admin/push { endpoint }  — it no longer does
 *
 * Signed-in admin or staff only. Only the endpoint is kept: the pushes are
 * empty, so the device's encryption keys are never needed.
 */
export const dynamic = "force-dynamic";

async function endpointOf(request: Request): Promise<string | null> {
  try {
    const body = (await request.json()) as { endpoint?: unknown };
    const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
    return /^https:\/\/[^\s]{10,2000}$/.test(endpoint) ? endpoint : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request): Promise<Response> {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const endpoint = await endpointOf(request);
  if (!endpoint) return NextResponse.json({ error: "Bad subscription." }, { status: 400 });
  await saveSubscription(await getPayload({ config }), endpoint, session.user.id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request): Promise<Response> {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const endpoint = await endpointOf(request);
  if (endpoint) await removeSubscription(await getPayload({ config }), endpoint);
  return NextResponse.json({ ok: true });
}
