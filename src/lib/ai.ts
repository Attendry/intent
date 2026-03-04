import { GoogleGenAI } from "@google/genai";
import { prisma } from "@/lib/db";
import type { Prospect, Signal, Content } from "@/generated/prisma/client";

const cachedClients = new Map<string, GoogleGenAI>();

interface SettingsData {
  geminiApiKey?: string;
  geminiModel?: string;
  defaultLanguage?: string;
  senderName?: string;
  senderTitle?: string;
  senderCompany?: string;
  userName?: string;
  userTitle?: string;
  userCompany?: string;
  staleProspectDays?: number;
  [key: string]: unknown;
}

export async function getSettingsForUser(userId: string): Promise<SettingsData> {
  const row = await prisma.userSettings.findUnique({ where: { userId } });
  if (!row) return {};
  return JSON.parse(row.data) as SettingsData;
}

export const GEMINI_NOT_CONFIGURED_MSG =
  "Gemini API key not configured. Set GEMINI_API_KEY in Vercel or add your key in Settings → API Keys.";

export async function isGeminiConfigured(userId: string): Promise<boolean> {
  if (process.env.GEMINI_API_KEY) return true;
  const settings = await getSettingsForUser(userId);
  return !!settings.geminiApiKey;
}

export async function getAIClient(userId: string): Promise<GoogleGenAI> {
  const cached = cachedClients.get(userId);
  if (cached) return cached;
  const settings = await getSettingsForUser(userId);
  // Prefer env var (Vercel) over user-stored key for security
  const apiKey = process.env.GEMINI_API_KEY || settings.geminiApiKey;
  if (!apiKey) throw new Error(GEMINI_NOT_CONFIGURED_MSG);
  const client = new GoogleGenAI({ apiKey });
  cachedClients.set(userId, client);
  return client;
}

export function clearAIClientCache(userId?: string) {
  if (userId) cachedClients.delete(userId);
  else cachedClients.clear();
}

async function generate(opts: {
  userId: string;
  system: string;
  prompt: string;
  json?: boolean;
  temperature?: number;
  model?: string;
}): Promise<string> {
  const client = await getAIClient(opts.userId);
  const settings = await getSettingsForUser(opts.userId);
  const modelName = opts.model || settings.geminiModel || "gemini-2.5-flash";

  const response = await client.models.generateContent({
    model: modelName,
    contents: opts.prompt,
    config: {
      systemInstruction: opts.system,
      temperature: opts.temperature ?? 0.7,
      responseMimeType: opts.json ? "application/json" : undefined,
    },
  });

  if (response.text == null) {
    throw new Error("AI returned empty response — the request may have been filtered or timed out.");
  }
  return response.text;
}

const BANNED_PHRASES = [
  "I hope this email finds you well",
  "Just checking in",
  "Touching base",
  "Per my last email",
  "To whom it may concern",
  "I wanted to reach out",
  "Let's circle back",
  "Synergy",
  "Low-hanging fruit",
  "Move the needle",
  "Take this offline",
  "Loop you in",
  "Thought leader",
  "Best-in-class",
  "Leverage",
  "Paradigm shift",
  "Actionable insights",
  "At the end of the day",
  "Win-win",
  "Game-changer",
];

const DRAFTING_PHILOSOPHY = `You are a senior sales outreach writer. Your messages must be:
- Concise and value-driven (under 150 words for emails, under 300 chars for LinkedIn)
- Personalized using the prospect's real context and the signal that triggered outreach
- Written in a natural, conversational tone — not corporate jargon
- Focused on the prospect's pain or opportunity, not the sender's product
- Including a soft, low-friction CTA (e.g., "Would it make sense to explore…?")
- Reference specific content/resources only when truly relevant

BANNED PHRASES (never use these):
${BANNED_PHRASES.map((p) => `- "${p}"`).join("\n")}

IMPORTANT: Do NOT open with flattery or generic compliments. Lead with the signal or insight.`;

const GERMAN_INSTRUCTIONS = `
When writing in German:
- Use formal "Sie" address unless the prospect's LinkedIn indicates "Du" culture
- Keep the tone professional yet warm — typical for DACH business culture
- Adapt idioms naturally, do not translate English expressions literally
- Use proper German business greeting formats (e.g., "Sehr geehrte/r…" for formal, "Hallo [Name]," for semi-formal)`;

interface DraftParams {
  userId: string;
  prospect: Prospect;
  signal: Signal;
  content: Content[];
  channel: string;
  language: string;
  settings: SettingsData;
  companyContext?: string;
  templateUseCase?: string;
  voiceExamples?: { originalDraft: string; revisedDraft: string }[];
}

