import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSettingsForUser } from "@/lib/ai";
import { requireAuth } from "@/lib/auth";

function getStaleThreshold(settings: { staleProspectDays?: number }): number {
  return settings.staleProspectDays ?? 30;
}

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const { searchParams } = new URL(request.url);
    const staleDaysParam = searchParams.get("staleDays");

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const settings = await getSettingsForUser(userId);
    const staleDays = staleDaysParam ? parseInt(staleDaysParam, 10) : getStaleThreshold(settings);
    const staleCutoff = new Date(now.getTime() - staleDays * 24 * 60 * 60 * 1000);

    const [
      outreachThisWeek,
      outreachLastWeek,
      signalsThisWeek,
      overdueFollowUps,
      outreachByOutcomeThisWeek,
      allOutreachThisWeek,
    ] = await Promise.all([
      prisma.outreachLog.count({
        where: {
          prospect: { userId },
          createdAt: { gte: oneWeekAgo },
        },
      }),
      prisma.outreachLog.count({
        where: {
          prospect: { userId },
          createdAt: {
            gte: twoWeeksAgo,
            lt: oneWeekAgo,
          },
        },
      }),
      prisma.signal.count({
        where: {
          prospect: { userId },
          createdAt: { gte: oneWeekAgo },
        },
      }),
      prisma.prospect.count({
        where: { userId, nextFollowUpAt: { lt: now } },
      }),
      prisma.outreachLog.groupBy({
        by: ["outcome"],
        where: {
          prospect: { userId },
          createdAt: { gte: oneWeekAgo },
        },
        _count: true,
      }),
      prisma.outreachLog.findMany({
        where: {
          prospect: { userId },
          createdAt: { gte: oneWeekAgo },
        },
        select: { outcome: true, contentIds: true },
      }),
    ]);

    const positiveOutcomes = ["positive", "replied", "interested", "meeting_booked"];
    const respondedCount = outreachByOutcomeThisWeek
      .filter((g) => positiveOutcomes.includes(g.outcome))
      .reduce((sum, g) => sum + g._count, 0);
    const meetingsBooked = outreachByOutcomeThisWeek
      .find((g) => g.outcome === "meeting_booked")
      ?._count ?? 0;
    const responseRate = outreachThisWeek > 0
      ? Math.round((respondedCount / outreachThisWeek) * 100)
      : 0;

    const contentEffectiveness: Record<string, { used: number; positive: number; meetings: number }> = {};
    for (const o of allOutreachThisWeek) {
      const isPositive = positiveOutcomes.includes(o.outcome);
      const isMeeting = o.outcome === "meeting_booked";
      let ids: string[] = [];
      if (o.contentIds) {
        try {
          ids = JSON.parse(o.contentIds) as string[];
        } catch {}
      }
      if (ids.length === 0) ids = ["_none"];
      for (const cid of ids) {
        if (!contentEffectiveness[cid]) {
          contentEffectiveness[cid] = { used: 0, positive: 0, meetings: 0 };
        }
        contentEffectiveness[cid].used++;
        if (isPositive) contentEffectiveness[cid].positive++;
        if (isMeeting) contentEffectiveness[cid].meetings++;
      }
    }

    const unactedRaw = await prisma.prospect.findMany({
      where: {
        userId,
        signals: {
          some: { actedOn: false, dismissed: false },
        },
      },
      include: {
        signals: {
          where: { actedOn: false, dismissed: false },
          orderBy: { urgencyScore: "desc" },
        },
      },
    });

    const unactedProspects = unactedRaw
      .map((p) => ({
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        company: p.company,
        signalCount: p.signals.length,
        highestUrgency: p.signals[0]?.urgencyScore ?? 0,
      }))
      .sort((a, b) => b.highestUrgency - a.highestUrgency);

    const staleProspects = await prisma.prospect.findMany({
      where: {
        userId,
        OR: [
          { lastContactedAt: null },
          { lastContactedAt: { lt: staleCutoff } },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        company: true,
        lastContactedAt: true,
      },
      orderBy: { lastContactedAt: "asc" },
    });

    const topContent = await prisma.content.findMany({
      where: { userId },
      orderBy: { timesUsed: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        type: true,
        timesUsed: true,
      },
    });

    const contentWithEffectiveness = topContent.map((c) => {
      const eff = contentEffectiveness[c.id] || { used: 0, positive: 0, meetings: 0 };
      return {
        ...c,
        positiveOutcomes: eff.positive,
        meetingsBooked: eff.meetings,
      };
    });

    return NextResponse.json({
      outreachThisWeek,
      outreachLastWeek,
      outreachWoW: outreachLastWeek > 0
        ? Math.round(((outreachThisWeek - outreachLastWeek) / outreachLastWeek) * 100)
        : 0,
      responseRate,
      meetingsBooked,
      signalsThisWeek,
      unactedProspects,
      overdueFollowUps,
      staleProspects,
      topContent: contentWithEffectiveness,
      staleDays,
    });
  } catch (error) {
    console.error("GET /api/review error:", error);
    return NextResponse.json(
      { error: "Failed to load review data" },
      { status: 500 }
    );
  }
}
