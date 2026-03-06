import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

/**
 * GET /api/findings/shared-with-me
 * Findings shared with the current user (excludes own + collaborator-account findings).
 */
export async function GET(_request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const findings = await prisma.savedFinding.findMany({
      where: {
        shares: { some: { sharedWithId: userId } },
      },
      orderBy: { createdAt: "desc" },
      include: {
        prospect: {
          include: {
            companyRef: { select: { id: true, name: true } },
          },
        },
        company: { select: { id: true, name: true } },
        createdBy: { select: { id: true, email: true } },
        shares: {
          where: { sharedWithId: userId },
          select: { shareType: true, sharedBy: { select: { email: true } } },
        },
      },
    });

    return NextResponse.json(findings);
  } catch (e) {
    console.error("[findings] shared-with-me error:", e);
    return NextResponse.json(
      { error: "Failed to fetch shared findings" },
      { status: 500 }
    );
  }
}
