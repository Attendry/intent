import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { getCaptureAuth, requireAuth } from "@/lib/auth";
import { createProspectSchema, parseRequestBody } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const user = await getCaptureAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    const filter = searchParams.get("filter") || "all";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
    const skip = (page - 1) * limit;

    const where: Prisma.ProspectWhereInput = { userId };

    if (q) {
      where.OR = [
        { firstName: { contains: q } },
        { lastName: { contains: q } },
        { company: { contains: q } },
        { email: { contains: q } },
        { title: { contains: q } },
      ];
    }

    if (filter === "starred") {
      where.starred = true;
    } else if (filter === "has_signals") {
      where.signals = { some: { actedOn: false, dismissed: false } };
    } else if (filter === "overdue") {
      where.nextFollowUpAt = { lte: new Date() };
    }

    const [prospects, total] = await Promise.all([
      prisma.prospect.findMany({
        where,
        include: {
          signals: {
            where: { actedOn: false, dismissed: false },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.prospect.count({ where }),
    ]);

    const data = prospects.map((p) => {
      const activeSignals = p.signals.filter(
        (s) => !s.snoozedUntil || new Date(s.snoozedUntil) <= new Date()
      );
      return {
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        email: p.email,
        title: p.title,
        company: p.company,
        starred: p.starred,
        lastContactedAt: p.lastContactedAt ? p.lastContactedAt.toISOString() : null,
        _signalCount: activeSignals.length,
        _latestSignalUrgency: activeSignals.length > 0
          ? Math.max(...activeSignals.map((s) => s.urgencyScore))
          : null,
      };
    });

    return NextResponse.json({
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/prospects error:", error);
    return NextResponse.json(
      { error: "Failed to fetch prospects" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;

    const parsed = await parseRequestBody(request, createProspectSchema);
    if ("error" in parsed) return parsed.error;
    const body = parsed.data;

    const prospect = await prisma.prospect.create({
      data: {
        userId: auth.user.id,
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email || null,
        phone: body.phone || null,
        mobilePhone: body.mobilePhone || null,
        title: body.title || null,
        company: body.company || null,
        industry: body.industry || null,
        linkedinUrl: body.linkedinUrl || null,
        personaSummary: body.personaSummary || null,
        personaTags: body.personaTags ? JSON.stringify(body.personaTags) : null,
        backgroundNotes: body.backgroundNotes || null,
        priorityTier: body.priorityTier || "medium",
        starred: body.starred || false,
        preferredLang: body.preferredLang || "en",
      },
    });

    return NextResponse.json(prospect, { status: 201 });
  } catch (error) {
    console.error("POST /api/prospects error:", error);
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "A prospect with this email already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create prospect" },
      { status: 500 }
    );
  }
}
