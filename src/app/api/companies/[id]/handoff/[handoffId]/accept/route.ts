import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { logAccountActivity } from "@/lib/activity-log";

/**
 * POST /api/companies/[id]/handoff/[handoffId]/accept
 * Accept handoff and transfer ownership.
 */
export async function POST(
  _request: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; handoffId: string }> }
) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;

    const { id: companyId, handoffId } = await params;

    const handoff = await prisma.accountHandoff.findUnique({
      where: { id: handoffId },
      include: { company: { select: { id: true, name: true, userId: true } } },
    });

    if (!handoff || handoff.companyId !== companyId) {
      return NextResponse.json({ error: "Handoff not found" }, { status: 404 });
    }

    if (handoff.toUserId !== auth.user.id) {
      return NextResponse.json(
        { error: "This handoff was sent to another user" },
        { status: 403 }
      );
    }

    if (handoff.status !== "pending") {
      return NextResponse.json(
        { error: `Handoff already ${handoff.status}` },
        { status: 400 }
      );
    }

    await prisma.$transaction([
      prisma.company.update({
        where: { id: companyId },
        data: { userId: handoff.toUserId },
      }),
      prisma.accountHandoff.update({
        where: { id: handoffId },
        data: { status: "accepted", completedAt: new Date() },
      }),
      prisma.accountCollaborator.deleteMany({
        where: {
          companyId,
          userId: handoff.fromUserId,
        },
      }),
    ]);

    logAccountActivity(
      companyId,
      auth.user.id,
      "handoff_accepted",
      "handoff",
      handoffId
    ).catch(() => {});

    return NextResponse.json({
      success: true,
      companyId,
      companyName: handoff.company.name,
    });
  } catch (error) {
    console.error("POST /api/companies/[id]/handoff/[handoffId]/accept error:", error);
    return NextResponse.json(
      { error: "Failed to accept handoff" },
      { status: 500 }
    );
  }
}
