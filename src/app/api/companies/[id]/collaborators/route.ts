import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { requireCompanyAccess } from "@/lib/access";
import { logAccountActivity } from "@/lib/activity-log";

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

    const collaborators = await prisma.accountCollaborator.findMany({
      where: { companyId },
      include: {
        user: { select: { id: true, email: true } },
        inviter: { select: { id: true, email: true } },
      },
      orderBy: { invitedAt: "desc" },
    });

    return NextResponse.json(
      collaborators.map((c) => ({
        id: c.id,
        userId: c.userId,
        email: c.user.email,
        role: c.role,
        invitedBy: c.inviter.email,
        invitedAt: c.invitedAt,
        acceptedAt: c.acceptedAt,
        status: c.acceptedAt ? "accepted" : "pending",
      }))
    );
  } catch (error) {
    console.error("GET /api/companies/[id]/collaborators error:", error);
    return NextResponse.json(
      { error: "Failed to fetch collaborators" },
      { status: 500 }
    );
  }
}

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
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : null;

    if (!email) {
      return NextResponse.json(
        { error: "email is required" },
        { status: 400 }
      );
    }

    const invitee = await prisma.user.findUnique({
      where: { email },
    });

    if (!invitee) {
      return NextResponse.json(
        { error: "User not found. They need to sign up first." },
        { status: 404 }
      );
    }

    if (invitee.id === auth.user.id) {
      return NextResponse.json(
        { error: "You cannot invite yourself" },
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

    if (company.userId === invitee.id) {
      return NextResponse.json(
        { error: "User is already the account owner" },
        { status: 400 }
      );
    }

    const existing = await prisma.accountCollaborator.findUnique({
      where: { companyId_userId: { companyId, userId: invitee.id } },
    });

    if (existing) {
      if (existing.acceptedAt) {
        return NextResponse.json(
          { error: "User is already a collaborator" },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Invite already pending" },
        { status: 400 }
      );
    }

    const collaborator = await prisma.accountCollaborator.create({
      data: {
        companyId,
        userId: invitee.id,
        invitedBy: auth.user.id,
        role: body.role === "contributor" ? "contributor" : "viewer",
      },
      include: {
        user: { select: { id: true, email: true } },
      },
    });

    logAccountActivity(
      companyId,
      auth.user.id,
      "collaborator_added",
      "collaborator",
      invitee.id
    ).catch(() => {});

    return NextResponse.json(
      {
        id: collaborator.id,
        userId: collaborator.userId,
        email: collaborator.user.email,
        role: collaborator.role,
        status: "pending",
        invitedAt: collaborator.invitedAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/companies/[id]/collaborators error:", error);
    return NextResponse.json(
      { error: "Failed to invite collaborator" },
      { status: 500 }
    );
  }
}
