import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { generateMeetingSummary } from "@/lib/ai";
import { createFragmentFromMeetingLog } from "@/lib/fragment-sync";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const body = await request.json();
    const { prospectId, notes, meetingDate, outcome, runAi = true } = body as {
      prospectId: string;
      notes?: string;
      meetingDate?: string;
      outcome?: string;
      runAi?: boolean;
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

    return NextResponse.json({
      ...meetingLog,
      actionItemsParsed: actionItems ? (JSON.parse(actionItems) as string[]) : [],
    });
  } catch (error) {
    console.error("POST /api/meeting-log error:", error);
    return NextResponse.json(
      { error: "Failed to create meeting log" },
      { status: 500 }
    );
  }
}
