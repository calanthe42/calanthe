import { NextResponse } from "next/server";
import { getAdminSession } from "@backend/data/admin-session";
import { getAdminPulse } from "@backend/data/admin-pulse";

/**
 * GET /admin/pulse?since=<ISO>
 *
 * Polled by the admin's bell. Signed-in admin or staff only — the response
 * names customers and amounts. Never cached: the whole point is what changed
 * in the last half minute.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const session = await getAdminSession();
  if (!session || !(session.isAdmin || session.isStaff)) {
    return NextResponse.json({ error: "Sign in to the admin first." }, { status: 401 });
  }
  const raw = new URL(request.url).searchParams.get("since");
  const since = raw ? new Date(raw) : null;
  const pulse = await getAdminPulse(since && !Number.isNaN(since.getTime()) ? since : null);
  return NextResponse.json(pulse, { headers: { "Cache-Control": "no-store" } });
}