const TEMPLATE_GUIDANCE: Record<string, string> = {
  intro: "First-touch introduction. Be concise, lead with value or insight, soft CTA.",
  follow_up_1: "First follow-up. Reference prior outreach briefly, add new angle or content.",
  follow_up_2: "Second follow-up. Different angle, keep it short. Consider adding social proof.",
  follow_up_3: "Third follow-up. Last touch before break. Offer clear next step or break.",
  re_engagement: "Re-engagement after long gap. Acknowledge time passed, share fresh insight or update.",
  post_meeting: "Post-meeting follow-up. Recap key points, next steps, thank them.",
  event_based: "Tied to a specific event, news, or signal. Lead with the trigger.",
};

export async function generateDraft(params: DraftParams): Promise<{ subject: string; body: string }> {
  const { userId, prospect, signal, content, channel, language, settings, companyContext, templateUseCase, voiceExamples } = params;

  const contentContext = content.length
    ? `\nAvailable content to reference:\n${content.map((c) => `- "${c.title}" (${c.type}): ${c.summary || c.url || ""}`).join("\n")}`
    : "";

  const langInstructions = language === "de" ? GERMAN_INSTRUCTIONS : "";

  const senderName = settings.senderName || settings.userName || "the user";
  const senderTitle = settings.senderTitle || settings.userTitle || "Sales";
  const senderCompany = settings.senderCompany || settings.userCompany || "our company";

  const templateGuidance = templateUseCase && templateUseCase !== "auto" && TEMPLATE_GUIDANCE[templateUseCase]
    ? `\nUse case: ${templateUseCase.replace(/_/g, " ")}. ${TEMPLATE_GUIDANCE[templateUseCase]}`
    : "";

  const voiceContext = voiceExamples && voiceExamples.length > 0
    ? `\nMatch this writing style (before → after examples):\n${voiceExamples.map((v) => `Before: ${v.originalDraft}\nAfter: ${v.revisedDraft}`).join("\n\n")}`
    : "";

  const system = `${DRAFTING_PHILOSOPHY}${langInstructions}

You are writing on behalf of ${senderName}, ${senderTitle} at ${senderCompany}.

Channel: ${channel}
Language: ${language === "de" ? "German" : "English"}${templateGuidance}${voiceContext}

Respond in JSON format: { "subject": "...", "body": "..." }
For LinkedIn messages, set subject to an empty string.`;

  const prompt = `Write a ${channel} outreach message for this prospect:

Name: ${prospect.firstName} ${prospect.lastName}
Title: ${prospect.title || "N/A"}
Company: ${prospect.company || "N/A"}
Industry: ${prospect.industry || "N/A"}
Persona: ${prospect.personaSummary || "No summary available"}

Triggered by this signal:
Type: ${signal.type}
Summary: ${signal.summary || signal.rawContent || "N/A"}
Outreach angle: ${signal.outreachAngle || "N/A"}
${contentContext}${companyContext || ""}`;

  const text = await generate({ userId, system, prompt, json: true });
  try {
    const parsed = JSON.parse(text) as { subject?: string; body?: string };
    return { subject: parsed.subject || "", body: parsed.body || "" };
  } catch {
    return { subject: "", body: text };
  }
}

interface RedraftParams {
  userId: string;
  originalDraft: { subject: string; body: string };
  instruction: string;
  prospect: Prospect;
  signal: Signal;
  channel: string;
  language: string;
  settings: SettingsData;
}

export async function generateRedraft(params: RedraftParams): Promise<{ subject: string; body: string }> {
  const { userId, originalDraft, instruction, prospect, signal, channel, language } = params;
  const langInstructions = language === "de" ? GERMAN_INSTRUCTIONS : "";

  const system = `${DRAFTING_PHILOSOPHY}${langInstructions}

You are revising a ${channel} outreach draft. Apply the user's revision instructions while maintaining quality.
Language: ${language === "de" ? "German" : "English"}

Context — Prospect: ${prospect.firstName} ${prospect.lastName}, ${prospect.title} at ${prospect.company}
Signal: ${signal.summary || signal.rawContent || "N/A"}

Respond in JSON format: { "subject": "...", "body": "..." }`;

  const prompt = `Original draft:
Subject: ${originalDraft.subject}
Body: ${originalDraft.body}

Revision instruction: ${instruction}`;

  const text = await generate({ userId, system, prompt, json: true });
  try {
    const parsed = JSON.parse(text) as { subject?: string; body?: string };
    return { subject: parsed.subject || "", body: parsed.body || "" };
  } catch {
    return { subject: "", body: text };
  }
}

interface PersonaSummaryParams {
  userId: string;
  firstName: string;
  lastName: string;
  title: string;
  company: string;
  industry: string;
}

