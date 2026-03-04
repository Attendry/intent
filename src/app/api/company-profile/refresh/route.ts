import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { extractCompanyProfile, isGeminiConfigured, GEMINI_NOT_CONFIGURED_MSG } from "@/lib/ai";
import { requireAuth } from "@/lib/auth";
import crypto from "crypto";

export const maxDuration = 60;

function computeContentHash(
  items: { id: string; updatedAt: Date }[]
): string {
  const payload = items
    .map((c) => `${c.id}:${c.updatedAt.getTime()}`)
    .sort()
    .join("|");
  return crypto.createHash("md5").update(payload).digest("hex");
}

export async function POST() {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const existing = await prisma.companyProfile.findUnique({
      where: { userId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "No company profile exists. Create one first." },
        { status: 404 }
      );
    }

    if (!existing.rawWebsiteText) {
      return NextResponse.json(
        { error: "No cached website text. Re-create the profile with a URL." },
        { status: 400 }
      );
    }

    if (!(await isGeminiConfigured(userId))) {
      return NextResponse.json(
        { error: GEMINI_NOT_CONFIGURED_MSG },
        { status: 503 }
      );
    }

    const contentItems = await prisma.content.findMany({
      where: { userId },
      select: {
        id: true,
        title: true,
        type: true,
        summary: true,
        body: true,
        tags: true,
        personaFit: true,
        useCaseFit: true,
        updatedAt: true,
      },
    });

    const result = await extractCompanyProfile({
      userId,
      websiteText: existing.rawWebsiteText,
      contentItems,
    });

    const contentHash = computeContentHash(
      contentItems.map((c) => ({ id: c.id, updatedAt: c.updatedAt }))
    );

    const profile = await prisma.companyProfile.update({
      where: { userId },
      data: {
        name: result.name,
        valueProposition: result.valueProposition,
        offerings: JSON.stringify(result.offerings),
        icp: JSON.stringify(result.icp),
        competitors: JSON.stringify(result.competitors),
        targetIndustries: JSON.stringify(result.targetIndustries),
        targetPersonas: JSON.stringify(result.targetPersonas),
        differentiators: JSON.stringify(result.differentiators),
        painPointsSolved: JSON.stringify(result.painPointsSolved),
        fullProfile: result.fullProfile,
        status: "draft",
        contentVersionHash: contentHash,
        lastAnalyzedAt: new Date(),
      },
    });

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("POST /api/company-profile/refresh error:", error);
    const msg = error instanceof Error ? error.message : "";
    const isGeminiError = msg.includes("Gemini") || msg.includes("API key");
    return NextResponse.json(
      { error: isGeminiError ? msg : "Failed to refresh company profile" },
      { status: isGeminiError ? 503 : 500 }
    );
  }
}
