import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { analyzeCompanyFit } from "@/lib/ai";
import { requireAuth } from "@/lib/auth";

function assignBucket(dimensions: {
  icpFit: { score: number };
  needAlignment: { score: number };
  timingIntent: { score: number };
  relationshipDepth: { score: number };
}): string {
  const { needAlignment, timingIntent, relationshipDepth } = dimensions;

  if (
    needAlignment.score >= 70 &&
    timingIntent.score >= 60 &&
    relationshipDepth.score >= 50
  ) {
    return "quick_win";
  }

  if (
    needAlignment.score >= 60 &&
    (timingIntent.score < 60 || relationshipDepth.score < 50)
  ) {
    return "strategic_bet";
  }

  const overall =
    dimensions.icpFit.score * 0.25 +
    needAlignment.score * 0.3 +
    timingIntent.score * 0.25 +
    relationshipDepth.score * 0.1 +
    (dimensions as Record<string, { score: number }>).competitivePosition.score * 0.1;

  if (overall >= 40) {
    return "nurture";
  }

  return "park";
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const profile = await prisma.companyProfile.findUnique({
      where: { userId },
    });

    if (!profile || profile.status !== "published") {
      return NextResponse.json(
        {
          error:
            "Company profile must be published before running fit analysis. Go to My Company to set up your profile.",
        },
        { status: 400 }
      );
    }

    const company = await prisma.company.findFirst({
      where: { id, userId },
      include: {
        intel: {
          orderBy: { createdAt: "desc" },
          take: 30,
        },
        documents: {
          where: { status: "completed" },
          select: { fullSummary: true, title: true },
        },
        prospects: {
          select: {
            firstName: true,
            lastName: true,
            title: true,
            roleArchetype: true,
            personaSummary: true,
          },
        },
      },
    });

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    let battlecard: Record<string, string> | null = null;
    if (company.battlecard) {
      try {
        battlecard = JSON.parse(company.battlecard);
      } catch {}
    }

    function parseJson<T>(val: string | null, fallback: T): T {
      if (!val) return fallback;
      try {
        return JSON.parse(val) as T;
      } catch {
        return fallback;
      }
    }

    const defaultIcp = {
      employeeRange: { min: 0, max: 0 },
      revenueRange: { min: "", max: "" },
      geographies: [] as string[],
      industries: [] as string[],
      techSignals: [] as string[],
      buyingTriggers: [] as string[],
      disqualifiers: [] as string[],
    };

    const fitResult = await analyzeCompanyFit({
      userId,
      profile: {
        valueProposition: profile.valueProposition || "",
        offerings: parseJson(profile.offerings, [] as { name: string; problemSolved: string; idealBuyer: string; proofPoints: string[]; linkedContentIds: string[]; competitiveAlternatives: string[] }[]),
        icp: parseJson(profile.icp, defaultIcp),
        competitors: parseJson(profile.competitors, [] as { name: string; whereWeWin: string; whereTheyWin: string; displacementPlay: string }[]),
        targetPersonas: parseJson(profile.targetPersonas, [] as string[]),
        differentiators: parseJson(profile.differentiators, [] as string[]),
        painPointsSolved: parseJson(profile.painPointsSolved, [] as string[]),
      },
      company: {
        name: company.name,
        industry: company.industry,
        size: company.size,
        website: company.website,
        hqLocation: company.hqLocation,
        battlecard,
        intel: company.intel.map((i) => ({
          type: i.type,
          summary: i.summary,
          date: i.date?.toISOString().split("T")[0],
        })),
        documentSummaries: company.documents
          .filter((d) => d.fullSummary)
          .map((d) => `${d.title}: ${d.fullSummary}`),
        prospects: company.prospects.map((p) => ({
          name: `${p.firstName} ${p.lastName}`,
          title: p.title,
          roleArchetype: p.roleArchetype,
          personaSummary: p.personaSummary,
        })),
      },
    });

    const bucket = assignBucket(fitResult.dimensions);
    const overallScore = Math.round(
      fitResult.dimensions.icpFit.score * 0.25 +
      fitResult.dimensions.needAlignment.score * 0.3 +
      fitResult.dimensions.timingIntent.score * 0.25 +
      fitResult.dimensions.relationshipDepth.score * 0.1 +
      fitResult.dimensions.competitivePosition.score * 0.1
    );

    const analysis = { ...fitResult, overallScore, bucket };

    await prisma.company.update({
      where: { id },
      data: {
        fitScore: overallScore,
        fitAnalysis: JSON.stringify(analysis),
        fitBucket: bucket,
        profileVersionUsed: profile.profileVersionHash,
        lastFitAnalyzedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, fitScore: overallScore, fitBucket: bucket, fitAnalysis: analysis });
  } catch (error) {
    console.error(`POST /api/companies/${id}/fit error:`, error);
    return NextResponse.json(
      { error: "Fit analysis failed" },
      { status: 500 }
    );
  }
}