export async function generatePersonaSummary(params: PersonaSummaryParams): Promise<{ summary: string; roleArchetype: string }> {
  const system = `You are a B2B sales intelligence analyst. Given a prospect's professional details:

1. Write a 2-3 sentence persona summary that captures their likely priorities, pain points, messaging angles, and communication style.
2. Classify their role into exactly one archetype: finance, technology, legal, operations, executive, or general.

Respond in JSON: { "summary": "...", "roleArchetype": "..." }

Be specific and actionable. Avoid generic statements.`;

  const prompt = `Prospect: ${params.firstName} ${params.lastName}
Title: ${params.title || "Unknown"}
Company: ${params.company || "Unknown"}
Industry: ${params.industry || "Unknown"}`;

  const text = await generate({ userId: params.userId, system, prompt, json: true, temperature: 0.5 });
  try {
    const parsed = JSON.parse(text) as { summary?: string; roleArchetype?: string };
    return {
      summary: parsed.summary || text,
      roleArchetype: parsed.roleArchetype || "general",
    };
  } catch {
    return { summary: text, roleArchetype: "general" };
  }
}

interface PrepBriefingParams {
  userId: string;
  prospect: Prospect;
  signals: Signal[];
  outreach: { channel: string; outcome: string; createdAt: Date }[];
  content: Content[];
  companyContext?: {
    companyName: string;
    roleBriefing: string;
    colleagueContext: string;
    recentIntel: string;
  };
}

export interface StructuredPrepBriefing {
  opening: string;
  discoveryQuestions: string[];
  objectionPrep: string;
  cta: string;
  raw?: string;
}

export async function generatePrepBriefing(params: PrepBriefingParams): Promise<string> {
  const { userId, prospect, signals, outreach, content, companyContext } = params;

  const signalSummary = signals
    .slice(0, 5)
    .map((s) => `- [${s.type}] ${s.summary || s.rawContent || "N/A"} (urgency: ${s.urgencyScore}/5)`)
    .join("\n");

  const outreachHistory = outreach
    .slice(0, 5)
    .map((o) => `- ${o.channel} on ${o.createdAt.toISOString().split("T")[0]}: ${o.outcome}`)
    .join("\n");

  const contentList = content
    .slice(0, 3)
    .map((c) => `- "${c.title}" (${c.type})`)
    .join("\n");

  const system = `You are a sales prep assistant. Given prospect data, recent signals, outreach history, and available content, produce a STRUCTURED call/meeting prep briefing.

Respond in JSON format with these exact keys:
- "opening": 2-3 sentences for how to open the call — reference a signal or recent context
- "discoveryQuestions": array of 4-6 specific questions to uncover their priorities, pain points, and timeline. Tailor to their persona/role
- "objectionPrep": 2-3 paragraphs on likely objections (price, timing, competitor, authority) and how to handle each
- "cta": Clear call-to-action — what you want to achieve by end of call (e.g. next meeting, demo, intro to champion)

Be specific and actionable. Use their persona and company context.`;

  const prompt = `Prospect: ${prospect.firstName} ${prospect.lastName}
Title: ${prospect.title || "N/A"}, Company: ${prospect.company || "N/A"}
Industry: ${prospect.industry || "N/A"}
Persona: ${prospect.personaSummary || "No summary"}

Recent Signals:
${signalSummary || "None"}

Outreach History:
${outreachHistory || "No prior outreach"}

Available Content:
${contentList || "None"}${
  companyContext
    ? `\n\nAccount Context (${companyContext.companyName}):\n${companyContext.roleBriefing || "No role briefing available."}\n\nRecent Company Intel:\n${companyContext.recentIntel || "None"}\n\nColleague Activity:\n${companyContext.colleagueContext || "None"}`
    : ""
}`;

  const result = await generate({ userId, system, prompt, json: true, temperature: 0.5 });
  try {
    const parsed = JSON.parse(result) as Partial<StructuredPrepBriefing>;
    if (parsed.opening && Array.isArray(parsed.discoveryQuestions) && parsed.objectionPrep && parsed.cta) {
      return formatStructuredPrep(parsed as StructuredPrepBriefing);
    }
  } catch {
    /* fall through to raw */
  }
  return result;
}

function formatStructuredPrep(p: StructuredPrepBriefing): string {
  const parts: string[] = [];
  parts.push(`## Opening\n${p.opening}`);
  parts.push(`## Discovery Questions\n${p.discoveryQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`);
  parts.push(`## Objection Prep\n${p.objectionPrep}`);
  parts.push(`## Call-to-Action\n${p.cta}`);
  return parts.join("\n\n");
}

