import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const findings = await prisma.savedFinding.findMany({
      where: {
        OR: [
          { prospect: { userId } },
          { company: { userId } },
        ],
      },
      orderBy: { createdAt: "desc" },
      include: {
        prospect: {
          include: {
            companyRef: { select: { id: true, name: true } },
          },
        },
        company: {
          select: { id: true, name: true },
        },
      },
    });
    return NextResponse.json(findings);
  } catch (e) {
    console.error("[findings] list error:", e);
    return NextResponse.json(
      { error: "Failed to list findings" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const body = await request.json();
    const { content, prospectId, companyId } = body as {
      content: string;
      prospectId?: string;
      companyId?: string;
    };

    if (!content?.trim()) {
      return NextResponse.json(
        { error: "content is required" },
        { status: 400 }
      );
    }

    if (prospectId) {
      const prospect = await prisma.prospect.findFirst({ where: { id: prospectId, userId } });
      if (!prospect) {
        return NextResponse.json({ error: "Prospect not found" }, { status: 404 });
      }
    }
    if (companyId) {
      const company = await prisma.company.findFirst({ where: { id: companyId, userId } });
      if (!company) {
        return NextResponse.json({ error: "Company not found" }, { status: 404 });
      }
    }

    const finding = await prisma.savedFinding.create({
      data: {
        content: content.trim(),
        prospectId: prospectId || null,
        companyId: companyId || null,
      },
      include: {
        prospect: {
          select: { id: true, firstName: true, lastName: true, company: true },
        },
        company: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(finding);
  } catch (e) {
    console.error("[findings] create error:", e);
    return NextResponse.json(
      { error: "Failed to save finding" },
      { status: 500 }
    );
  }
}
