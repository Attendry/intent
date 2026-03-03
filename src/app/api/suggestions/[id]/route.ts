import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { suggestionActionSchema, parseRequestBody } from "@/lib/validation";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const { id } = await params;
    const parsed = await parseRequestBody(request, suggestionActionSchema);
    if ("error" in parsed) return parsed.error;
    const { action } = parsed.data;

    const suggestion = await prisma.prospectSuggestion.findFirst({
      where: { id, userId },
    });
    if (!suggestion) {
      return NextResponse.json(
        { error: "Suggestion not found" },
        { status: 404 }
      );
    }

    if (action === "dismiss") {
      await prisma.prospectSuggestion.update({
        where: { id },
        data: { status: "dismissed" },
      });
      return NextResponse.json({ success: true, action: "dismissed" });
    }

    if (action === "approve") {
      const prospect = await prisma.prospect.create({
        data: {
          userId,
          firstName: suggestion.firstName,
          lastName: suggestion.lastName,
          title: suggestion.title,
          company: suggestion.company,
          linkedinUrl: suggestion.linkedinUrl,
        },
      });

      await prisma.signal.create({
        data: {
          prospectId: prospect.id,
          type: suggestion.signalType,
          summary: suggestion.reason,
          sourceUrl: suggestion.source,
          urgencyScore: 3,
          outreachAngle: `Discovered via ${suggestion.signalType}: ${suggestion.reason}`,
        },
      });

      await prisma.prospectSuggestion.update({
        where: { id },
        data: { status: "approved" },
      });

      // Trigger persona enrichment in the background
      fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/intelligence/enrich`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prospectId: prospect.id }),
        }
      ).catch(() => {});

      return NextResponse.json({
        success: true,
        action: "approved",
        prospectId: prospect.id,
      });
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'approve' or 'dismiss'." },
      { status: 400 }
    );
  } catch (error) {
    console.error("PUT /api/suggestions/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to process suggestion" },
      { status: 500 }
    );
  }
}
