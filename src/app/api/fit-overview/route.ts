import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const { searchParams } = new URL(request.url);
    const bucketFilter = searchParams.get("bucket");
    const industryFilter = searchParams.get("industry");

    const profile = await prisma.companyProfile.findUnique({
      where: { userId },
      select: { profileVersionHash: true, status: true, updatedAt: true },
    });

    const where: Record<string, unknown> = {
      userId,
      lastFitAnalyzedAt: { not: null },
    };
    if (bucketFilter) where.fitBucket = bucketFilter;
    if (industryFilter) where.industry = industryFilter;

    const companies = await prisma.company.findMany({
      where,
      select: {
        id: true,
        name: true,
        industry: true,
        size: true,
        fitScore: true,
        fitBucket: true,
        fitAnalysis: true,
        profileVersionUsed: true,
        lastFitAnalyzedAt: true,
        _count: { select: { prospects: true, intel: true } },
      },
      orderBy: { fitScore: "desc" },
    });

    const currentVersion = profile?.profileVersionHash || null;

    const items = companies.map((c) => {
      let summary = "";
      let topExpansion = null;
      let entryPoint = null;

      if (c.fitAnalysis) {
        try {
          const analysis = JSON.parse(c.fitAnalysis);
          summary = analysis.summary || "";
          if (analysis.expansionOpportunities?.length > 0) {
            topExpansion = analysis.expansionOpportunities[0];
          }
          if (analysis.entryPoint) {
            entryPoint = {
              leadPersona: analysis.entryPoint.leadPersona,
              leadOffering: analysis.entryPoint.leadOffering,
            };
          }
        } catch {}
      }

      return {
        id: c.id,
        name: c.name,
        industry: c.industry,
        size: c.size,
        fitScore: c.fitScore,
        fitBucket: c.fitBucket,
        summary,
        topExpansion,
        entryPoint,
        prospectCount: c._count.prospects,
        intelCount: c._count.intel,
        isStale:
          currentVersion !== null &&
          c.profileVersionUsed !== currentVersion,
        lastFitAnalyzedAt: c.lastFitAnalyzedAt,
      };
    });

    const buckets = {
      quick_win: items.filter((i) => i.fitBucket === "quick_win"),
      strategic_bet: items.filter((i) => i.fitBucket === "strategic_bet"),
      nurture: items.filter((i) => i.fitBucket === "nurture"),
      park: items.filter((i) => i.fitBucket === "park"),
    };

    const staleCount = items.filter((i) => i.isStale).length;

    return NextResponse.json({
      buckets,
      total: items.length,
      staleCount,
      profileExists: !!profile,
      profilePublished: profile?.status === "published",
      profileUpdatedAt: profile?.updatedAt || null,
    });
  } catch (error) {
    console.error("GET /api/fit-overview error:", error);
    return NextResponse.json(
      { error: "Failed to fetch fit overview" },
      { status: 500 }
    );
  }
}
