import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { clearAIClientCache } from "@/lib/ai";
import { requireAuth } from "@/lib/auth";

const MASKED_KEYS = ["geminiApiKey", "rapidApiKey", "gnewsApiKey", "predictHqApiKey"];

function maskKeys(data: Record<string, unknown>): Record<string, unknown> {
  const safe = { ...data };
  for (const key of MASKED_KEYS) {
    if (typeof safe[key] === "string" && (safe[key] as string).length > 11) {
      safe[key] = (safe[key] as string).slice(0, 7) + "..." + (safe[key] as string).slice(-4);
    }
  }
  return safe;
}

export async function GET() {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;

    const row = await prisma.userSettings.findUnique({
      where: { userId: auth.user.id },
    });

    if (!row) {
      return NextResponse.json({});
    }

    return NextResponse.json(maskKeys(JSON.parse(row.data)));
  } catch (error) {
    console.error("GET /api/settings error:", error);
    return NextResponse.json(
      { error: "Failed to load settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;

    const body = await request.json();

    const existing = await prisma.userSettings.findUnique({
      where: { userId: auth.user.id },
    });

    let merged = body;
    if (existing) {
      const current = JSON.parse(existing.data);
      merged = { ...current, ...body };

      for (const keyField of MASKED_KEYS) {
        if (body[keyField] && body[keyField].includes("...")) {
          merged[keyField] = current[keyField];
        }
      }
    }

    await prisma.userSettings.upsert({
      where: { userId: auth.user.id },
      create: { userId: auth.user.id, data: JSON.stringify(merged) },
      update: { data: JSON.stringify(merged) },
    });

    if (body.geminiApiKey && !body.geminiApiKey.includes("...")) {
      clearAIClientCache(auth.user.id);
    }

    return NextResponse.json(maskKeys(merged));
  } catch (error) {
    console.error("PUT /api/settings error:", error);
    return NextResponse.json(
      { error: "Failed to save settings" },
      { status: 500 }
    );
  }
}
