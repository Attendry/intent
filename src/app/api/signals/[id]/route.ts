import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { updateSignalSchema, parseRequestBody } from "@/lib/validation";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const { id } = await params;
    const parsed = await parseRequestBody(request, updateSignalSchema);
    if ("error" in parsed) return parsed.error;
    const body = parsed.data;

    const existing = await prisma.signal.findFirst({
      where: { id, prospect: { userId } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Signal not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};

    if (body.actedOn !== undefined) data.actedOn = body.actedOn;
    if (body.dismissed !== undefined) data.dismissed = body.dismissed;
    if (body.snoozedUntil !== undefined) {
      data.snoozedUntil = body.snoozedUntil ? new Date(body.snoozedUntil) : null;
    }
    if (body.urgencyScore !== undefined) data.urgencyScore = body.urgencyScore;
    if (body.summary !== undefined) data.summary = body.summary;
    if (body.outreachAngle !== undefined) data.outreachAngle = body.outreachAngle;
    if (body.private !== undefined) data.private = body.private;

    const signal = await prisma.signal.update({ where: { id }, data });
    return NextResponse.json(signal);
  } catch (error) {
    console.error("PUT /api/signals/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update signal" },
      { status: 500 }
    );
  }
}