interface DocumentIntelEntry {
  type: string;
  summary: string;
  sourceRef?: string;
  sourceQuote?: string;
  date?: string;
  urgencyScore?: number;
}

interface DocumentIntelResult {
  fullSummary: string;
  entries: DocumentIntelEntry[];
}

export async function extractDocumentIntel(
  userId: string,
  text: string,
  companyName: string,
  docType: string
): Promise<DocumentIntelResult> {
  const system = `You are a B2B sales intelligence analyst. Extract structured intelligence from a company document.

For each distinct piece of actionable intelligence, create an entry with:
- type: one of company_news, conference, funding, partnership, hiring, leadership_change, earnings, strategy, risk, competitor, other
- Use "competitor" when the document mentions a competitor, competitive landscape, or displacement opportunity
- summary: 1-2 sentence description of the finding
- sourceRef: page number or section name where this was found (e.g. "Page 42" or "Financial Highlights")
- sourceQuote: a short verbatim excerpt (1-2 sentences) copied exactly from the document that supports this finding. This will be used to locate and highlight the passage in the PDF viewer.
- date: ISO date string if a date is mentioned (YYYY-MM-DD)
- urgencyScore: 1-5 rating of how time-sensitive/important this is for a sales team

Also provide a fullSummary: 3-5 sentence executive summary of the entire document.

Focus on information useful for B2B sales: financial performance, strategic initiatives, leadership changes, risks, market positioning, partnerships.

Respond in JSON: { "fullSummary": "...", "entries": [...] }`;

  const prompt = `Company: ${companyName}
Document type: ${docType}

Document text (may be truncated):
${text.slice(0, 80000)}`;

  const result = await generate({ userId, system, prompt, json: true, temperature: 0.3 });
  try {
    const parsed = JSON.parse(result) as Partial<DocumentIntelResult>;
    return {
      fullSummary: parsed.fullSummary || "No summary generated.",
      entries: parsed.entries || [],
    };
  } catch {
    return { fullSummary: "No summary generated.", entries: [] };
  }
}

interface AccountSynthesisInput {
  userId: string;
  companyName: string;
  industry?: string;
  intel: { id: string; type: string; summary: string; date?: string }[];
  documentSummaries: string[];
  prospects: {
    name: string;
    title?: string;
    roleArchetype?: string;
    personaSummary?: string;
    recentSignals: string[];
  }[];
}

interface AccountSynthesisResult {
  battlecard: Record<string, string>;
  actionContexts: Record<string, string>;
  roleBriefings: Record<string, string>;
}

export async function generateAccountSynthesis(
  input: AccountSynthesisInput
): Promise<AccountSynthesisResult> {
  const system = `You are a senior B2B sales strategist. Given all available intelligence about a company, produce a comprehensive account synthesis.

Output JSON with three sections:

1. "battlecard": An object with these STRUCTURED keys (use all). Each value MUST be a plain string (no arrays or nested objects):
   - "keyContacts": Plain string listing known contacts with names, titles, and influence (e.g. "John Doe (VP Sales): key influencer...")
   - "painPoints": Their likely pain points based on intel
   - "competitiveSituation": Competitor mentions, incumbent vendors, displacement angles
   - "recentIntel": Summary of most recent/relevant intel
   - "nextSteps": Recommended next steps for this account
   - "companySnapshot": 2-3 sentences about the company
   - "strategicPriorities": Key business priorities
   - "risksAndChallenges": Known risks
   - "recommendedAngles": Best approaches
   - "openQuestions": Things we still need to learn

2. "actionContexts": An object keyed by intel entry ID. For each, provide a 1-sentence "so what?" — what this means for a salesperson. Example: "Cost optimization push — position as efficiency play"

3. "roleBriefings": An object keyed by role archetype (finance, technology, legal, operations, executive, general). Each value is a 2-3 sentence briefing tailored to conversations with that type of stakeholder, incorporating relevant company context.

Be concise, actionable, and sales-focused. Avoid generic statements.`;

  const intelBlock = input.intel
    .map((i) => `[${i.id}] ${i.type}: ${i.summary}${i.date ? ` (${i.date})` : ""}`)
    .join("\n");

  const docBlock = input.documentSummaries.length > 0
    ? `\nDocument Summaries:\n${input.documentSummaries.join("\n\n")}`
    : "";

  const prospectBlock = input.prospects.length > 0
    ? `\nContacts:\n${input.prospects.map((p) => `- ${p.name} (${p.title || "Unknown"}, archetype: ${p.roleArchetype || "general"}): ${p.personaSummary || "No persona"}. Signals: ${p.recentSignals.join("; ") || "None"}`).join("\n")}`
    : "";

  const prompt = `Company: ${input.companyName}
Industry: ${input.industry || "Unknown"}

Intelligence Entries:
${intelBlock || "None yet"}
${docBlock}
${prospectBlock}`;

  const result = await generate({ userId: input.userId, system, prompt, json: true, temperature: 0.4 });
  try {
    const parsed = JSON.parse(result) as Partial<AccountSynthesisResult>;
    return {
      battlecard: parsed.battlecard || {},
      actionContexts: parsed.actionContexts || {},
      roleBriefings: parsed.roleBriefings || {},
    };
  } catch {
    return { battlecard: {}, actionContexts: {}, roleBriefings: {} };
  }
}

