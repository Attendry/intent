import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

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

    await prisma.accountCollaborator.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/collaborator-invites/[id]/decline error:", error);
    return NextResponse.json(
      { error: "Failed to decline invite" },
      { status: 500 }
    );
  }
}
