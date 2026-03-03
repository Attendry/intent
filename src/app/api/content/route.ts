import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateContentTags, getSettingsForUser } from "@/lib/ai";
import { requireAuth } from "@/lib/auth";
import { createContentSchema, parseRequestBody } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));

    const where = type ? { userId, type } : { userId };

    const [content, total] = await Promise.all([
      prisma.content.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.content.count({ where }),
    ]);

    return NextResponse.json({
      data: content,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/content error:", error);
    return NextResponse.json(
      { error: "Failed to fetch content" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const parsed = await parseRequestBody(request, createContentSchema);
    if ("error" in parsed) return parsed.error;
    const body = parsed.data;

    let summary = body.summary || null;
    let tags = body.tags ? JSON.stringify(body.tags) : null;
    let personaFit = body.personaFit ? JSON.stringify(body.personaFit) : null;
    let useCaseFit = body.useCaseFit ? JSON.stringify(body.useCaseFit) : null;

    const settings = await getSettingsForUser(userId);
    const hasApiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY;

    if (hasApiKey && !tags) {
      try {
        const generated = await generateContentTags({
          userId,
          title: body.title,
          type: body.type,
          url: body.url,
          body: body.body,
        });
        summary = summary || generated.summary;
        tags = JSON.stringify(generated.tags);
        personaFit = JSON.stringify(generated.personaFit);
        useCaseFit = JSON.stringify(generated.useCaseFit);
      } catch {
        // LLM tagging failed — save without tags
      }
    }

    const content = await prisma.content.create({
      data: {
        userId,
        title: body.title,
        type: body.type,
        stage: body.stage || null,
        url: body.url || null,
        body: body.body || null,
        summary,
        tags,
        personaFit,
        useCaseFit,
      },
    });

    return NextResponse.json(content, { status: 201 });
  } catch (error) {
    console.error("POST /api/content error:", error);
    return NextResponse.json(
      { error: "Failed to create content" },
      { status: 500 }
    );
  }
}