interface ContentTagsParams {
  userId: string;
  title: string;
  type: string;
  url?: string;
  body?: string;
}

interface ContentTagsResult {
  summary: string;
  tags: string[];
  personaFit: string[];
  useCaseFit: string[];
}

// --- Company Profile Extraction ---

interface CompanyProfileInput {
  userId: string;
  websiteText: string;
  contentItems: {
    id: string;
    title: string;
    type: string;
    summary: string | null;
    body: string | null;
    tags: string | null;
    personaFit: string | null;
    useCaseFit: string | null;
  }[];
}

interface StructuredOffering {
  name: string;
  problemSolved: string;
  idealBuyer: string;
  proofPoints: string[];
  linkedContentIds: string[];
  competitiveAlternatives: string[];
}

interface ICPDimensions {
  employeeRange: { min: number; max: number };
  revenueRange: { min: string; max: string };
  geographies: string[];
  industries: string[];
  techSignals: string[];
  buyingTriggers: string[];
  disqualifiers: string[];
}

interface CompetitorProfile {
  name: string;
  whereWeWin: string;
  whereTheyWin: string;
  displacementPlay: string;
}

export interface CompanyProfileResult {
  name: string;
  valueProposition: string;
  offerings: StructuredOffering[];
  icp: ICPDimensions;
  competitors: CompetitorProfile[];
  targetIndustries: string[];
  targetPersonas: string[];
  differentiators: string[];
  painPointsSolved: string[];
  fullProfile: string;
}

export async function extractCompanyProfile(
  input: CompanyProfileInput
): Promise<CompanyProfileResult> {
  const system = `You are a B2B sales positioning strategist. Analyze the company website text and supporting sales content (case studies, whitepapers, blogs) to build a complete sales profile.

Output JSON with these sections:

1. "name": The company name
2. "valueProposition": A 2-3 sentence elevator pitch describing what the company does and why it matters
3. "offerings": An array of structured offerings. For EACH distinct product/service, provide:
   - "name": Product or service name
   - "problemSolved": The specific business problem this solves (1-2 sentences)
   - "idealBuyer": The job title/role who typically buys this
   - "proofPoints": Array of proof points extracted from case studies (e.g., "30% cost reduction at FinCorp")
   - "linkedContentIds": Array of content IDs whose case studies or materials support this offering
   - "competitiveAlternatives": Array of likely competitors for this specific offering
4. "icp": Ideal Customer Profile dimensions inferred from case studies, website, and content:
   - "employeeRange": { "min": number, "max": number }
   - "revenueRange": { "min": "string", "max": "string" }
   - "geographies": Array of regions/countries served
   - "industries": Array of target industries
   - "techSignals": Array of technology indicators that signal a good fit
   - "buyingTriggers": Array of events/situations that create buying intent
   - "disqualifiers": Array of criteria that make a company a poor fit
5. "competitors": Array of competitor profiles:
   - "name": Competitor name
   - "whereWeWin": Where this company beats the competitor (1-2 sentences)
   - "whereTheyWin": Where the competitor has an advantage (1-2 sentences)
   - "displacementPlay": Strategy for displacing this competitor (1-2 sentences)
6. "targetIndustries": Array of target industries
7. "targetPersonas": Array of buyer persona titles
8. "differentiators": Array of key differentiators
9. "painPointsSolved": Array of customer pain points addressed
10. "fullProfile": A comprehensive 3-4 paragraph narrative about the company's positioning

Infer ICP from the types of companies featured in case studies and the language on the website. Identify competitors from market positioning and content focus areas. Be specific and sales-focused.`;

  const contentBlock = input.contentItems.length > 0
    ? `\n\nContent Library (${input.contentItems.length} items):\n${input.contentItems.map((c) =>
        `[ID: ${c.id}] "${c.title}" (${c.type})${c.summary ? ` — ${c.summary}` : ""}${c.body ? `\nExcerpt: ${c.body.slice(0, 500)}` : ""}`
      ).join("\n\n")}`
    : "\n\nNo content library items available yet.";

  const prompt = `Company Website Text (may be truncated):
${input.websiteText.slice(0, 40000)}
${contentBlock}`;

  const result = await generate({ userId: input.userId, system, prompt, json: true, temperature: 0.3 });
  try {
    const parsed = JSON.parse(result) as Partial<CompanyProfileResult>;

    return {
      name: parsed.name || "",
      valueProposition: parsed.valueProposition || "",
      offerings: parsed.offerings || [],
      icp: parsed.icp || {
        employeeRange: { min: 0, max: 0 },
        revenueRange: { min: "", max: "" },
        geographies: [],
        industries: [],
        techSignals: [],
        buyingTriggers: [],
        disqualifiers: [],
      },
      competitors: parsed.competitors || [],
      targetIndustries: parsed.targetIndustries || [],
      targetPersonas: parsed.targetPersonas || [],
      differentiators: parsed.differentiators || [],
      painPointsSolved: parsed.painPointsSolved || [],
      fullProfile: parsed.fullProfile || "",
    };
  } catch {
    return {
      name: "",
      valueProposition: "",
      offerings: [],
      icp: {
        employeeRange: { min: 0, max: 0 },
        revenueRange: { min: "", max: "" },
        geographies: [],
        industries: [],
        techSignals: [],
        buyingTriggers: [],
        disqualifiers: [],
      },
      competitors: [],
      targetIndustries: [],
      targetPersonas: [],
      differentiators: [],
      painPointsSolved: [],
      fullProfile: "",
    };
  }
}

