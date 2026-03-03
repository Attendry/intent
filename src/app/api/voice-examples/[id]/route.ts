import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const { id } = await params;
    const existing = await prisma.voiceExample.findFirst({ where: { id, userId } });
    if (!existing) {
      return NextResponse.json({ error: "Voice example not found" }, { status: 404 });
    }
    await prisma.voiceExample.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/voice-examples/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete voice example" }, { status: 500 });
  }
}
