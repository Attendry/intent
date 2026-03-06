import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { createScheduledPostSchema, parseRequestBody } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter"); // today | week | overdue | all

    const where: { userId: string; status?: string } = { userId };

    if (filter === "overdue") {
      where.status = "scheduled";
      const posts = await prisma.scheduledPost.findMany({
        where: {
          ...where,
          scheduledAt: { lt: todayStart },
        },
        orderBy: { scheduledAt: "asc" },
      });
      return NextResponse.json({ data: posts, overdue: posts.length });
    }

    if (filter === "today") {
      const posts = await prisma.scheduledPost.findMany({
        where: {
          userId,
          status: "scheduled",
          scheduledAt: { gte: todayStart, lte: todayEnd },
        },
        orderBy: { scheduledAt: "asc" },
      });
      return NextResponse.json({ data: posts });
    }

    if (filter === "week") {
      const posts = await prisma.scheduledPost.findMany({
        where: {
          userId,
          status: "scheduled",
          scheduledAt: { gte: todayStart, lte: weekEnd },
        },
        orderBy: { scheduledAt: "asc" },
      });
      return NextResponse.json({ data: posts });
    }

    // Default: all scheduled (today + week + overdue combined for Schedule tab)
    const [overdue, today, upcoming] = await Promise.all([
      prisma.scheduledPost.findMany({
        where: {
          userId,
          status: "scheduled",
          scheduledAt: { lt: todayStart },
        },
        orderBy: { scheduledAt: "asc" },
      }),
      prisma.scheduledPost.findMany({
        where: {
          userId,
          status: "scheduled",
          scheduledAt: { gte: todayStart, lte: todayEnd },
        },
        orderBy: { scheduledAt: "asc" },
      }),
      prisma.scheduledPost.findMany({
        where: {
          userId,
          status: "scheduled",
          scheduledAt: { gt: todayEnd, lte: weekEnd },
        },
        orderBy: { scheduledAt: "asc" },
      }),
    ]);

    return NextResponse.json({
      data: [...overdue, ...today, ...upcoming],
      overdue: overdue.length,
      today: today.length,
      upcoming: upcoming.length,
    });
  } catch (error) {
    console.error("GET /api/scheduled-posts error:", error);
    return NextResponse.json(
      { error: "Failed to fetch scheduled posts" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const parsed = await parseRequestBody(request, createScheduledPostSchema);
    if ("error" in parsed) return parsed.error;
    const body = parsed.data;

    const scheduledAt = new Date(body.scheduledAt);

    const post = await prisma.scheduledPost.create({
      data: {
        userId,
        body: body.body,
        scheduledAt,
        firstComment: body.firstComment || null,
        seriesId: body.seriesId || null,
        notes: body.notes || null,
        timezone: body.timezone || "UTC",
      },
    });

    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    console.error("POST /api/scheduled-posts error:", error);
    return NextResponse.json(
      { error: "Failed to create scheduled post" },
      { status: 500 }
    );
  }
}