// --- Company Fit Analysis ---

interface FitAnalysisInput {
  userId: string;
  profile: {
    valueProposition: string;
    offerings: StructuredOffering[];
    icp: ICPDimensions;
    competitors: CompetitorProfile[];
    targetPersonas: string[];
    differentiators: string[];
    painPointsSolved: string[];
  };
  company: {
    name: string;
    industry: string | null;
    size: string | null;
    website: string | null;
    hqLocation: string | null;
    battlecard: Record<string, string> | null;
    intel: { type: string; summary: string; date?: string }[];
    documentSummaries: string[];
    prospects: {
      name: string;
      title: string | null;
      roleArchetype: string | null;
      personaSummary: string | null;
    }[];
  };
}

interface FitDimension {
  score: number;
  weight: number;
  rationale: string;
  [key: string]: unknown;
}

interface FitEntryPoint {
  leadPersona: string;
  leadPersonaMatch: string | null;
  leadOffering: string;
  leadContent: { id: string; title: string } | null;
  discoveryQuestions: string[];
  watchSignals: string[];
}

export interface FitAnalysisResult {
  overallScore: number;
  summary: string;
  dimensions: {
    icpFit: FitDimension;
    needAlignment: FitDimension;
    timingIntent: FitDimension;
    relationshipDepth: FitDimension;
    competitivePosition: FitDimension;
  };
  bucket: string;
  entryPoint: FitEntryPoint;
  gaps: { area: string; note: string }[];
  expansionOpportunities: {
    area: string;
    evidence: string;
    offering: string;
    confidence: string;
    timing: string;
  }[];
}

