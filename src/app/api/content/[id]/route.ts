import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.content.findFirst({ where: { id, userId } });
    if (!existing) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    const fields = ["title", "type", "stage", "url", "body", "summary"] as const;
    for (const field of fields) {
      if (body[field] !== undefined) data[field] = body[field];
    }
    if (body.tags !== undefined) {
      data.tags = Array.isArray(body.tags) ? JSON.stringify(body.tags) : body.tags;
    }
    if (body.personaFit !== undefined) {
      data.personaFit = Array.isArray(body.personaFit) ? JSON.stringify(body.personaFit) : body.personaFit;
    }
    if (body.useCaseFit !== undefined) {
      data.useCaseFit = Array.isArray(body.useCaseFit) ? JSON.stringify(body.useCaseFit) : body.useCaseFit;
    }

    const content = await prisma.content.update({ where: { id }, data });
    return NextResponse.json(content);
  } catch (error) {
    console.error("PUT /api/content/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update content" },
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

    const existing = await prisma.content.findFirst({ where: { id, userId } });
    if (!existing) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    await prisma.content.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/content/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete content" },
      { status: 500 }
    );
  }
}
