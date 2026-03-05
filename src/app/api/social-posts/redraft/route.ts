import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  generateSocialRedraft,
  getSettingsForUser,
} from "@/lib/ai";
import { requireAuth } from "@/lib/auth";
import { socialPostRedraftSchema, parseRequestBody } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const parsed = await parseRequestBody(request, socialPostRedraftSchema);
    if ("error" in parsed) return parsed.error;
    const body = parsed.data;

    const settings = await getSettingsForUser(userId);

    const voiceExamples = await prisma.voiceExample.findMany({
      where: { userId, language: { in: [body.language || "en", "en"] } },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { originalDraft: true, revisedDraft: true },
    });

    const result = await generateSocialRedraft({
      userId,
      originalPost: body.originalPost,
      instruction: body.instruction,
      targetType: body.targetType,
      targetId: body.targetId,
      personaDesc: body.personaDesc,
      voice: body.voice,
      language: body.language,
      settings,
      voiceExamples: voiceExamples.map((v) => ({
        originalDraft: v.originalDraft,
        revisedDraft: v.revisedDraft,
      })),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/social-posts/redraft error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to redraft post";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
