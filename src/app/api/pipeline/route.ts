import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

const ACTIVE_STAGES = ["new", "meeting_booked", "qualified", "proposal", "negotiation"] as const;
const CLOSED_STAGES = ["closed_won", "closed_lost"] as const;
const ALL_STAGES = [...ACTIVE_STAGES, ...CLOSED_STAGES] as const;

export type PipelineStage = (typeof ALL_STAGES)[number];

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const prospects = await prisma.prospect.findMany({
      where: { userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        company: true,
        companyId: true,
        pipelineStage: true,
        lastContactedAt: true,
        companyRef: { select: { fitBucket: true } },
      },
      orderBy: { lastContactedAt: "desc" },
    });

    const STALE_DAYS = 14;
    const staleCutoff = new Date();
    staleCutoff.setDate(staleCutoff.getDate() - STALE_DAYS);

    const byStage: Record<string, Array<typeof prospects[0] & { isStale: boolean }>> = {};
    for (const stage of ALL_STAGES) {
      byStage[stage] = [];
    }

    for (const p of prospects) {
      const stage = (p.pipelineStage && ALL_STAGES.includes(p.pipelineStage as PipelineStage))
        ? p.pipelineStage
        : "new";
      const isStale =
        p.pipelineStage &&
        !CLOSED_STAGES.includes(p.pipelineStage as (typeof CLOSED_STAGES)[number]) &&
        (!p.lastContactedAt || new Date(p.lastContactedAt) < staleCutoff);
      if (!byStage[stage]) byStage[stage] = [];
      byStage[stage].push({ ...p, isStale: !!isStale });
    }

    return NextResponse.json({
      byStage,
      activeStages: ACTIVE_STAGES,
      closedStages: CLOSED_STAGES,
      total: prospects.length,
      counts: ALL_STAGES.reduce(
        (acc, s) => {
          acc[s] = (byStage[s] || []).length;
          return acc;
        },
        {} as Record<string, number>
      ),
    });
  } catch (error) {
    console.error("GET /api/pipeline error:", error);
    return NextResponse.json(
      { error: "Failed to fetch pipeline" },
      { status: 500 }
    );
  }
}
