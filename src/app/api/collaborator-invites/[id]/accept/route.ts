import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { logAccountActivity } from "@/lib/activity-log";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;

    const { id } = await params;

    const invite = await prisma.accountCollaborator.findUnique({
      where: { id },
      include: { company: { select: { id: true, name: true } } },
    });

    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    if (invite.userId !== auth.user.id) {
      return NextResponse.json(
        { error: "This invite was sent to another user" },
        { status: 403 }
      );
    }

    if (invite.acceptedAt) {
      return NextResponse.json(
        { error: "Invite already accepted", companyId: invite.companyId },
        { status: 400 }
      );
    }

    await prisma.accountCollaborator.update({
      where: { id },
      data: { acceptedAt: new Date() },
    });

    logAccountActivity(
      invite.companyId,
      invite.invitedBy,
      "collaborator_added",
      "collaborator",
      invite.userId
    ).catch(() => {});

    return NextResponse.json({
      success: true,
      companyId: invite.companyId,
      companyName: invite.company.name,
    });
  } catch (error) {
    console.error("POST /api/collaborator-invites/[id]/accept error:", error);
    return NextResponse.json(
      { error: "Failed to accept invite" },
      { status: 500 }
    );
  }
}
