import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const { searchParams } = new URL(request.url);
    const staleOnly = searchParams.get("staleOnly") === "true";

    const profile = await prisma.companyProfile.findUnique({
      where: { userId },
    });

    if (!profile || profile.status !== "published") {
      return NextResponse.json(
        { error: "Company profile must be published first." },
        { status: 400 }
      );
    }

    const where: Record<string, unknown> = {
      userId,
      OR: [
        { intel: { some: {} } },
        { battlecard: { not: null } },
      ],
    };

    if (staleOnly && profile.profileVersionHash) {
      where.NOT = { profileVersionUsed: profile.profileVersionHash };
    }

    const companies = await prisma.company.findMany({
      where,
      select: { id: true, name: true },
    });

    const baseUrl = request.nextUrl.origin;
    let refreshed = 0;
    let failed = 0;

    const cookie = request.headers.get("cookie") || "";
    for (const company of companies) {
      try {
        const res = await fetch(`${baseUrl}/api/companies/${company.id}/fit`, {
          method: "POST",
          headers: cookie ? { Cookie: cookie } : undefined,
        });
        if (res.ok) {
          refreshed++;
        } else {
          failed++;
          console.error(
            `[fit-refresh] Failed for ${company.name}:`,
            await res.text()
          );
        }
      } catch (err) {
        failed++;
        console.error(`[fit-refresh] Error for ${company.name}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      total: companies.length,
      refreshed,
      failed,
    });
  } catch (error) {
    console.error("POST /api/fit-overview/refresh error:", error);
    return NextResponse.json(
      { error: "Failed to refresh fit scores" },
      { status: 500 }
    );
  }
}
