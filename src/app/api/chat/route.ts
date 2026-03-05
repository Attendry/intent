import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getAIClient, getSettingsForUser } from "@/lib/ai";
import { requireAuth } from "@/lib/auth";

interface ChatContext {
  type: "prospect" | "company" | "general" | "pipeline" | "account";
  id?: string;
}

// Parse @[label](type:id) mentions from message
function parseMentions(message: string): { type: string; id: string }[] {
  const re = /@\[[^\]]*\]\((prospect|company|content):([^)]+)\)/g;
  const seen = new Set<string>();
  const out: { type: string; id: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(message)) !== null) {
    const key = `${m[1]}:${m[2]}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ type: m[1], id: m[2] });
    }
  }
  return out;
}

interface ChatMessage {
  role: "user" | "assistant" | "divider";
  content: string;
}

async function loadCompanyProfile(userId: string): Promise<string> {
  const profile = await prisma.companyProfile.findUnique({
    where: { userId },
  });
  if (!profile) return "";

  const parts: string[] = [];
  if (profile.name) parts.push(`Company: ${profile.name}`);
  if (profile.valueProposition)
    parts.push(`Value Proposition: ${profile.valueProposition}`);
  if (profile.offerings) {
    try {
      parts.push(`Offerings: ${JSON.stringify(JSON.parse(profile.offerings))}`);
    } catch {
      parts.push(`Offerings: ${profile.offerings}`);
    }
  }
  if (profile.icp) {
    try {
      parts.push(
        `Ideal Customer Profile: ${JSON.stringify(JSON.parse(profile.icp))}`
      );
    } catch {
      parts.push(`ICP: ${profile.icp}`);
    }
  }
  if (profile.competitors) {
    try {
      parts.push(
        `Competitors: ${JSON.stringify(JSON.parse(profile.competitors))}`
      );
    } catch {
      parts.push(`Competitors: ${profile.competitors}`);
    }
  }
  if (profile.differentiators) {
    try {
      parts.push(
        `Differentiators: ${JSON.parse(profile.differentiators).join(", ")}`
      );
    } catch {
      parts.push(`Differentiators: ${profile.differentiators}`);
    }
  }
  if (profile.painPointsSolved) {
    try {
      parts.push(
        `Pain Points Solved: ${JSON.parse(profile.painPointsSolved).join(", ")}`
      );
    } catch {
      parts.push(`Pain Points: ${profile.painPointsSolved}`);
    }
  }
  if (profile.fullProfile) parts.push(`\nFull Profile:\n${profile.fullProfile}`);
  return parts.join("\n");
}

async function loadVoiceExamples(userId: string): Promise<string> {
  const examples = await prisma.voiceExample.findMany({
    where: { userId },
    take: 3,
  });
  if (examples.length === 0) return "";
  return examples
    .map(
      (e, i) =>
        `Example ${i + 1}:\nOriginal: ${e.originalDraft}\nRevised: ${e.revisedDraft}`
    )
    .join("\n\n");
}

async function loadContentLibrary(userId: string): Promise<string> {
  const content = await prisma.content.findMany({
    where: { userId },
    take: 20,
    orderBy: { createdAt: "desc" },
  });
  if (content.length === 0) return "";
  return content
    .map((c) => {
      const parts = [`- "${c.title}" (${c.type})`];
      if (c.summary) parts.push(`  Summary: ${c.summary}`);
      if (c.personaFit) {
        try {
          parts.push(`  Best for: ${JSON.parse(c.personaFit).join(", ")}`);
        } catch { /* */ }
      }
      return parts.join("\n");
    })
    .join("\n");
}

async function loadProspectContext(userId: string, prospectId: string): Promise<string> {
  const prospect = await prisma.prospect.findFirst({
    where: { id: prospectId, userId },
    include: {
      signals: {
        where: { actedOn: false, dismissed: false },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      outreach: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      meetingLogs: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  if (!prospect) return "Prospect not found.";

  const parts: string[] = [];
  parts.push(`PROSPECT: ${prospect.firstName} ${prospect.lastName}`);
  if (prospect.title) parts.push(`Title: ${prospect.title}`);
  if (prospect.company) parts.push(`Company: ${prospect.company}`);
  if (prospect.industry) parts.push(`Industry: ${prospect.industry}`);
  if (prospect.roleArchetype) parts.push(`Role type: ${prospect.roleArchetype}`);
  parts.push(`Pipeline stage: ${prospect.pipelineStage || "new"}`);
  if (prospect.personaSummary)
    parts.push(`Persona: ${prospect.personaSummary}`);
  if (prospect.personaTags) {
    try {
      parts.push(`Tags: ${JSON.parse(prospect.personaTags).join(", ")}`);
    } catch { /* */ }
  }
  if (prospect.backgroundNotes)
    parts.push(`Notes: ${prospect.backgroundNotes}`);
  if (prospect.priorityTier) parts.push(`Priority: ${prospect.priorityTier}`);
  if (prospect.lastContactedAt)
    parts.push(
      `Last contacted: ${new Date(prospect.lastContactedAt).toLocaleDateString()}`
    );

  if (prospect.signals.length > 0) {
    parts.push("\nACTIVE SIGNALS:");
    for (const s of prospect.signals) {
      parts.push(
        `- [${s.type}] ${s.summary || "No summary"} (urgency: ${s.urgencyScore})${s.outreachAngle ? ` → ${s.outreachAngle}` : ""}`
      );
    }
  }

  if (prospect.outreach.length > 0) {
    parts.push("\nOUTREACH HISTORY:");
    for (const o of prospect.outreach) {
      parts.push(
        `- ${new Date(o.createdAt).toLocaleDateString()} via ${o.channel}: ${o.outcome || "no outcome"}${o.notes ? ` (${o.notes})` : ""}`
      );
    }
  }

  if (prospect.meetingLogs && prospect.meetingLogs.length > 0) {
    parts.push("\nMEETING LOGS:");
    for (const m of prospect.meetingLogs) {
      parts.push(
        `- ${new Date(m.createdAt).toLocaleDateString()}: ${m.summary || m.notes || "Meeting"}${m.suggestedStage ? ` (suggested stage: ${m.suggestedStage})` : ""}`
      );
    }
  }

  // Company context
  if (prospect.companyId) {
    const company = await prisma.company.findUnique({
      where: { id: prospect.companyId },
      include: {
        intel: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        prospects: {
          where: { id: { not: prospectId } },
          select: {
            firstName: true,
            lastName: true,
            title: true,
            signals: {
              where: { actedOn: false, dismissed: false, private: false },
              take: 3,
              select: { type: true, summary: true },
            },
          },
          take: 5,
        },
      },
    });

    if (company) {
      parts.push(`\nCOMPANY: ${company.name}`);
      if (company.industry) parts.push(`Industry: ${company.industry}`);

      if (company.battlecard) {
        try {
          const bc = JSON.parse(company.battlecard);
          parts.push(
            `\nBATTLECARD:\n${Object.entries(bc)
              .map(([k, v]) => `${k}: ${v}`)
              .join("\n")}`
          );
        } catch {
          parts.push(`\nBATTLECARD:\n${company.battlecard}`);
        }
      }

      if (company.roleBriefingCache) {
        try {
          const cache = JSON.parse(company.roleBriefingCache);
          const archetype = prospect.roleArchetype || "general";
          const briefing =
            cache[archetype] || cache["general"] || Object.values(cache)[0];
          if (briefing)
            parts.push(`\nROLE-SPECIFIC BRIEFING:\n${briefing}`);
        } catch { /* */ }
      }

      if (company.intel.length > 0) {
        parts.push("\nCOMPANY INTEL:");
        for (const i of company.intel) {
          parts.push(
            `- [${i.type}] ${i.summary}${i.actionContext ? ` → ${i.actionContext}` : ""}`
          );
        }
      }

      const colleagues = company.prospects.filter(
        (p) => p.signals.length > 0
      );
      if (colleagues.length > 0) {
        parts.push("\nCOLLEAGUES AT COMPANY:");
        for (const c of colleagues) {
          parts.push(
            `- ${c.firstName} ${c.lastName} (${c.title || "?"}): ${c.signals.map((s) => s.summary || s.type).join("; ")}`
          );
        }
      }
    }
  }

  return parts.join("\n");
}

async function loadContentContext(userId: string, contentId: string): Promise<string> {
  const content = await prisma.content.findFirst({
    where: { id: contentId, userId },
  });
  if (!content) return "Content not found.";
  const parts: string[] = [];
  parts.push(`CONTENT: "${content.title}" (${content.type})`);
  if (content.summary) parts.push(`Summary: ${content.summary}`);
  if (content.body) parts.push(`\nBody:\n${content.body.slice(0, 3000)}`);
  return parts.join("\n");
}

async function loadCompanyContext(userId: string, companyId: string): Promise<string> {
  const company = await prisma.company.findFirst({
    where: { id: companyId, userId },
    include: {
      intel: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      documents: {
        where: { status: "completed" },
        select: { title: true, type: true, fullSummary: true },
        take: 5,
      },
      prospects: {
        select: {
          firstName: true,
          lastName: true,
          title: true,
          roleArchetype: true,
          personaSummary: true,
          lastContactedAt: true,
          pipelineStage: true,
          signals: {
            where: { actedOn: false, dismissed: false },
            take: 3,
            select: { type: true, summary: true, urgencyScore: true },
          },
        },
        take: 10,
      },
    },
  });

  if (!company) return "Company not found.";

  const parts: string[] = [];
  parts.push(`COMPANY: ${company.name}`);
  if (company.industry) parts.push(`Industry: ${company.industry}`);
  if (company.size) parts.push(`Size: ${company.size}`);
  if (company.hqLocation) parts.push(`HQ: ${company.hqLocation}`);
  if (company.website) parts.push(`Website: ${company.website}`);
  if (company.notes) parts.push(`Notes: ${company.notes}`);

  if (company.battlecard) {
    try {
      const bc = JSON.parse(company.battlecard);
      parts.push(
        `\nACCOUNT BATTLECARD:\n${Object.entries(bc)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n")}`
      );
    } catch {
      parts.push(`\nBATTLECARD:\n${company.battlecard}`);
    }
  }

  if (company.intel.length > 0) {
    parts.push("\nINTELLIGENCE:");
    for (const i of company.intel) {
      parts.push(
        `- [${i.type}] ${i.summary}${i.actionContext ? ` → ${i.actionContext}` : ""}${i.date ? ` (${new Date(i.date).toLocaleDateString()})` : ""}`
      );
    }
  }

  if (company.documents.length > 0) {
    parts.push("\nDOCUMENT SUMMARIES:");
    for (const d of company.documents) {
      if (d.fullSummary)
        parts.push(`- ${d.title} (${d.type}): ${d.fullSummary}`);
    }
  }

  if (company.prospects.length > 0) {
    parts.push("\nLINKED PROSPECTS:");
    for (const p of company.prospects) {
      const signals = p.signals
        .map((s) => `[${s.type}] ${s.summary || ""}`)
        .join("; ");
      parts.push(
        `- ${p.firstName} ${p.lastName}, ${p.title || "?"} (${p.roleArchetype || "?"}) — stage: ${p.pipelineStage || "new"}${p.lastContactedAt ? ` — last contact: ${new Date(p.lastContactedAt).toLocaleDateString()}` : ""}${signals ? ` — signals: ${signals}` : ""}`
      );
    }
  }

  return parts.join("\n");
}

