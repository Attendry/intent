import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const prospect = await prisma.prospect.findUnique({
      where: { id },
      include: {
        signals: { orderBy: { createdAt: "desc" } },
        outreach: { orderBy: { createdAt: "desc" } },
        meetingLogs: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!prospect) {
      return NextResponse.json({ error: "Prospect not found" }, { status: 404 });
    }

    return NextResponse.json(prospect);
  } catch (error) {
    console.error("GET /api/prospects/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch prospect" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.prospect.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Prospect not found" }, { status: 404 });
    }

    const allowedFields = [
      "firstName", "lastName", "email", "phone", "mobilePhone", "title", "company",
      "companyId", "roleArchetype", "industry", "linkedinUrl", "personaSummary", "personaTags",
      "backgroundNotes", "priorityTier", "starred", "preferredLang",
      "lastContactedAt", "nextFollowUpAt", "pipelineStage",
    ] as const;

    const data: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === "personaTags" && Array.isArray(body[field])) {
          data[field] = JSON.stringify(body[field]);
        } else if ((field === "lastContactedAt" || field === "nextFollowUpAt") && body[field]) {
          data[field] = new Date(body[field]);
        } else {
          data[field] = body[field];
        }
      }
    }

    const prospect = await prisma.prospect.update({ where: { id }, data });
    return NextResponse.json(prospect);
  } catch (error) {
    console.error("PUT /api/prospects/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update prospect" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.prospect.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Prospect not found" }, { status: 404 });
    }

    await prisma.prospect.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/prospects/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete prospect" },
      { status: 500 }
    );
  }
}
