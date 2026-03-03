import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateDraft, getSettingsForUser } from "@/lib/ai";
import { requireAuth } from "@/lib/auth";
import type { Signal } from "@prisma/client";
import { draftSchema, parseRequestBody } from "@/lib/validation";

async function getCompanyContext(prospect: { companyId: string | null; roleArchetype: string | null; id: string }, userId: string) {
  if (!prospect.companyId) return undefined;

  const company = await prisma.company.findFirst({
    where: { id: prospect.companyId, userId },
    select: {
      name: true,
      roleBriefingCache: true,
      intel: {
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { type: true, summary: true, actionContext: true },
      },
    },
  });

  if (!company) return undefined;

  let roleBriefing = "";
  if (company.roleBriefingCache) {
    try {
      const cache = JSON.parse(company.roleBriefingCache);
      const archetype = prospect.roleArchetype || "general";
      roleBriefing = cache[archetype] || cache["general"] || Object.values(cache)[0] || "";
    } catch { /* ignore */ }
  }

  const recentIntel = company.intel
    .map((i) => `[${i.type}] ${i.summary}${i.actionContext ? ` → ${i.actionContext}` : ""}`)
    .join("\n");

  return `\nAccount Context for ${company.name}:\n${roleBriefing}\n\nRecent Company Intel:\n${recentIntel || "None"}`;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const parsed = await parseRequestBody(request, draftSchema);
    if ("error" in parsed) return parsed.error;
    const body = parsed.data;

    const prospect = await prisma.prospect.findFirst({
      where: { id: body.prospectId, userId },
      include: {
        signals: {
          where: { actedOn: false, dismissed: false },
          orderBy: { urgencyScore: "desc" },
          take: 1,
        },
      },
    });

    if (!prospect) {
      return NextResponse.json({ error: "Prospect not found" }, { status: 404 });
    }

    let signal: Signal | null = null;
    if (body.signalId) {
      signal = await prisma.signal.findUnique({ where: { id: body.signalId } });
    }
    if (!signal && prospect.signals.length > 0) {
      signal = prospect.signals[0];
    }

    const companyContext = await getCompanyContext({
      companyId: prospect.companyId,
      roleArchetype: prospect.roleArchetype,
      id: prospect.id,
    }, userId);

    const signalContext: Signal = signal || {
      id: "synthetic",
      prospectId: prospect.id,
      type: "other",
      sourceUrl: null,
      rawContent: null,
      summary: prospect.personaSummary || `Outreach to ${prospect.firstName} ${prospect.lastName}`,
      urgencyScore: 2,
      outreachAngle: prospect.personaSummary
        ? "Leverage their persona profile for personalized outreach."
        : "Introduce yourself and explore mutual value.",
      contentSuggestionIds: null,
      private: false,
      actedOn: false,
      snoozedUntil: null,
      dismissed: false,
      createdAt: new Date(),
    };

    const channel = body.channel || "email";
    const language = body.language || prospect.preferredLang || "en";
    const templateUseCase = body.templateUseCase;

    const matchingContent = await findMatchingContent(prospect, signalContext, userId);

    const settings = await getSettingsForUser(userId);

    const voiceExamples = await prisma.voiceExample.findMany({
      where: { userId, language: { in: [language, "en"] } },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { originalDraft: true, revisedDraft: true },
    });

    const draft = await generateDraft({
      userId,
      prospect,
      signal: signalContext,
      content: matchingContent,
      channel,
      language,
      settings,
      companyContext,
      templateUseCase,
      voiceExamples: voiceExamples.map((v) => ({ originalDraft: v.originalDraft, revisedDraft: v.revisedDraft })),
    });

    return NextResponse.json(draft);
  } catch (error) {
    console.error("POST /api/intelligence/draft error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate draft";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function findMatchingContent(
  prospect: { personaTags?: string | null; industry?: string | null },
  signal: { contentSuggestionIds?: string | null; type: string },
  userId: string
) {
  if (signal.contentSuggestionIds) {
    try {
      const ids = JSON.parse(signal.contentSuggestionIds) as string[];
      if (ids.length > 0) {
        return prisma.content.findMany({ where: { userId, id: { in: ids } } });
      }
    } catch {}
  }

  const allContent = await prisma.content.findMany({ where: { userId } });
  const prospectTags: string[] = prospect.personaTags
    ? JSON.parse(prospect.personaTags)
    : [];

  return allContent
    .filter((c) => {
      const cTags: string[] = c.personaFit ? JSON.parse(c.personaFit) : [];
      const cUseCases: string[] = c.useCaseFit ? JSON.parse(c.useCaseFit) : [];
      const cKeywords: string[] = c.tags ? JSON.parse(c.tags) : [];

      const tagOverlap = prospectTags.some((t) =>
        cTags.some((ct) => ct.toLowerCase().includes(t.toLowerCase()))
      );
      const industryMatch = prospect.industry
        ? cKeywords.some((k) => k.toLowerCase().includes(prospect.industry!.toLowerCase()))
        : false;

      return tagOverlap || industryMatch;
    })
    .slice(0, 3);
}
