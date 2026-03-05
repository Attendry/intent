import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { calculateNextFollowUp, type CadenceSettings } from "@/lib/cadence";
import { requireAuth } from "@/lib/auth";
import { getSettingsForUser } from "@/lib/ai";
import { createOutreachSchema, parseRequestBody } from "@/lib/validation";
import { createFragmentFromOutreachLog, updateFragmentStatusForSignal } from "@/lib/fragment-sync";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const parsed = await parseRequestBody(request, createOutreachSchema);
    if ("error" in parsed) return parsed.error;
    const body = parsed.data;

    const prospect = await prisma.prospect.findFirst({
      where: { id: body.prospectId, userId },
    });
    if (!prospect) {
      return NextResponse.json(
        { error: "Prospect not found" },
        { status: 404 }
      );
    }

    const settings = await getSettingsForUser(userId);
    let cadenceSettings: CadenceSettings | undefined;
    let outcomeRules: { no_response_days?: number; positive_days?: number; negative_days?: number; meeting_booked_days?: number | null } | undefined;
    if (settings.cadence) cadenceSettings = settings.cadence as CadenceSettings;
    if (settings.outcomeCadence) outcomeRules = settings.outcomeCadence as typeof outcomeRules;

    const now = new Date();
    const rawOutcome = body.outcome || "no_response";
    const outcomeMap: Record<string, "no_response" | "positive" | "negative" | "meeting_booked"> = {
      sent: "no_response", replied: "positive", interested: "positive",
      not_interested: "negative", bounced: "negative",
      no_response: "no_response", positive: "positive", negative: "negative", meeting_booked: "meeting_booked",
    };
    const outcome = outcomeMap[rawOutcome] ?? "no_response";
    const nextFollowUpResult = calculateNextFollowUp(body.channel, now, cadenceSettings, outcome, outcomeRules);
    const nextFollowUpAt = nextFollowUpResult;

    const outreachLog = await prisma.outreachLog.create({
      data: {
        prospectId: body.prospectId,
        channel: body.channel,
        messageSent: body.messageSent || null,
        subjectLine: body.subjectLine || null,
        outcome: rawOutcome,
        notes: body.notes || null,
        language: body.language || "en",
        contentIds: body.contentIds?.length ? JSON.stringify(body.contentIds) : null,
        nextFollowUpAt: nextFollowUpAt ?? null,
      },
    });

    createFragmentFromOutreachLog({
      id: outreachLog.id,
      prospectId: outreachLog.prospectId,
      channel: outreachLog.channel,
      messageSent: outreachLog.messageSent,
      subjectLine: outreachLog.subjectLine,
      outcome: outreachLog.outcome,
      notes: outreachLog.notes,
    }).catch((e) => console.error("[fragment-sync] outreach:", e));

    await prisma.prospect.update({
      where: { id: body.prospectId },
      data: {
        lastContactedAt: now,
        nextFollowUpAt: nextFollowUpAt === null ? null : nextFollowUpAt,
        ...(outcome === "meeting_booked" ? { pipelineStage: "meeting_booked" } : {}),
      },
    });

    if (body.signalId) {
      await prisma.signal.update({
        where: { id: body.signalId },
        data: { actedOn: true },
      }).catch(() => {});
      updateFragmentStatusForSignal(body.signalId, "acted").catch((e) =>
        console.error("[fragment-sync] update signal status:", e)
      );
    }

    return NextResponse.json(outreachLog, { status: 201 });
  } catch (error) {
    console.error("POST /api/outreach error:", error);
    return NextResponse.json(
      { error: "Failed to log outreach" },
      { status: 500 }
    );
  }
}