export async function analyzeCompanyFit(
  input: FitAnalysisInput
): Promise<FitAnalysisResult> {
  const system = `You are a strategic B2B sales analyst. Given the seller's profile (offerings, ICP, competitors) and everything known about the target company, produce a 5-dimension fit analysis.

Output JSON with:

1. "overallScore": 0-100 weighted score
2. "summary": 1-2 sentence executive summary of the fit
3. "dimensions": Object with 5 scored dimensions, each containing:
   a. "icpFit" (weight: 25): Does the company match the ICP? Check industry, size, geography, tech signals.
      Include "signals" array of matching/non-matching ICP criteria.
   b. "needAlignment" (weight: 30): Do their priorities match our offerings?
      Include "matchedOfferings" array (each with offering name, matched need, strength high/medium/low).
      Include "unmatchedNeeds" array of company needs with no matching offering.
   c. "timingIntent" (weight: 25): Are there buying signals?
      Include "signals" array of timing evidence.
      Include "watchFor" array of signals to monitor.
   d. "relationshipDepth" (weight: 10): Do we have contacts/champions?
      Include "existingContacts" array of STRINGS (e.g. "John Doe (VP Sales)") — one string per contact.
      Include "missingPersonas" array of STRINGS (e.g. "CTO", "VP Engineering") — roles we need.
   e. "competitivePosition" (weight: 10): Are competitors entrenched?
      Include "competitorMentions" array (each with competitor name, context, threat level, displacementPlay).
      Include "fieldStatus": "open", "partially_contested", or "strongly_contested".
   Each dimension must have: score (0-100), weight, rationale.

4. "entryPoint": Structured entry strategy:
   - "leadPersona": Best role to target first
   - "leadPersonaMatch": STRING — name of existing prospect matching this role (e.g. "Jane Smith"), or null
   - "leadOffering": Which offering to lead with
   - "leadContent": { "id": content ID, "title": content title } or null
   - "discoveryQuestions": 3 questions for first conversation
   - "watchSignals": 3 signals to monitor going forward

5. "gaps": Array of { "area", "note" } for company needs with no matching offering
6. "expansionOpportunities": Array of { "area", "evidence", "offering", "confidence", "timing" }

Match SPECIFIC offerings to SPECIFIC company needs. Reference actual intel entries and prospect names. Be concrete and actionable, not generic.`;

  const offeringsBlock = input.profile.offerings
    .map((o) => `- ${o.name}: Solves "${o.problemSolved}" for ${o.idealBuyer}. Proof: ${o.proofPoints.join("; ") || "None"}. Competes with: ${o.competitiveAlternatives.join(", ") || "N/A"}`)
    .join("\n");

  const icpBlock = `ICP: ${JSON.stringify(input.profile.icp)}`;

  const competitorBlock = input.profile.competitors.length > 0
    ? `Our Competitors:\n${input.profile.competitors.map((c) => `- ${c.name}: We win on ${c.whereWeWin}. They win on ${c.whereTheyWin}. Displacement: ${c.displacementPlay}`).join("\n")}`
    : "No competitor profiles defined.";

  const battlecardBlock = input.company.battlecard
    ? `\nAccount Battlecard:\n${Object.entries(input.company.battlecard).map(([k, v]) => `${k}: ${v}`).join("\n")}`
    : "";

  const intelBlock = input.company.intel.length > 0
    ? `\nIntel (${input.company.intel.length} entries):\n${input.company.intel.map((i) => `- [${i.type}] ${i.summary}${i.date ? ` (${i.date})` : ""}`).join("\n")}`
    : "\nNo intel entries.";

  const prospectBlock = input.company.prospects.length > 0
    ? `\nKnown Contacts:\n${input.company.prospects.map((p) => `- ${p.name}, ${p.title || "Unknown role"} (archetype: ${p.roleArchetype || "general"})`).join("\n")}`
    : "\nNo known contacts.";

  const prompt = `=== SELLER PROFILE ===
Value Proposition: ${input.profile.valueProposition}
Differentiators: ${input.profile.differentiators.join(", ") || "None specified"}
Pain Points Solved: ${input.profile.painPointsSolved.join(", ") || "None specified"}
Target Personas: ${input.profile.targetPersonas.join(", ") || "None specified"}

Offerings:
${offeringsBlock || "None defined"}

${icpBlock}

${competitorBlock}

=== TARGET COMPANY ===
Name: ${input.company.name}
Industry: ${input.company.industry || "Unknown"}
Size: ${input.company.size || "Unknown"}
HQ: ${input.company.hqLocation || "Unknown"}
Website: ${input.company.website || "Unknown"}
${battlecardBlock}
${intelBlock}

Document Summaries:
${input.company.documentSummaries.join("\n\n") || "None"}
${prospectBlock}`;

  const result = await generate({ userId: input.userId, system, prompt, json: true, temperature: 0.3 });

  const defaultDimension = { score: 0, weight: 0, rationale: "No data available" };
  const defaultResult: FitAnalysisResult = {
    overallScore: 0,
    summary: "",
    dimensions: {
      icpFit: { ...defaultDimension, weight: 25 },
      needAlignment: { ...defaultDimension, weight: 30 },
      timingIntent: { ...defaultDimension, weight: 25 },
      relationshipDepth: { ...defaultDimension, weight: 10 },
      competitivePosition: { ...defaultDimension, weight: 10 },
    },
    bucket: "park",
    entryPoint: {
      leadPersona: "",
      leadPersonaMatch: null,
      leadOffering: "",
      leadContent: null,
      discoveryQuestions: [],
      watchSignals: [],
    },
    gaps: [],
    expansionOpportunities: [],
  };

  try {
    const parsed = JSON.parse(result) as Partial<FitAnalysisResult>;

    const toStr = (v: unknown): string =>
      typeof v === "string" ? v : v && typeof v === "object" && "name" in v
        ? `${(v as { name?: string }).name || ""}${(v as { title?: string }).title ? ` (${(v as { title?: string }).title})` : ""}`.trim() || String(v)
        : String(v ?? "");

    const toStrArray = (arr: unknown): string[] =>
      Array.isArray(arr) ? arr.map((x) => (typeof x === "string" ? x : toStr(x))).filter(Boolean) : [];

    const rd = parsed.dimensions?.relationshipDepth;
    const ep = parsed.entryPoint;

    return {
      overallScore: parsed.overallScore || 0,
      summary: parsed.summary || "",
      dimensions: {
        icpFit: { ...defaultDimension, weight: 25, ...parsed.dimensions?.icpFit },
        needAlignment: { ...defaultDimension, weight: 30, ...parsed.dimensions?.needAlignment },
        timingIntent: { ...defaultDimension, weight: 25, ...parsed.dimensions?.timingIntent },
        relationshipDepth: {
          ...defaultDimension,
          weight: 10,
          ...rd,
          existingContacts: rd?.existingContacts ? toStrArray(rd.existingContacts) : undefined,
          missingPersonas: rd?.missingPersonas ? toStrArray(rd.missingPersonas) : undefined,
        },
        competitivePosition: { ...defaultDimension, weight: 10, ...parsed.dimensions?.competitivePosition },
      },
      bucket: parsed.bucket || "park",
      entryPoint: ep
        ? {
            ...defaultResult.entryPoint,
            ...ep,
            leadPersonaMatch: ep.leadPersonaMatch == null ? null : typeof ep.leadPersonaMatch === "string" ? ep.leadPersonaMatch : toStr(ep.leadPersonaMatch),
            discoveryQuestions: toStrArray(ep.discoveryQuestions),
            watchSignals: toStrArray(ep.watchSignals),
          }
        : defaultResult.entryPoint,
      gaps: parsed.gaps || [],
      expansionOpportunities: parsed.expansionOpportunities || [],
    };
  } catch {
    return defaultResult;
  }
}

