import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createCompanySchema, parseRequestBody } from "@/lib/validation";
import { requireAuth, getCaptureAuth } from "@/lib/auth"; // requireAuth for POST

function normalizeCompanyName(name: string): string {
  return name
    .replace(/\b(GmbH|AG|Inc\.?|Ltd\.?|Corp\.?|SE|S\.A\.?|PLC|LLC|Co\.?|Group|Holdings?|International)\b/gi, "")
    .replace(/[.,&]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCaptureAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));

    const where = { userId, ...(search ? { name: { contains: search } } : {}) };

    const [companies, total] = await Promise.all([
      prisma.company.findMany({
        where,
        include: {
          _count: { select: { prospects: true, intel: true, documents: true } },
        },
        orderBy: { name: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.company.count({ where }),
    ]);

    return NextResponse.json({
      data: companies,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/companies error:", error);
    return NextResponse.json({ error: "Failed to fetch companies" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const { searchParams } = new URL(request.url);
    const migrate = searchParams.get("migrate") === "true";

    if (migrate) {
      const prospects = await prisma.prospect.findMany({
        where: { userId, company: { not: null }, companyId: null },
        select: { id: true, company: true, industry: true },
      });

      const groups = new Map<string, { originalNames: Map<string, number>; prospectIds: string[]; industry?: string }>();

      for (const p of prospects) {
        if (!p.company) continue;
        const normalized = normalizeCompanyName(p.company);
        if (!normalized) continue;

        let group = groups.get(normalized);
        if (!group) {
          group = { originalNames: new Map(), prospectIds: [], industry: undefined };
          groups.set(normalized, group);
        }
        group.originalNames.set(p.company, (group.originalNames.get(p.company) || 0) + 1);
        group.prospectIds.push(p.id);
        if (p.industry && !group.industry) group.industry = p.industry;
      }

      let created = 0;
      let linked = 0;
      const newCompanyIds: string[] = [];

      for (const [, group] of groups) {
        let bestName = "";
        let bestCount = 0;
        for (const [name, count] of group.originalNames) {
          if (count > bestCount) {
            bestName = name;
            bestCount = count;
          }
        }

        const existing = await prisma.company.findUnique({
          where: { userId_name: { userId, name: bestName } },
        });
        let companyId: string;

        if (existing) {
          companyId = existing.id;
        } else {
          const company = await prisma.company.create({
            data: { userId, name: bestName, industry: group.industry },
          });
          companyId = company.id;
          newCompanyIds.push(companyId);
          created++;
        }

        await prisma.prospect.updateMany({
          where: { id: { in: group.prospectIds }, userId },
          data: { companyId },
        });
        linked += group.prospectIds.length;
      }

      return NextResponse.json({ created, linked, newCompanyIds });
    }

    const parsed = await parseRequestBody(request, createCompanySchema);
    if ("error" in parsed) return parsed.error;
    const body = parsed.data;

    const company = await prisma.company.create({
      data: {
        userId,
        name: body.name,
        industry: body.industry || null,
        website: body.website || null,
        size: body.size || null,
        hqLocation: body.hqLocation || null,
        notes: body.notes || null,
      },
    });

    return NextResponse.json(company, { status: 201 });
  } catch (error) {
    console.error("POST /api/companies error:", error);
    return NextResponse.json({ error: "Failed to create company" }, { status: 500 });
  }
}
