import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";

export async function GET(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  return NextResponse.json({
    message:
      "RSS polling is configured but no feeds are set up yet. Add Google Alerts RSS feed URLs in Settings to enable automatic signal detection.",
    processed: 0,
    signalsCreated: 0,
  });
}
