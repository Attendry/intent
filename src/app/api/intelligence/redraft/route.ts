import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateRedraft, getSettingsForUser } from "@/lib/ai";
import { requireAuth } from "@/lib/auth";
import { redraftSchema, parseRequestBody } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const parsed = await parseRequestBody(request, redraftSchema);
    if ("error" in parsed) return parsed.error;
    const body = parsed.data;

    const prospectId = body.prospectId;
    const signalId = body.signalId;

    const [prospect, signal] = await Promise.all([
      prospectId
        ? prisma.prospect.findFirst({ where: { id: prospectId, userId } })
        : null,
      signalId
        ? prisma.signal.findUnique({ where: { id: signalId } })
        : null,
    ]);

    if (prospectId && !prospect) {
      return NextResponse.json({ error: "Prospect not found" }, { status: 404 });
    }
    if (signalId && !signal) {
      return NextResponse.json({ error: "Signal not found" }, { status: 404 });
    }

    const channel = body.channel || "email";
    const language = body.language || prospect?.preferredLang || "en";

    const settings = await getSettingsForUser(userId);

    const dummyProspect = prospect || {
      id: "", userId, firstName: "Unknown", lastName: "User",
      email: null, phone: null, mobilePhone: null, title: null, company: null,
      companyId: null, roleArchetype: null, industry: null,
      linkedinUrl: null, personaSummary: null, personaTags: null,
      backgroundNotes: null, zoomInfoRaw: null, priorityTier: "medium",
      starred: false, preferredLang: "en", lastContactedAt: null,
      nextFollowUpAt: null, pipelineStage: null, createdAt: new Date(), updatedAt: new Date(),
    };

    const dummySignal = signal || {
      id: "", prospectId: "", type: "other", sourceUrl: null,
      rawContent: null, summary: null, urgencyScore: 3,
      outreachAngle: null, contentSuggestionIds: null,
      private: false, actedOn: false, snoozedUntil: null, dismissed: false,
      createdAt: new Date(),
    };

    const draft = await generateRedraft({
      userId,
      originalDraft: body.originalDraft,
      instruction: body.instruction,
      prospect: dummyProspect,
      signal: dummySignal,
      channel,
      language,
      settings,
    });

    return NextResponse.json(draft);
  } catch (error) {
    console.error("POST /api/intelligence/redraft error:", error);
    const message = error instanceof Error ? error.message : "Failed to regenerate draft";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
