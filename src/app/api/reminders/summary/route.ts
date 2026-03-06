import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

/** Lightweight endpoint for badge counts (sidebar, etc.) */
export async function GET() {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const now = new Date();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const [signalProspectIds, followUpProspects, scheduledPostsDue] = await Promise.all([
      prisma.prospect.findMany({
        where: {
          userId,
          signals: {
            some: {
              actedOn: false,
              dismissed: false,
              OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }],
            },
          },
        },
        select: { id: true },
      }),
      prisma.prospect.findMany({
        where: {
          userId,
          nextFollowUpAt: { lte: todayEnd, not: null },
        },
        select: { id: true },
      }),
      prisma.scheduledPost.count({
        where: {
          userId,
          status: "scheduled",
          scheduledAt: { lte: todayEnd },
        },
      }),
    ]);

    const signalIds = new Set(signalProspectIds.map((p) => p.id));
    const followUpCount = followUpProspects.filter((p) => !signalIds.has(p.id)).length;
    const queueTotal = signalProspectIds.length + followUpCount;

    return NextResponse.json({
      followUpCount,
      queueTotal,
      scheduledPostsDue,
    });
  } catch (error) {
    console.error("GET /api/reminders/summary error:", error);
    return NextResponse.json(
      { error: "Failed to fetch summary" },
      { status: 500 }
    );
  }
}
