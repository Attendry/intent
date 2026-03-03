import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { voiceExampleSchema, parseRequestBody } from "@/lib/validation";

export async function GET() {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const examples = await prisma.voiceExample.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(examples);
  } catch (error) {
    console.error("GET /api/voice-examples error:", error);
    return NextResponse.json({ error: "Failed to fetch voice examples" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const parsed = await parseRequestBody(request, voiceExampleSchema);
    if ("error" in parsed) return parsed.error;
    const { language, originalDraft, revisedDraft } = parsed.data;

    const example = await prisma.voiceExample.create({
      data: { userId, language, originalDraft: originalDraft.trim(), revisedDraft: revisedDraft.trim() },
    });
    return NextResponse.json(example, { status: 201 });
  } catch (error) {
    console.error("POST /api/voice-examples error:", error);
    return NextResponse.json({ error: "Failed to create voice example" }, { status: 500 });
  }
}
