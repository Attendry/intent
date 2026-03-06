import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

/**
 * POST /api/companies/[id]/handoff/[handoffId]/decline
 * Decline handoff.
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

    await prisma.accountHandoff.update({
      where: { id: handoffId },
      data: { status: "declined", completedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/companies/[id]/handoff/[handoffId]/decline error:", error);
    return NextResponse.json(
      { error: "Failed to decline handoff" },
      { status: 500 }
    );
  }
}
