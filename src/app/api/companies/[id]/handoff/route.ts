import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { requireCompanyAccess } from "@/lib/access";
import { logAccountActivity } from "@/lib/activity-log";

/**
 * POST /api/companies/[id]/handoff
 * Request handoff to another user (owner only).
 * Body: { toUserId: string, checklist?: object, handoffNotes?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;

    const { id: companyId } = await params;
    const accessResult = await requireCompanyAccess(companyId, auth.user.id, {
      allowCollaborator: false,
    });
    if ("error" in accessResult) return accessResult.error;

    const body = await request.json();
    const toUserId = body.toUserId as string | undefined;
    if (!toUserId) {
      return NextResponse.json(
        { error: "toUserId is required" },
        { status: 400 }
      );
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { userId: true },
    });

    if (!company || company.userId !== auth.user.id) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    if (toUserId === auth.user.id) {
      return NextResponse.json(
        { error: "Cannot hand off to yourself" },
        { status: 400 }
      );
    }

    const toUser = await prisma.user.findUnique({
      where: { id: toUserId },
      select: { id: true },
    });
    if (!toUser) {
      return NextResponse.json(
        { error: "Recipient user not found" },
        { status: 404 }
      );
    }

    const existing = await prisma.accountHandoff.findFirst({
      where: {
        companyId,
        status: "pending",
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A handoff is already pending for this account" },
        { status: 400 }
      );
    }

    const checklist = body.checklist
      ? JSON.stringify(body.checklist)
      : null;
    const handoffNotes =
      typeof body.handoffNotes === "string" ? body.handoffNotes : null;

    const handoff = await prisma.accountHandoff.create({
      data: {
        companyId,
        fromUserId: auth.user.id,
        toUserId,
        checklist,
        handoffNotes,
      },
      include: {
        company: { select: { id: true, name: true } },
        toUser: { select: { id: true, email: true } },
      },
    });

    logAccountActivity(
      companyId,
      auth.user.id,
      "handoff_requested",
      "handoff",
      handoff.id
    ).catch(() => {});

    return NextResponse.json(
      {
        id: handoff.id,
        companyId: handoff.companyId,
        companyName: handoff.company.name,
        toUserId: handoff.toUserId,
        toUserEmail: handoff.toUser.email,
        status: handoff.status,
        requestedAt: handoff.requestedAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/companies/[id]/handoff error:", error);
    return NextResponse.json(
      { error: "Failed to request handoff" },
      { status: 500 }
    );
  }
}
