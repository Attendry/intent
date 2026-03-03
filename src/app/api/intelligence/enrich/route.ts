import { NextRequest, NextResponse } from "next/server";
import { enrichProspect, enrichImportBatch } from "@/lib/enrichment";
import { getAIClient } from "@/lib/ai";
import { requireAuth } from "@/lib/auth";
import { enrichSchema, parseRequestBody } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    try {
      await getAIClient(userId);
    } catch {
      return NextResponse.json(
        { error: "Gemini API key not configured. Set it in Settings → API Keys." },
        { status: 422 }
      );
    }

    const parsed = await parseRequestBody(request, enrichSchema);
    if ("error" in parsed) return parsed.error;
    const body = parsed.data;

    if (body.prospectIds && body.prospectIds.length > 0) {
      console.log(`[enrich] Starting batch enrichment for ${body.prospectIds.length} prospects`);
      const result = await enrichImportBatch(userId, body.prospectIds);
      console.log(`[enrich] Done — ${result.succeeded.length} succeeded, ${result.failed.length} failed`);
      return NextResponse.json(result);
    }

    if (body.prospectId) {
      await enrichProspect(userId, body.prospectId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "prospectId or prospectIds[] is required" },
      { status: 400 }
    );
  } catch (error) {
    console.error("POST /api/intelligence/enrich error:", error);
    const message = error instanceof Error ? error.message : "Failed to enrich prospect";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
