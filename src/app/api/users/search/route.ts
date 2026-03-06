import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

/**
 * GET /api/users/search?q=email
 * Search users by email (for share modal). Returns id and email.
 * Requires 3+ chars. Max 10 results.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim().toLowerCase();

    if (q.length < 3) {
      return NextResponse.json([]);
    }

    const users = await prisma.user.findMany({
      where: {
        email: { contains: q },
        id: { not: auth.user.id },
      },
      select: { id: true, email: true },
      take: 10,
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("GET /api/users/search error:", error);
    return NextResponse.json(
      { error: "Failed to search users" },
      { status: 500 }
    );
  }
}