async function loadPipelineContext(userId: string): Promise<string> {
  const prospects = await prisma.prospect.findMany({
    where: { userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      company: true,
      pipelineStage: true,
      lastContactedAt: true,
    },
    orderBy: { lastContactedAt: "desc" },
  });

  const byStage: Record<string, number> = {};
  for (const p of prospects) {
    const stage = p.pipelineStage || "new";
    byStage[stage] = (byStage[stage] || 0) + 1;
  }

  const parts: string[] = [];
  parts.push(`PIPELINE SUMMARY: ${prospects.length} total prospects`);
  parts.push(`Counts by stage: ${JSON.stringify(byStage)}`);
  parts.push("\nPROSPECTS BY STAGE:");
  for (const p of prospects.slice(0, 30)) {
    const stage = p.pipelineStage || "new";
    parts.push(
      `- ${p.firstName} ${p.lastName} (${p.company || "?"}) — ${stage} — last contact: ${p.lastContactedAt ? new Date(p.lastContactedAt).toLocaleDateString() : "never"}`
    );
  }
  return parts.join("\n");
}

async function loadAccountContext(userId: string, companyId: string): Promise<string> {
  const base = await loadCompanyContext(userId, companyId);

  const company = await prisma.company.findFirst({
    where: { id: companyId, userId },
    include: {
      prospects: {
        include: {
          outreach: { orderBy: { createdAt: "desc" }, take: 3 },
          meetingLogs: { orderBy: { createdAt: "desc" }, take: 2 },
        },
      },
    },
  });

  if (!company) return base;

  const findings = await prisma.savedFinding.findMany({
    where: {
      OR: [
        { companyId: companyId },
        { prospect: { companyId } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const parts: string[] = [base];

  parts.push("\n\nACCOUNT-SPECIFIC (meetings & outreach):");
  for (const p of company.prospects) {
    const hasMeeting = p.meetingLogs.length > 0 || p.outreach.some((o) => o.outcome === "meeting_booked");
    if (hasMeeting) {
      const lastMeeting = p.meetingLogs[0];
      const meetingBooked = p.outreach.find((o) => o.outcome === "meeting_booked");
      parts.push(
        `- ${p.firstName} ${p.lastName}: ${lastMeeting?.summary || (meetingBooked ? "Meeting booked" : "Has outreach")}`
      );
    }
  }

  if (findings.length > 0) {
    parts.push("\nFINDINGS:");
    for (const f of findings) {
      parts.push(`- ${f.content.slice(0, 200)}${f.content.length > 200 ? "..." : ""}`);
    }
  }

  return parts.join("\n");
}

function buildSystemPrompt(
  settings: Record<string, string>,
  companyProfile: string,
  voiceExamples: string,
  contentLibrary: string,
  entityContext: string
): string {
  const userName = settings.userName || settings.senderName || "Sales Rep";
  const userTitle = settings.userTitle || settings.senderTitle || "";
  const userCompany =
    settings.userCompany || settings.senderCompany || "our company";

  return `You are a senior B2B sales advisor for ${userName}${userTitle ? `, ${userTitle}` : ""} at ${userCompany}.

${companyProfile ? `YOUR COMPANY PROFILE:\n${companyProfile}\n` : ""}
CURRENT CONTEXT:
${entityContext}

SALES METHODOLOGY:
- Objection handling: use the Acknowledge-Question-Reframe pattern.
  1. Acknowledge the concern genuinely
  2. Ask a clarifying question to understand the root cause
  3. Reframe with relevant data, case studies, or differentiators
- Call/meeting prep: structure as Objective, Key Discovery Questions, Anticipated Objections with Responses, Concrete Next Steps
- Competitive positioning: focus on differentiation and unique value, never disparage competitors
- Always end with a specific, actionable next step
- Pipeline: When discussing pipeline, reference stages (new, meeting_booked, qualified, proposal, negotiation, closed_won, closed_lost). Suggest stage moves when appropriate.
- Meetings: When prospect has meeting logs, use summaries and action items for post-call prep and next steps.
- Account: When in account context, consider buying committee coverage, pipeline stage per contact, and recommend next-best-action.

${contentLibrary ? `CONTENT LIBRARY (recommend relevant pieces when appropriate):\n${contentLibrary}\n` : ""}
LIVE RESEARCH:
You have access to Google Search. Use it to:
- Answer questions that go beyond the provided internal data
- Look up current news, market activity, regional operations, or competitor moves
- Verify or supplement internal intel with the latest information
When using live search results, clearly label them: "Based on recent reports..." or "According to [source]..." so the user knows what comes from internal data vs. web.

${voiceExamples ? `VOICE & STYLE (match this communication style):\n${voiceExamples}\n` : ""}
Be concise, specific, and actionable. Reference the actual data you have.
When you lack internal data, use Google Search to find it rather than saying you don't know.
Only say you cannot help if the question is entirely outside a sales context.
Format responses in markdown for readability. Use bullet points and bold for key takeaways.`;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const body = await request.json();
    const { message, history, context } = body as {
      message: string;
      history: ChatMessage[];
      context: ChatContext;
    };

    if (!message) {
      return new Response(
        JSON.stringify({ error: "message is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const [settings, companyProfile, voiceExamples, contentLibrary] =
      await Promise.all([
        getSettingsForUser(userId),
        loadCompanyProfile(userId),
        loadVoiceExamples(userId),
        loadContentLibrary(userId),
      ]);

    const mentions = parseMentions(message);
    const loadedIds = new Set<string>();
    const contextParts: string[] = [];

    // Page context (prospect, company, pipeline, account)
    if (context?.type === "prospect" && context.id) {
      contextParts.push(await loadProspectContext(userId, context.id));
      loadedIds.add(`prospect:${context.id}`);
    } else if (context?.type === "company" && context.id) {
      contextParts.push(await loadCompanyContext(userId, context.id));
      loadedIds.add(`company:${context.id}`);
    } else if (context?.type === "pipeline") {
      contextParts.push(await loadPipelineContext(userId));
    } else if (context?.type === "account" && context.id) {
      contextParts.push(await loadAccountContext(userId, context.id));
      loadedIds.add(`company:${context.id}`);
    }

    // @ mention context (prospects, companies, content)
    for (const { type, id } of mentions) {
      const key = `${type}:${id}`;
      if (loadedIds.has(key)) continue;
      loadedIds.add(key);
      if (type === "prospect") {
        contextParts.push("\n--- ADDITIONAL CONTEXT (from @ mention) ---\n" + (await loadProspectContext(userId, id)));
      } else if (type === "company") {
        contextParts.push("\n--- ADDITIONAL CONTEXT (from @ mention) ---\n" + (await loadCompanyContext(userId, id)));
      } else if (type === "content") {
        contextParts.push("\n--- REFERENCED CONTENT (from @ mention) ---\n" + (await loadContentContext(userId, id)));
      }
    }

    const entityContext =
      contextParts.length > 0
        ? contextParts.join("\n\n")
        : "No specific entity context. General sales assistant mode.";

    const systemPrompt = buildSystemPrompt(
      settings as Record<string, string>,
      companyProfile,
      voiceExamples,
      contentLibrary,
      entityContext
    );

    // Build conversation for Gemini
    const contents: { role: string; parts: { text: string }[] }[] = [];

    if (history && history.length > 0) {
      for (const msg of history) {
        if (msg.role === "divider") {
          contents.push({
            role: "user",
            parts: [{ text: `[Context changed: ${msg.content}]` }],
          });
          contents.push({
            role: "model",
            parts: [
              { text: "Understood, I'll use the updated context." },
            ],
          });
        } else {
          contents.push({
            role: msg.role === "user" ? "user" : "model",
            parts: [{ text: msg.content }],
          });
        }
      }
    }

    contents.push({ role: "user", parts: [{ text: message }] });

    const client = await getAIClient(userId);
    const modelName = settings.geminiModel || "gemini-2.5-flash";

    const streamResult = await client.models.generateContentStream({
      model: modelName,
      contents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
        tools: [{ googleSearch: {} }],
      },
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamResult) {
            const text = chunk.text ?? "";
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }
          controller.close();
        } catch (err) {
          console.error("[chat] stream error:", err);
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("[chat] error:", error);
    const message =
      error instanceof Error ? error.message : "Chat failed";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
