import { NextRequest, NextResponse } from "next/server";
import { enrichCaptureContent } from "@/lib/ai";
import { getCaptureAuth } from "@/lib/auth";
import { enrichSchema, parseRequestBody } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const user = await getCaptureAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = await parseRequestBody(request, enrichSchema);
    if ("error" in parsed) return parsed.error;
    const body = parsed.data;

    if (body.prospectId) {
      const { enrichProspect } = await import("@/lib/enrichment");
      await enrichProspect(user.id, body.prospectId);
      return NextResponse.json({ success: true });
    }
    if (body.prospectIds?.length) {
      const { enrichImportBatch } = await import("@/lib/enrichment");
      const result = await enrichImportBatch(user.id, body.prospectIds);
      return NextResponse.json(result);
    }

    const content = (body.content || "").trim();
    if (!content) {
      return NextResponse.json(
        { error: "Content is required for capture enrichment" },
        { status: 400 }
      );
    }

    const result = await enrichCaptureContent(user.id, content.slice(0, 4000));
    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/capture/enrich error:", error);
    return NextResponse.json(
      { error: "Enrichment failed. Is Gemini configured in Settings?" },
      { status: 500 }
    );
  }
}
