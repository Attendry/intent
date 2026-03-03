import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { createIntelSchema, parseRequestBody } from "@/lib/validation";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const { id } = await params;
    const company = await prisma.company.findFirst({ where: { id, userId } });
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const intel = await prisma.companyIntel.findMany({
      where: { companyId: id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(intel);
  } catch (error) {
    console.error("GET /api/companies/[id]/intel error:", error);
    return NextResponse.json({ error: "Failed to fetch intel" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const { id } = await params;
    const company = await prisma.company.findFirst({ where: { id, userId } });
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const body = await request.json();

    if (!body.type || !body.summary) {
      return NextResponse.json({ error: "type and summary are required" }, { status: 400 });
    }

    const intel = await prisma.companyIntel.create({
      data: {
        companyId: id,
        documentId: body.documentId || null,
        type: body.type,
        summary: body.summary,
        sourceRef: body.sourceRef || null,
        sourceQuote: body.sourceQuote || null,
        sourceUrl: body.sourceUrl || null,
        date: body.date ? new Date(body.date) : null,
        urgencyScore: body.urgencyScore ?? 3,
        actionContext: body.actionContext || null,
      },
    });

    await prisma.company.update({
      where: { id },
      data: { intelCountSinceSynth: { increment: 1 } },
    });

    // Auto-create prospect signals for high-urgency intel
    if (intel.urgencyScore >= 4) {
      const prospects = await prisma.prospect.findMany({
        where: { companyId: id },
        select: { id: true },
      });

      for (const prospect of prospects) {
        const existing = await prisma.signal.findFirst({
          where: {
            prospectId: prospect.id,
            summary: intel.summary,
            actedOn: false,
            dismissed: false,
          },
        });
        if (!existing) {
          await prisma.signal.create({
            data: {
              prospectId: prospect.id,
              type: intel.type,
              summary: intel.summary,
              sourceUrl: intel.sourceUrl,
              urgencyScore: intel.urgencyScore,
              outreachAngle: intel.actionContext,
            },
          });
        }
      }
    }

    // Check if synthesis should be triggered
    const companyForSynth = await prisma.company.findUnique({
      where: { id },
      select: { intelCountSinceSynth: true },
    });

    const shouldSynthesize = companyForSynth && companyForSynth.intelCountSinceSynth >= 3;

    if (shouldSynthesize) {
      const baseUrl = request.nextUrl.origin;
      fetch(`${baseUrl}/api/companies/${id}/synthesize`, { method: "POST" }).catch(() => {});
    }

    return NextResponse.json(intel, { status: 201 });
  } catch (error) {
    console.error("POST /api/companies/[id]/intel error:", error);
    return NextResponse.json({ error: "Failed to create intel" }, { status: 500 });
  }
}
