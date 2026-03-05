import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSettingsForUser } from "@/lib/ai";
import { requireAuth } from "@/lib/auth";

const FIT_BUCKETS = ["quick_win", "strategic_bet", "nurture", "park"] as const;

function getStaleThreshold(settings: { staleProspectDays?: number }): number {
  return settings.staleProspectDays ?? 30;
}

export interface BriefItem {
  id: string;
  type: "signal" | "followup" | "intel" | "suggested";
  prospectId: string;
  prospectName: string;
  companyId: string | null;
  companyName: string | null;
  summary: string;
  nextBestAction: string;
  ctaUrl: string;
  fitBucket: string | null;
  pipelineStage: string | null;
  urgencyScore: number;
  sourceAttribution?: string;
  createdAt: string;
}

export interface BriefResponse {
  summary: string | null;
  items: BriefItem[];
  byBucket: Record<string, BriefItem[]>;
}

/**
 * GET /api/brain/brief
 * Returns today's brief: top 5-7 priorities by fit bucket, with next best action and ctaUrl.
 */
export async function GET() {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const settings = await getSettingsForUser(userId);
    const staleDays = getStaleThreshold(settings);
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const staleCutoff = new Date(now.getTime() - staleDays * 24 * 60 * 60 * 1000);

    const items: BriefItem[] = [];

    // 1. High-urgency signals (urgency >= 4, not acted/dismissed)
    const signals = await prisma.signal.findMany({
      where: {
        prospect: { userId },
        actedOn: false,
        dismissed: false,
        snoozedUntil: null,
        urgencyScore: { gte: 4 },
      },
      include: {
        prospect: {
          include: {
            companyRef: { select: { id: true, name: true, fitBucket: true } },
          },
        },
      },
      orderBy: [{ urgencyScore: "desc" }, { createdAt: "desc" }],
      take: 10,
    });

    for (const s of signals) {
      items.push({
        id: `signal:${s.id}`,
        type: "signal",
        prospectId: s.prospectId,
        prospectName: `${s.prospect.firstName} ${s.prospect.lastName}`,
        companyId: s.prospect.companyId,
        companyName: s.prospect.companyRef?.name ?? s.prospect.company,
        summary: s.summary || s.type,
        nextBestAction: "Draft outreach",
        ctaUrl: `/prospects/${s.prospectId}?action=draft&signalId=${s.id}`,
        fitBucket: s.prospect.companyRef?.fitBucket ?? null,
        pipelineStage: s.prospect.pipelineStage,
        urgencyScore: s.urgencyScore,
        sourceAttribution: `Signal (urgency ${s.urgencyScore})`,
        createdAt: s.createdAt.toISOString(),
      });
    }

    // 2. Overdue follow-ups
    const overdueProspects = await prisma.prospect.findMany({
      where: {
        userId,
        nextFollowUpAt: { lt: now, not: null },
      },
      include: {
        companyRef: { select: { id: true, name: true, fitBucket: true } },
        outreach: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { nextFollowUpAt: "asc" },
      take: 10,
    });

    for (const p of overdueProspects) {
      const lastOutreach = p.outreach[0];
      const daysOverdue = p.nextFollowUpAt
        ? Math.floor(
            (now.getTime() - new Date(p.nextFollowUpAt).getTime()) /
              (24 * 60 * 60 * 1000)
          )
        : 0;
      items.push({
        id: `followup:${p.id}`,
        type: "followup",
        prospectId: p.id,
        prospectName: `${p.firstName} ${p.lastName}`,
        companyId: p.companyId,
        companyName: p.companyRef?.name ?? p.company,
        summary: lastOutreach
          ? `Follow up on ${lastOutreach.channel} (${daysOverdue}d overdue)`
          : `${daysOverdue}d overdue — plan first touch`,
        nextBestAction: "Send follow-up",
        ctaUrl: `/prospects/${p.id}?action=draft`,
        fitBucket: p.companyRef?.fitBucket ?? null,
        pipelineStage: p.pipelineStage,
        urgencyScore: 3,
        sourceAttribution: `${daysOverdue} days since last contact`,
        createdAt: p.nextFollowUpAt?.toISOString() ?? p.updatedAt.toISOString(),
      });
    }

    // 3. New intel since yesterday (from fragments or company intel)
    const recentIntel = await prisma.companyIntel.findMany({
      where: {
        company: { userId },
        createdAt: { gte: yesterday },
      },
      include: {
        company: {
          select: { id: true, name: true, fitBucket: true },
        },
      },
      orderBy: { urgencyScore: "desc" },
      take: 5,
    });

    const companyIds = [...new Set(recentIntel.map((i) => i.companyId))];
    const primaryProspects = await prisma.prospect.findMany({
      where: {
        companyId: { in: companyIds },
        userId,
        lastContactedAt: { not: null },
      },
      orderBy: { lastContactedAt: "desc" },
      select: { id: true, firstName: true, lastName: true, companyId: true },
    });
    const prospectByCompany = new Map<string | null, (typeof primaryProspects)[0]>();
    for (const p of primaryProspects) {
      if (p.companyId && !prospectByCompany.has(p.companyId)) {
        prospectByCompany.set(p.companyId, p);
      }
    }

    for (const i of recentIntel) {
      const primaryProspect = prospectByCompany.get(i.companyId) ?? null;
      items.push({
        id: `intel:${i.id}`,
        type: "intel",
        prospectId: primaryProspect?.id ?? "",
        prospectName: primaryProspect
          ? `${primaryProspect.firstName} ${primaryProspect.lastName}`
          : i.company.name,
        companyId: i.companyId,
        companyName: i.company.name,
        summary: i.summary,
        nextBestAction: primaryProspect ? "Draft outreach" : "Review account",
        ctaUrl: primaryProspect
          ? `/prospects/${primaryProspect.id}?action=draft`
          : `/companies/${i.companyId}`,
        fitBucket: i.company.fitBucket,
        pipelineStage: null,
        urgencyScore: i.urgencyScore,
        sourceAttribution: `New intel (${i.type})`,
        createdAt: i.createdAt.toISOString(),
      });
    }

    // 4. Accounts going cold (staleProspectDays)
    const goingCold = await prisma.prospect.findMany({
      where: {
        userId,
        lastContactedAt: { lte: staleCutoff },
        lastContactedAt: { not: null },
        companyId: { not: null },
      },
      include: {
        companyRef: { select: { id: true, name: true, fitBucket: true } },
      },
      orderBy: { lastContactedAt: "asc" },
      take: 5,
    });

    for (const p of goingCold) {
      const daysSince =
        p.lastContactedAt
          ? Math.floor(
              (now.getTime() - new Date(p.lastContactedAt).getTime()) /
                (24 * 60 * 60 * 1000)
            )
          : 0;
      items.push({
        id: `cold:${p.id}`,
        type: "followup",
        prospectId: p.id,
        prospectName: `${p.firstName} ${p.lastName}`,
        companyId: p.companyId,
        companyName: p.companyRef?.name ?? p.company,
        summary: `Account going cold — ${daysSince}d since last contact`,
        nextBestAction: "Re-engage",
        ctaUrl: `/prospects/${p.id}?action=draft`,
        fitBucket: p.companyRef?.fitBucket ?? null,
        pipelineStage: p.pipelineStage,
        urgencyScore: 2,
        sourceAttribution: `${daysSince} days since contact`,
        createdAt: p.lastContactedAt?.toISOString() ?? p.updatedAt.toISOString(),
      });
    }

    // Dedupe by prospect (prefer signal > followup > intel > cold)
    const seen = new Set<string>();
    const deduped: BriefItem[] = [];
    const priority = (i: BriefItem) =>
      i.type === "signal" ? 0 : i.type === "followup" ? 1 : i.type === "intel" ? 2 : 3;
    const sorted = [...items].sort((a, b) => {
      if (a.prospectId !== b.prospectId) return 0;
      return priority(a) - priority(b);
    });
    for (const i of sorted) {
      const key = i.prospectId || i.companyId || i.id;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(i);
    }

    // Take top 7
    const topItems = deduped.slice(0, 7);

    // Group by fit bucket
    const byBucket: Record<string, BriefItem[]> = {};
    for (const b of FIT_BUCKETS) byBucket[b] = [];
    byBucket["_none"] = [];
    for (const i of topItems) {
      const b = i.fitBucket && FIT_BUCKETS.includes(i.fitBucket) ? i.fitBucket : "_none";
      byBucket[b].push(i);
    }

    // Simple AI summary would require an extra LLM call - skip for MVP, return null
    const summary: string | null = null;

    return NextResponse.json({
      summary,
      items: topItems,
      byBucket: {
        quick_win: byBucket.quick_win,
        strategic_bet: byBucket.strategic_bet,
        nurture: byBucket.nurture,
        park: byBucket.park,
        _none: byBucket._none,
      },
    } satisfies BriefResponse);
  } catch (error) {
    console.error("[brain/brief] error:", error);
    return NextResponse.json(
      { error: "Failed to load brief" },
      { status: 500 }
    );
  }
}
