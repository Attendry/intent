import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  generateSocialPost,
  generateSocialSeries,
  getSettingsForUser,
} from "@/lib/ai";
import { requireAuth } from "@/lib/auth";
import { socialPostGenerateSchema, parseRequestBody } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const parsed = await parseRequestBody(request, socialPostGenerateSchema);
    if ("error" in parsed) return parsed.error;
    const body = parsed.data;

    const settings = await getSettingsForUser(userId);

    const voiceExamples = await prisma.voiceExample.findMany({
      where: { userId, language: { in: [body.language, "en"] } },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { originalDraft: true, revisedDraft: true },
    });

    const content = await prisma.content.findMany({
      where: { userId },
      take: 10,
      orderBy: { createdAt: "desc" },
    });

    const baseParams = {
      userId,
      targetType: body.targetType,
      targetId: body.targetId,
      personaDesc: body.personaDesc,
      voice: body.voice,
      antiAI: body.antiAI,
      contentType: body.contentType,
      signalId: body.signalId,
      intelId: body.intelId,
      includeHashtags: body.includeHashtags,
      language: body.language,
      settings,
      voiceExamples: voiceExamples.map((v) => ({
        originalDraft: v.originalDraft,
        revisedDraft: v.revisedDraft,
      })),
      content,
    };

    if (body.series && body.seriesCount && body.seriesArc) {
      const result = await generateSocialSeries({
        ...baseParams,
        count: body.seriesCount,
        seriesArc: body.seriesArc,
      });
      return NextResponse.json(result);
    }

    const result = await generateSocialPost(baseParams);
    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/social-posts/generate error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate post";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
