import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { generateMeetingSummary, extractMeetingSignals } from "@/lib/ai";
import { createFragmentFromMeetingLog, createFragmentFromSignal } from "@/lib/fragment-sync";
import { logAccountActivity } from "@/lib/activity-log";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const body = await request.json();
    const { prospectId, notes, meetingDate, outcome, runAi = true, extractSignals = true } = body as {
      prospectId: string;
      notes?: string;
      meetingDate?: string;
      outcome?: string;
      runAi?: boolean;
      extractSignals?: boolean;
    };

    if (!prospectId) {
      return NextResponse.json(
        { error: "prospectId is required" },
        { status: 400 }
      );
    }

    const prospect = await prisma.prospect.findFirst({
      where: { id: prospectId, userId },
    });
    if (!prospect) {
      return NextResponse.json(
        { error: "Prospect not found" },
        { status: 404 }
      );
    }

    let summary: string | null = null;
    let actionItems: string | null = null;
    let suggestedStage: string | null = null;

    if (runAi && notes?.trim()) {
      try {
        const result = await generateMeetingSummary(userId, notes.trim(), {
          firstName: prospect.firstName,
          lastName: prospect.lastName,
          company: prospect.company,
          title: prospect.title,
        });
        summary = result.summary || null;
        actionItems = result.actionItems?.length
          ? JSON.stringify(result.actionItems)
          : null;
        suggestedStage = result.suggestedStage;
      } catch (err) {
        console.error("[meeting-log] AI summary error:", err);
      }
    }

    const meetingLog = await prisma.meetingLog.create({
      data: {
        prospectId,
        userId,
        notes: notes?.trim() || null,
        summary,
        actionItems,
        suggestedStage,
        outcome: outcome || null,
        meetingDate: meetingDate ? new Date(meetingDate) : null,
      },
    });

    createFragmentFromMeetingLog({
      id: meetingLog.id,
      prospectId: meetingLog.prospectId,
      userId: meetingLog.userId,
      summary: meetingLog.summary,
      notes: meetingLog.notes,
      actionItems: meetingLog.actionItems,
      outcome: meetingLog.outcome,
    }).catch((e) => console.error("[fragment-sync] meetingLog:", e));

    if (prospect.companyId) {
      logAccountActivity(
        prospect.companyId,
        userId,
        "meeting_logged",
        "meeting_log",
        meetingLog.id
      ).catch(() => {});
    }

    let signalsCreated = 0;
    const minUrgency = 3;
    if (extractSignals !== false && notes?.trim() && notes.trim().length >= 50) {
      try {
        const signals = await extractMeetingSignals(userId, notes.trim(), summary);
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        for (const sig of signals) {
          if (sig.urgencyScore < minUrgency) continue;
          const existing = await prisma.signal.findFirst({
            where: {
              prospectId,
              summary: sig.summary,
              actedOn: false,
              dismissed: false,
              createdAt: { gte: sevenDaysAgo },
            },
          });
          if (existing) continue;
          const created = await prisma.signal.create({
            data: {
              prospectId,
              type: sig.type,
              summary: sig.summary,
              urgencyScore: sig.urgencyScore,
              outreachAngle: sig.outreachAngle || null,
            },
          });
          createFragmentFromSignal({
            id: created.id,
            prospectId: created.prospectId,
            type: created.type,
            summary: created.summary,
            rawContent: null,
            urgencyScore: created.urgencyScore,
            actedOn: created.actedOn,
            dismissed: created.dismissed,
          }).catch((e) => console.error("[fragment-sync] signal:", e));
          signalsCreated++;
        }
      } catch (err) {
        console.error("[meeting-log] extractMeetingSignals error:", err);
      }
    }

    return NextResponse.json({
      ...meetingLog,
      actionItemsParsed: actionItems ? (JSON.parse(actionItems) as string[]) : [],
      signalsCreated,
    });
  } catch (error) {
    console.error("POST /api/meeting-log error:", error);
    return NextResponse.json(
      { error: "Failed to create meeting log" },
      { status: 500 }
    );
  }
}
