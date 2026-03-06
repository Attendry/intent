import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { requireCompanyAccess } from "@/lib/access";

/**
 * GET /api/companies/[id]/activity
 * Activity log for recent events on the account (coaching, attribution).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;

    const { id: companyId } = await params;
    const accessResult = await requireCompanyAccess(companyId, auth.user.id, {
      allowCollaborator: true,
    });
    if ("error" in accessResult) return accessResult.error;

    const logs = await prisma.accountActivityLog.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        user: { select: { id: true, email: true } },
      },
    });

    return NextResponse.json(
      logs.map((l) => ({
        id: l.id,
        action: l.action,
        entityType: l.entityType,
        entityId: l.entityId,
        createdAt: l.createdAt,
        userEmail: l.user.email,
      }))
    );
  } catch (error) {
    console.error("GET /api/companies/[id]/activity error:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity" },
      { status: 500 }
    );
  }
}
