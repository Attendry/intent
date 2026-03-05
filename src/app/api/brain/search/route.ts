import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

/**
 * Fragment search: keyword + filters.
 * POST /api/brain/search
 * Body: { q?: string, companyId?: string, prospectId?: string, type?: string, limit?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const body = await request.json().catch(() => ({}));
    const {
      q = "",
      companyId,
      prospectId,
      type,
      limit = 20,
    } = body as {
      q?: string;
      companyId?: string;
      prospectId?: string;
      type?: string;
      limit?: number;
    };

    const take = Math.min(50, Math.max(1, limit));

    const where: {
      userId: string;
      status: string;
      companyId?: string;
      prospectId?: string;
      type?: string;
      content?: { contains: string; mode: "insensitive" };
    } = {
      userId,
      status: "active",
    };

    if (companyId) where.companyId = companyId;
    if (prospectId) where.prospectId = prospectId;
    if (type) where.type = type;

    if (q && q.trim().length >= 2) {
      where.content = { contains: q.trim(), mode: "insensitive" };
    }

    const fragments = await prisma.knowledgeFragment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      include: {
        company: { select: { id: true, name: true } },
        prospect: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            company: true,
          },
        },
      },
    });

    const results = fragments.map((f) => ({
      id: f.id,
      type: f.type,
      content: f.content,
      metadata: f.metadata ? (JSON.parse(f.metadata) as Record<string, unknown>) : {},
      companyId: f.companyId,
      company: f.company,
      prospectId: f.prospectId,
      prospect: f.prospect,
      createdAt: f.createdAt,
      sourceId: f.sourceId,
    }));

    return NextResponse.json({ results });
  } catch (error) {
    console.error("[brain/search] error:", error);
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}
