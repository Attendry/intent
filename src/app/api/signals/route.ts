import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { createSignalSchema, parseRequestBody } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const { searchParams } = new URL(request.url);
    const prospectId = searchParams.get("prospectId");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));

    const where = prospectId
      ? { prospectId, prospect: { userId } }
      : { prospect: { userId } };

    const [signals, total] = await Promise.all([
      prisma.signal.findMany({
        where,
        include: {
          prospect: {
            select: { id: true, firstName: true, lastName: true, company: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.signal.count({ where }),
    ]);

    return NextResponse.json({
      data: signals,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/signals error:", error);
    return NextResponse.json(
      { error: "Failed to fetch signals" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const parsed = await parseRequestBody(request, createSignalSchema);
    if ("error" in parsed) return parsed.error;
    const body = parsed.data;

    const prospect = await prisma.prospect.findFirst({
      where: { id: body.prospectId, userId },
    });
    if (!prospect) {
      return NextResponse.json(
        { error: "Prospect not found" },
        { status: 404 }
      );
    }

    const signal = await prisma.signal.create({
      data: {
        prospectId: body.prospectId,
        type: body.type,
        sourceUrl: body.sourceUrl || null,
        rawContent: body.rawContent || null,
        summary: body.summary || null,
        urgencyScore: body.urgencyScore ?? 3,
        outreachAngle: body.outreachAngle || null,
        contentSuggestionIds: body.contentSuggestionIds
          ? JSON.stringify(body.contentSuggestionIds)
          : null,
        private: body.private ?? false,
      },
    });

    return NextResponse.json(signal, { status: 201 });
  } catch (error) {
    console.error("POST /api/signals error:", error);
    return NextResponse.json(
      { error: "Failed to create signal" },
      { status: 500 }
    );
  }
}
