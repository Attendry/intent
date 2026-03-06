import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

/**
 * GET /api/handoffs
 * List pending handoffs for the current user (where they are the recipient).
 */
export async function GET(_request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;

    const handoffs = await prisma.accountHandoff.findMany({
      where: { toUserId: auth.user.id, status: "pending" },
      include: {
        company: { select: { id: true, name: true } },
        fromUser: { select: { id: true, email: true } },
      },
      orderBy: { requestedAt: "desc" },
    });

    return NextResponse.json(
      handoffs.map((h) => ({
        id: h.id,
        companyId: h.company.id,
        companyName: h.company.name,
        fromUserEmail: h.fromUser.email,
        handoffNotes: h.handoffNotes,
        requestedAt: h.requestedAt,
      }))
    );
  } catch (error) {
    console.error("GET /api/handoffs error:", error);
    return NextResponse.json(
      { error: "Failed to fetch handoffs" },
      { status: 500 }
    );
  }
}
