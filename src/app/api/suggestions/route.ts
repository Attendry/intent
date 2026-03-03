import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "pending";

    const suggestions = await prisma.prospectSuggestion.findMany({
      where: { userId, status },
      orderBy: { createdAt: "desc" },
    });

    const pendingCount = await prisma.prospectSuggestion.count({
      where: { userId, status: "pending" },
    });

    return NextResponse.json({ suggestions, pendingCount });
  } catch (error) {
    console.error("GET /api/suggestions error:", error);
    return NextResponse.json(
      { error: "Failed to fetch suggestions" },
      { status: 500 }
    );
  }
}
