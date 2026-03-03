import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const body = await request.json();
    const { sourceId, targetId } = body;

    if (!sourceId || !targetId) {
      return NextResponse.json({ error: "sourceId and targetId are required" }, { status: 400 });
    }

    if (sourceId === targetId) {
      return NextResponse.json({ error: "Cannot merge a company with itself" }, { status: 400 });
    }

    const [source, target] = await Promise.all([
      prisma.company.findFirst({ where: { id: sourceId, userId } }),
      prisma.company.findFirst({ where: { id: targetId, userId } }),
    ]);

    if (!source || !target) {
      return NextResponse.json({ error: "Source or target company not found" }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.prospect.updateMany({
        where: { companyId: sourceId },
        data: { companyId: targetId },
      }),
      prisma.companyIntel.updateMany({
        where: { companyId: sourceId },
        data: { companyId: targetId },
      }),
      prisma.companyDocument.updateMany({
        where: { companyId: sourceId },
        data: { companyId: targetId },
      }),
      prisma.company.delete({ where: { id: sourceId } }),
    ]);

    return NextResponse.json({ success: true, targetId });
  } catch (error) {
    console.error("POST /api/companies/merge error:", error);
    return NextResponse.json({ error: "Failed to merge companies" }, { status: 500 });
  }
}
