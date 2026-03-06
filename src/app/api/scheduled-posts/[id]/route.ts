import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { updateScheduledPostSchema, parseRequestBody } from "@/lib/validation";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;
    const { id } = await params;

    const post = await prisma.scheduledPost.findFirst({
      where: { id, userId },
    });
    if (!post) {
      return NextResponse.json({ error: "Scheduled post not found" }, { status: 404 });
    }

    const parsed = await parseRequestBody(request, updateScheduledPostSchema);
    if ("error" in parsed) return parsed.error;
    const body = parsed.data;

    const updateData: { status?: string; postedAt?: Date; prospectIds?: string } = {};

    if (body.status === "posted") {
      updateData.status = "posted";
      updateData.postedAt = new Date();
    } else if (body.status === "cancelled") {
      updateData.status = "cancelled";
    }

    if (body.prospectIds !== undefined) {
      updateData.prospectIds = JSON.stringify(body.prospectIds);
    }

    const updated = await prisma.scheduledPost.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/scheduled-posts/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update scheduled post" },
      { status: 500 }
    );
  }
}
