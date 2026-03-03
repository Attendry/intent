import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { calculatePriorityScore } from "@/lib/scoring";
import { parseJsonArray } from "@/lib/json";
import { requireAuth } from "@/lib/auth";

interface QueueItem {
  prospect: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    title: string | null;
    company: string | null;
    industry: string | null;
    linkedinUrl: string | null;
    personaSummary: string | null;
    starred: boolean;
    preferredLang: string;
    lastContactedAt: Date | null;
    nextFollowUpAt: Date | null;
  };
  signal?: {
    id: string;
    type: string;
    summary: string | null;
    sourceUrl: string | null;
    urgencyScore: number;
    createdAt: Date;
    outreachAngle: string | null;
  };
  followUpReason?: {
    lastContactedAt: Date | null;
    lastChannel: string | null;
    lastOutcome: string | null;
    daysOverdue: number;
  };
  suggestedReason?: string;
  score: number;
  contentSuggestions: { id: string; title: string; type: string }[];
  queueType: "signal" | "followup" | "suggested";
}

export async function GET() {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const prospectsWithSignals = await prisma.prospect.findMany({
      where: {
        userId,
        signals: {
          some: {
            actedOn: false,
            dismissed: false,
            OR: [
              { snoozedUntil: null },
              { snoozedUntil: { lte: now } },
            ],
          },
        },
      },
      include: {
        signals: {
          where: {
            actedOn: false,
            dismissed: false,
            OR: [
              { snoozedUntil: null },
              { snoozedUntil: { lte: now } },
            ],
          },
          orderBy: { urgencyScore: "desc" },
        },
        outreach: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    const signalIds = prospectsWithSignals.map((p) => p.id);

    const followUpProspects = await prisma.prospect.findMany({
      where: {
        userId,
        nextFollowUpAt: { lte: today },
        NOT: { id: { in: signalIds } },
      },
      include: {
        signals: { where: { actedOn: false, dismissed: false } },
        outreach: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    const followUpIds = followUpProspects.map((p) => p.id);
    const excludedIds = [...signalIds, ...followUpIds];

    // Suggested outreach: prospects with no active signals and no overdue follow-ups
    const suggestedProspects = await prisma.prospect.findMany({
      where: {
        userId,
        NOT: { id: { in: excludedIds } },
      },
      include: {
        outreach: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: [
        { starred: "desc" },
        { updatedAt: "desc" },
      ],
      take: 10,
    });

    const allContent = await prisma.content.findMany({
      where: { userId },
    });
    const queueItems: QueueItem[] = [];

    function mapProspect(p: typeof prospectsWithSignals[0]) {
      return {
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        email: p.email,
        title: p.title,
        company: p.company,
        industry: p.industry,
        linkedinUrl: p.linkedinUrl,
        personaSummary: p.personaSummary,
        starred: p.starred,
        preferredLang: p.preferredLang,
        lastContactedAt: p.lastContactedAt,
        nextFollowUpAt: p.nextFollowUpAt,
      };
    }

    for (const p of prospectsWithSignals) {
      const topSignal = p.signals[0];
      const contentSuggestions = findContentMatches(p, topSignal, allContent);
      const score = calculatePriorityScore(p, p.signals, contentSuggestions.length > 0);

      queueItems.push({
        prospect: mapProspect(p),
        signal: topSignal
          ? {
              id: topSignal.id,
              type: topSignal.type,
              summary: topSignal.summary,
              sourceUrl: topSignal.sourceUrl,
              urgencyScore: topSignal.urgencyScore,
              createdAt: topSignal.createdAt,
              outreachAngle: topSignal.outreachAngle,
            }
          : undefined,
        score,
        contentSuggestions: contentSuggestions.map((c) => ({
          id: c.id,
          title: c.title,
          type: c.type,
        })),
        queueType: "signal",
      });
    }

    for (const p of followUpProspects) {
      const lastOutreach = p.outreach[0];
      const daysOverdue = p.nextFollowUpAt
        ? Math.max(0, Math.floor((now.getTime() - p.nextFollowUpAt.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;

      const contentSuggestions = findContentMatches(p, null, allContent);
      const score = calculatePriorityScore(p, p.signals, contentSuggestions.length > 0);

      queueItems.push({
        prospect: mapProspect(p as typeof prospectsWithSignals[0]),
        followUpReason: {
          lastContactedAt: p.lastContactedAt,
          lastChannel: lastOutreach?.channel || null,
          lastOutcome: lastOutreach?.outcome || null,
          daysOverdue,
        },
        score,
        contentSuggestions: contentSuggestions.map((c) => ({
          id: c.id,
          title: c.title,
          type: c.type,
        })),
        queueType: "followup",
      });
    }

    for (const p of suggestedProspects) {
      const lastOutreach = p.outreach[0];
      const daysSinceContact = p.lastContactedAt
        ? Math.floor((now.getTime() - p.lastContactedAt.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      let reason = "No recent activity";
      if (daysSinceContact !== null) {
        reason = `Last contacted ${daysSinceContact} days ago`;
      } else if (!lastOutreach) {
        reason = "No outreach yet — consider an introduction";
      }

      let score = 10;
      if (p.starred) score += 20;
      if (p.personaSummary) score += 10;
      if (p.priorityTier === "high") score += 15;
      else if (p.priorityTier === "medium") score += 5;
      if (daysSinceContact !== null) {
        score += Math.min(daysSinceContact / 7, 15);
      } else if (!lastOutreach) {
        score += 12;
      }

      const contentSuggestions = findContentMatches(p as typeof prospectsWithSignals[0], null, allContent);

      queueItems.push({
        prospect: mapProspect(p as typeof prospectsWithSignals[0]),
        suggestedReason: reason,
        score: Math.round(score),
        contentSuggestions: contentSuggestions.map((c) => ({
          id: c.id,
          title: c.title,
          type: c.type,
        })),
        queueType: "suggested",
      });
    }

    queueItems.sort((a, b) => {
      const typeOrder = { signal: 0, followup: 1, suggested: 2 };
      const typeDiff = typeOrder[a.queueType] - typeOrder[b.queueType];
      if (typeDiff !== 0) return typeDiff;
      return b.score - a.score;
    });

    const suggestedCount = queueItems.filter((i) => i.queueType === "suggested").length;

    return NextResponse.json({
      items: queueItems,
      total: queueItems.length,
      signalCount: queueItems.filter((i) => i.queueType === "signal").length,
      followUpCount: queueItems.filter((i) => i.queueType === "followup").length,
      suggestedCount,
    });
  } catch (error) {
    console.error("GET /api/queue error:", error);
    return NextResponse.json(
      { error: "Failed to build queue" },
      { status: 500 }
    );
  }
}

function findContentMatches(
  prospect: { personaTags?: string | null; industry?: string | null },
  signal: { contentSuggestionIds?: string | null; type?: string } | null,
  allContent: { id: string; title: string; type: string; tags: string | null; personaFit: string | null; useCaseFit: string | null }[]
) {
  const ids = parseJsonArray(signal?.contentSuggestionIds);
  if (ids.length > 0) {
    const matched = allContent.filter((c) => ids.includes(c.id));
    if (matched.length > 0) return matched.slice(0, 3);
  }

  const prospectTags = parseJsonArray(prospect.personaTags);

  if (prospectTags.length === 0 && !prospect.industry) return [];

  return allContent
    .filter((c) => {
      const cTags = parseJsonArray(c.personaFit);
      const cKeywords = parseJsonArray(c.tags);

      const tagOverlap = prospectTags.some((t) =>
        cTags.some((ct) => ct.toLowerCase().includes(t.toLowerCase()))
      );
      const industryMatch = prospect.industry
        ? cKeywords.some((k) => k.toLowerCase().includes(prospect.industry!.toLowerCase()))
        : false;

      return tagOverlap || industryMatch;
    })
    .slice(0, 3);
}
