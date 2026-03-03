import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generatePrepBriefing } from "@/lib/ai";
import { requireAuth } from "@/lib/auth";
import { prepSchema, parseRequestBody } from "@/lib/validation";

async function getCompanyContext(prospect: { companyId: string | null; roleArchetype: string | null; id: string }, userId: string) {
  if (!prospect.companyId) return null;

  const company = await prisma.company.findFirst({
    where: { id: prospect.companyId, userId },
    select: {
      name: true,
      roleBriefingCache: true,
      battlecard: true,
      prospects: {
        where: { id: { not: prospect.id } },
        select: {
          firstName: true,
          lastName: true,
          title: true,
          signals: {
            where: { actedOn: false, dismissed: false, private: false },
            orderBy: { createdAt: "desc" },
            take: 3,
            select: { type: true, summary: true },
          },
        },
        take: 5,
      },
      intel: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { type: true, summary: true, actionContext: true },
      },
    },
  });

  if (!company) return null;

  let roleBriefing = "";
  if (company.roleBriefingCache) {
    try {
      const cache = JSON.parse(company.roleBriefingCache);
      const archetype = prospect.roleArchetype || "general";
      roleBriefing = cache[archetype] || cache["general"] || Object.values(cache)[0] || "";
    } catch { /* ignore */ }
  }

  const colleagueContext = company.prospects
    .filter((p) => p.signals.length > 0)
    .map((p) => `${p.firstName} ${p.lastName} (${p.title || "Unknown"}): ${p.signals.map((s) => s.summary || s.type).join("; ")}`)
    .join("\n");

  const recentIntel = company.intel
    .map((i) => `[${i.type}] ${i.summary}${i.actionContext ? ` → ${i.actionContext}` : ""}`)
    .join("\n");

  return { companyName: company.name, roleBriefing, colleagueContext, recentIntel };
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const parsed = await parseRequestBody(request, prepSchema);
    if ("error" in parsed) return parsed.error;
    const body = parsed.data;

    const prospect = await prisma.prospect.findFirst({
      where: { id: body.prospectId, userId },
      include: {
        signals: { orderBy: { createdAt: "desc" } },
        outreach: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!prospect) {
      return NextResponse.json({ error: "Prospect not found" }, { status: 404 });
    }

    const allContent = await prisma.content.findMany({ where: { userId } });
    const prospectTags: string[] = prospect.personaTags
      ? JSON.parse(prospect.personaTags)
      : [];

    const matchingContent = allContent
      .filter((c) => {
        const cTags: string[] = c.personaFit ? JSON.parse(c.personaFit) : [];
        return prospectTags.some((t) =>
          cTags.some((ct) => ct.toLowerCase().includes(t.toLowerCase()))
        );
      })
      .slice(0, 5);

    const companyCtx = await getCompanyContext({
      companyId: prospect.companyId,
      roleArchetype: prospect.roleArchetype,
      id: prospect.id,
    }, userId);

    const briefing = await generatePrepBriefing({
      userId,
      prospect,
      signals: prospect.signals,
      outreach: prospect.outreach.map((o) => ({
        channel: o.channel,
        outcome: o.outcome,
        createdAt: o.createdAt,
      })),
      content: matchingContent,
      companyContext: companyCtx || undefined,
    });

    return NextResponse.json({ briefing });
  } catch (error) {
    console.error("POST /api/intelligence/prep error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate briefing";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
