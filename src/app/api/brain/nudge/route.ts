import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

/**
 * GET /api/brain/nudge?prospectId=... or ?companyId=...
 * Returns 1-2 high-signal nudges with next best action.
 * Only returns when: urgency >= 4, or daysSinceLastContact > 21, or pipelineStage is proposal with new intel.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const { searchParams } = new URL(request.url);
    const prospectId = searchParams.get("prospectId");
    const companyId = searchParams.get("companyId");

    if (!prospectId && !companyId) {
      return NextResponse.json({ nudges: [] });
    }

    const nudges: Array<{ text: string; nextBestAction: string; ctaUrl: string }> = [];

    if (prospectId) {
      const prospect = await prisma.prospect.findFirst({
        where: { id: prospectId, userId },
        include: {
          signals: {
            where: { actedOn: false, dismissed: false },
            orderBy: { urgencyScore: "desc" },
            take: 5,
          },
          companyRef: { select: { id: true, name: true } },
        },
      });

      if (!prospect) return NextResponse.json({ nudges: [] });

      const daysSinceContact = prospect.lastContactedAt
        ? Math.floor(
            (Date.now() - new Date(prospect.lastContactedAt).getTime()) /
              (24 * 60 * 60 * 1000)
          )
        : 999;

      const hasHighUrgencySignal = prospect.signals.some((s) => s.urgencyScore >= 4);
      const isProposalWithNewIntel =
        prospect.pipelineStage === "proposal" &&
        prospect.signals.length > 0 &&
        prospect.signals.some(
          (s) =>
            new Date(s.createdAt).getTime() >
            Date.now() - 7 * 24 * 60 * 60 * 1000
        );

      if (hasHighUrgencySignal) {
        const top = prospect.signals[0];
        nudges.push({
          text: `${top.summary || top.type} (urgency ${top.urgencyScore})`,
          nextBestAction: "Draft outreach",
          ctaUrl: `/prospects/${prospectId}?action=draft&signalId=${top.id}`,
        });
      }

      if (daysSinceContact > 21 && !nudges.some((n) => n.nextBestAction === "Re-engage")) {
        nudges.push({
          text: `No contact in ${daysSinceContact} days — consider re-engaging.`,
          nextBestAction: "Re-engage",
          ctaUrl: `/prospects/${prospectId}?action=draft`,
        });
      }

      if (isProposalWithNewIntel && nudges.length < 2) {
        nudges.push({
          text: "Proposal stage with recent intel — good time to follow up.",
          nextBestAction: "Follow up",
          ctaUrl: `/prospects/${prospectId}?action=draft`,
        });
      }
    }

    if (companyId && nudges.length < 2) {
      const company = await prisma.company.findFirst({
        where: { id: companyId, userId },
        include: {
          intel: {
            where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
            take: 5,
          },
        },
      });

      if (company && company.intel.length > 0) {
        const recent = company.intel[0];
        nudges.push({
          text: `New intel: ${recent.summary.slice(0, 100)}${recent.summary.length > 100 ? "..." : ""}`,
          nextBestAction: "Review & reach out",
          ctaUrl: `/companies/${companyId}`,
        });
      }
    }

    return NextResponse.json({ nudges: nudges.slice(0, 2) });
  } catch (error) {
    console.error("[brain/nudge] error:", error);
    return NextResponse.json({ nudges: [] });
  }
}
