import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { requireCompanyAccess } from "@/lib/access";
import { createFragmentFromCompanyIntel } from "@/lib/fragment-sync";
import { logAccountActivity } from "@/lib/activity-log";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const accessResult = await requireCompanyAccess(id, auth.user.id, {
      allowCollaborator: true,
    });
    if ("error" in accessResult) return accessResult.error;

    const company = await prisma.company.findFirst({ where: { id } });
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const intel = await prisma.companyIntel.findMany({
      where: { companyId: id },
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { id: true, email: true } },
      },
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
    const accessResult = await requireCompanyAccess(id, auth.user.id, {
      allowCollaborator: true,
    });
    if ("error" in accessResult) return accessResult.error;

    const company = await prisma.company.findFirst({ where: { id } });
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
        createdById: auth.user.id,
      },
    });

    createFragmentFromCompanyIntel({
      id: intel.id,
      companyId: intel.companyId,
      type: intel.type,
      summary: intel.summary,
      actionContext: intel.actionContext,
      urgencyScore: intel.urgencyScore,
      date: intel.date,
    }).catch((e) => console.error("[fragment-sync] intel:", e));

    logAccountActivity(id, auth.user.id, "intel_added", "intel", intel.id).catch(
      () => {}
    );

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
          const sig = await prisma.signal.create({
            data: {
              prospectId: prospect.id,
              type: intel.type,
              summary: intel.summary,
              sourceUrl: intel.sourceUrl,
              urgencyScore: intel.urgencyScore,
              outreachAngle: intel.actionContext,
            },
          });
          const { createFragmentFromSignal } = await import("@/lib/fragment-sync");
          createFragmentFromSignal({
            id: sig.id,
            prospectId: sig.prospectId,
            type: sig.type,
            summary: sig.summary,
            rawContent: null,
            urgencyScore: sig.urgencyScore,
            actedOn: sig.actedOn,
            dismissed: sig.dismissed,
          }).catch((e) => console.error("[fragment-sync] signal:", e));
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