export interface CaptureEnrichmentResult {
  summary: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  title?: string;
}

/**
 * Extracts a clean summary and structured prospect data from scraped
 * LinkedIn/profile page content. Use when heuristic cleanup isn't enough.
 */
export async function enrichCaptureContent(userId: string, rawContent: string): Promise<CaptureEnrichmentResult> {
  const system = `You are a B2B sales intelligence analyst. Given scraped text from a LinkedIn profile or similar page (which may include UI chrome, navigation, and boilerplate), extract:

1. A clean 1-2 sentence summary of the prospect — their role, company, and any notable context (e.g., "Head of Compliance at BMW Group, Greater Munich. 2nd degree connection with 429 connections.")

2. If clearly identifiable: firstName, lastName, company, title. Use empty string or omit if uncertain.

Remove all navigation, notifications, "connections", "mutual connections", "Sales insights", "Key signals", "buyer intent", and similar UI boilerplate. Keep only the meaningful profile and context.

Respond in JSON: { "summary": "...", "firstName": "...", "lastName": "...", "company": "...", "title": "..." }
Omit any field you cannot confidently extract.`;

  const prompt = `Extract prospect info from this scraped content:\n\n${rawContent.slice(0, 4000)}`;

  try {
    const text = await generate({ userId, system, prompt, json: true, temperature: 0.2 });
    const parsed = JSON.parse(text) as Partial<CaptureEnrichmentResult>;
    return {
      summary: parsed.summary?.trim() || "",
      firstName: parsed.firstName?.trim() || undefined,
      lastName: parsed.lastName?.trim() || undefined,
      company: parsed.company?.trim() || undefined,
      title: parsed.title?.trim() || undefined,
    };
  } catch {
    return { summary: "" };
  }
}

export async function generateContentTags(params: ContentTagsParams): Promise<ContentTagsResult> {
  const system = `You are a content strategist for B2B sales enablement. Analyze the given content and produce:
1. A 1-2 sentence summary of what the content covers
2. Tags: topical keywords (e.g., "cloud-migration", "cost-optimization")
3. Persona fit: which buyer personas would find this valuable (e.g., "CTO", "VP Engineering", "IT Director")
4. Use case fit: which sales scenarios this content supports (e.g., "competitive-displacement", "expansion", "new-logo")

Respond in JSON: { "summary": "...", "tags": [...], "personaFit": [...], "useCaseFit": [...] }`;

  const prompt = `Title: ${params.title}
Type: ${params.type}
URL: ${params.url || "N/A"}
Body: ${params.body ? params.body.slice(0, 2000) : "N/A"}`;

  const text = await generate({ userId: params.userId, system, prompt, json: true, temperature: 0.3 });
  try {
    const parsed = JSON.parse(text) as Partial<ContentTagsResult>;
    return {
      summary: parsed.summary || "",
      tags: parsed.tags || [],
      personaFit: parsed.personaFit || [],
      useCaseFit: parsed.useCaseFit || [],
    };
  } catch {
    return { summary: "", tags: [], personaFit: [], useCaseFit: [] };
  }
}
