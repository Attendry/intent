import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyCronAuth } from "@/lib/cron-auth";

export async function GET(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  try {
    const now = new Date();
    const users = await prisma.user.findMany({ select: { id: true } });
    let escalated = 0;
    let reEngagementCreated = 0;
    let newProspectCreated = 0;

    for (const user of users) {
      const settingsRow = await prisma.userSettings.findUnique({
        where: { userId: user.id },
      });
      const settings = settingsRow ? JSON.parse(settingsRow.data) : {};
      const reEngagementDays = settings.reEngagementDays ?? 30;

      // 1. Escalate overdue prospects with 3+ unacted signals
      const overdueProspects = await prisma.prospect.findMany({
        where: { userId: user.id, nextFollowUpAt: { lte: now } },
        include: {
          signals: { where: { actedOn: false, dismissed: false } },
        },
      });

      for (const prospect of overdueProspects) {
        if (prospect.signals.length >= 3 && prospect.priorityTier !== "high") {
          await prisma.prospect.update({
            where: { id: prospect.id },
            data: { priorityTier: "high" },
          });
          escalated++;
        }
      }

      // 2. Re-engagement signals for dormant contacts
      const reEngagementCutoff = new Date(
        now.getTime() - reEngagementDays * 24 * 60 * 60 * 1000
      );

      const dormantProspects = await prisma.prospect.findMany({
        where: {
          userId: user.id,
          OR: [
            { lastContactedAt: { lte: reEngagementCutoff } },
            {
              lastContactedAt: null,
              createdAt: { lte: reEngagementCutoff },
            },
          ],
        },
        include: {
          signals: {
            where: { actedOn: false, dismissed: false, type: "re_engagement" },
          },
          outreach: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      });

      for (const prospect of dormantProspects) {
        if (prospect.signals.length > 0) continue;

        const lastDate = prospect.lastContactedAt || prospect.createdAt;
        const daysSince = Math.floor(
          (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        const urgency = daysSince > 60 ? 3 : 2;

        await prisma.signal.create({
          data: {
            prospectId: prospect.id,
            type: "re_engagement",
            summary: `No outreach to ${prospect.firstName} ${prospect.lastName} in ${daysSince} days — consider re-engaging.`,
            urgencyScore: urgency,
            outreachAngle: prospect.outreach[0]
              ? `Last outreach was ${prospect.outreach[0].channel}. Try a different approach.`
              : "No prior outreach — plan an initial touchpoint.",
          },
        });
        reEngagementCreated++;
      }

      // 3. New prospect signals for recently imported contacts with no activity
      const newProspects = await prisma.prospect.findMany({
        where: {
          userId: user.id,
          createdAt: { lte: reEngagementCutoff },
        },
        include: {
          signals: { where: { actedOn: false, dismissed: false } },
          outreach: { take: 1 },
        },
      });

      for (const prospect of newProspects) {
        if (prospect.outreach.length > 0) continue;
        if (prospect.signals.length > 0) continue;

        await prisma.signal.create({
          data: {
            prospectId: prospect.id,
            type: "new_prospect",
            summary: `New prospect ${prospect.firstName} ${prospect.lastName}${prospect.company ? ` at ${prospect.company}` : ""} — review persona and plan initial outreach.`,
            urgencyScore: 3,
            outreachAngle: prospect.personaSummary
              ? "Persona enriched — ready for personalized outreach."
              : "Consider enriching persona before reaching out.",
          },
        });
        newProspectCreated++;
      }
    }

    return NextResponse.json({
      escalated,
      reEngagementCreated,
      newProspectCreated,
      timestamp: now.toISOString(),
      message: `Cadence check complete. Escalated ${escalated}, created ${reEngagementCreated} re-engagement and ${newProspectCreated} new prospect signals.`,
    });
  } catch (error) {
    console.error("Cadence cron error:", error);
    return NextResponse.json(
      { error: "Cadence check failed" },
      { status: 500 }
    );
  }
}
