import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

const include = {
  prospect: {
    include: {
      companyRef: { select: { id: true, name: true } },
    },
  },
  company: {
    select: { id: true, name: true },
  },
  createdBy: { select: { id: true, email: true } },
  shares: {
    select: { shareType: true, sharedWithId: true, sharedBy: { select: { email: true } } },
  },
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const { id } = await params;
    const body = await request.json();
    const { prospectId, companyId } = body as {
      prospectId?: string | null;
      companyId?: string | null;
    };

    const existing = await prisma.savedFinding.findFirst({
      where: {
        id,
        OR: [
          { prospect: { userId } },
          { company: { userId } },
        ],
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Finding not found" }, { status: 404 });
    }

    const data: { prospectId?: string | null; companyId?: string | null } = {};
    if (prospectId !== undefined) data.prospectId = prospectId || null;
    if (companyId !== undefined) data.companyId = companyId || null;

    const finding = await prisma.savedFinding.update({
      where: { id },
      data,
      include,
    });

    return NextResponse.json(finding);
  } catch (e) {
    console.error("[findings] update error:", e);
    return NextResponse.json(
      { error: "Failed to update finding" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const { id } = await params;

    const existing = await prisma.savedFinding.findFirst({
      where: {
        id,
        OR: [
          { prospect: { userId } },
          { company: { userId } },
        ],
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Finding not found" }, { status: 404 });
    }

    await prisma.savedFinding.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[findings] delete error:", e);
    return NextResponse.json(
      { error: "Failed to delete finding" },
      { status: 500 }
    );
  }
}
