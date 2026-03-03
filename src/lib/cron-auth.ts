import { NextResponse } from "next/server";

/**
 * Verifies the request is from a trusted cron caller (e.g. Vercel Cron).
 * Expects Authorization: Bearer <CRON_SECRET>.
 * Returns null if valid, or a 401 Response if invalid.
 */
export function verifyCronAuth(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.warn("[cron] CRON_SECRET not set — cron endpoints are unprotected");
    return null;
  }
  const auth = request.headers.get("authorization");
  const token = auth?.replace(/^Bearer\s+/i, "").trim();
  if (token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
