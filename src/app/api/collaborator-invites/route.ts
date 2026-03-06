import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

/**
 * GET /api/collaborator-invites
 * List pending invites for the current user.
 */
export async function GET(_request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;

    const invites = await prisma.accountCollaborator.findMany({
      where: { userId: auth.user.id, acceptedAt: null },
      include: {
        company: { select: { id: true, name: true } },
        inviter: { select: { id: true, email: true } },
      },
      orderBy: { invitedAt: "desc" },
    });

    return NextResponse.json(
      invites.map((i) => ({
        id: i.id,
        companyId: i.company.id,
        companyName: i.company.name,
        invitedBy: i.inviter.email,
        role: i.role,
        invitedAt: i.invitedAt,
      }))
    );
  } catch (error) {
    console.error("GET /api/collaborator-invites error:", error);
    return NextResponse.json(
      { error: "Failed to fetch invites" },
      { status: 500 }
    );
  }
}
