import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { requireCompanyAccess } from "@/lib/access";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;

    const { id: companyId, userId: targetUserId } = await params;
    const accessResult = await requireCompanyAccess(companyId, auth.user.id, {
      allowCollaborator: false,
    });
    if ("error" in accessResult) return accessResult.error;

    const body = await request.json();

    const collaborator = await prisma.accountCollaborator.findUnique({
      where: { companyId_userId: { companyId, userId: targetUserId } },
    });

    if (!collaborator) {
      return NextResponse.json(
        { error: "Collaborator not found" },
        { status: 404 }
      );
    }

    const data: { role?: string } = {};
    if (body.role === "contributor" || body.role === "viewer") {
      data.role = body.role;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No valid updates provided" },
        { status: 400 }
      );
    }

    const updated = await prisma.accountCollaborator.update({
      where: { companyId_userId: { companyId, userId: targetUserId } },
      data,
      include: { user: { select: { id: true, email: true } } },
    });

    return NextResponse.json({
      id: updated.id,
      userId: updated.userId,
      email: updated.user.email,
      role: updated.role,
      status: updated.acceptedAt ? "accepted" : "pending",
    });
  } catch (error) {
    console.error("PATCH /api/companies/[id]/collaborators/[userId] error:", error);
    return NextResponse.json(
      { error: "Failed to update collaborator" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;

    const { id: companyId, userId: targetUserId } = await params;
    const accessResult = await requireCompanyAccess(companyId, auth.user.id, {
      allowCollaborator: false,
    });
    if ("error" in accessResult) return accessResult.error;

    const collaborator = await prisma.accountCollaborator.findUnique({
      where: { companyId_userId: { companyId, userId: targetUserId } },
    });

    if (!collaborator) {
      return NextResponse.json(
        { error: "Collaborator not found" },
        { status: 404 }
      );
    }

    await prisma.accountCollaborator.delete({
      where: { companyId_userId: { companyId, userId: targetUserId } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/companies/[id]/collaborators/[userId] error:", error);
    return NextResponse.json(
      { error: "Failed to remove collaborator" },
      { status: 500 }
    );
  }
}
