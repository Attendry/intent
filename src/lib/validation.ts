import { z } from "zod";

export const SignalTypeEnum = z.enum([
  "linkedin_post", "company_news", "job_change", "hiring",
  "conference", "re_engagement", "new_prospect", "other"
]);

export const ChannelEnum = z.enum(["email", "linkedin", "phone", "other"]);

export const OutcomeEnum = z.enum([
  "no_response", "positive", "negative", "meeting_booked",
  "sent", "replied", "interested", "not_interested", "bounced",
]);

export const PriorityTierEnum = z.enum(["low", "medium", "high"]);

export const IntelTypeEnum = z.enum([
  "company_news", "conference", "funding", "partnership", "hiring",
  "leadership_change", "earnings", "strategy", "risk", "competitor", "other"
]);

export const ContentTypeEnum = z.enum(["case_study", "blog", "whitepaper", "video", "competitive", "other"]);

export const createSignalSchema = z.object({
  prospectId: z.string().min(1),
  type: SignalTypeEnum,
  sourceUrl: z.string().url().optional().or(z.literal("")),
  rawContent: z.string().optional(),
  summary: z.string().optional(),
  urgencyScore: z.number().int().min(1).max(5).default(3),
  outreachAngle: z.string().optional(),
  contentSuggestionIds: z.array(z.string()).optional(),
  private: z.boolean().default(false),
});

export const updateSignalSchema = z.object({
  actedOn: z.boolean().optional(),
  dismissed: z.boolean().optional(),
  snoozedUntil: z.string().nullable().optional(),
  urgencyScore: z.number().int().min(1).max(5).optional(),
  summary: z.string().optional(),
  outreachAngle: z.string().optional(),
  private: z.boolean().optional(),
});

export const createOutreachSchema = z.object({
  prospectId: z.string().min(1),
  signalId: z.string().optional(),
  channel: ChannelEnum,
  messageSent: z.string().optional(),
  subjectLine: z.string().optional(),
  outcome: OutcomeEnum.default("no_response"),
  notes: z.string().optional(),
  language: z.string().default("en"),
  nextFollowUpDays: z.number().int().min(0).optional(),
  contentIds: z.array(z.string()).optional(),
});

export const createCompanySchema = z.object({
  name: z.string().min(1).max(500),
  industry: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),
  size: z.string().optional(),
  hqLocation: z.string().optional(),
  notes: z.string().optional(),
});

export const createContentSchema = z.object({
  title: z.string().min(1).max(500),
  type: ContentTypeEnum,
  stage: z.enum(["intro", "nurture", "closing"]).optional(),
  url: z.string().optional(),
  body: z.string().optional(),
  summary: z.string().optional(),
  tags: z.array(z.string()).optional(),
  personaFit: z.array(z.string()).optional(),
  useCaseFit: z.array(z.string()).optional(),
});

export const createIntelSchema = z.object({
  type: IntelTypeEnum,
  summary: z.string().min(1),
  sourceUrl: z.string().url().optional().or(z.literal("")),
  urgencyScore: z.number().int().min(1).max(5).default(3),
  sourceRef: z.string().optional(),
  sourceQuote: z.string().optional(),
  date: z.string().datetime().optional(),
  documentId: z.string().optional(),
  actionContext: z.string().optional(),
});

export const draftSchema = z.object({
  prospectId: z.string().min(1),
  signalId: z.string().optional(),
  channel: ChannelEnum.default("email"),
  language: z.string().default("en"),
  templateUseCase: z.string().optional(),
});

export const redraftSchema = z.object({
  originalDraft: z.object({
    subject: z.string(),
    body: z.string(),
  }),
  subject: z.string().optional(),
  body: z.string().optional(),
  instruction: z.string().min(1),
  prospectId: z.string().min(1),
  signalId: z.string().min(1),
  channel: ChannelEnum.default("email"),
  language: z.string().default("en"),
});

export const createProspectSchema = z.object({
  firstName: z.string().min(1).max(200),
  lastName: z.string().min(1).max(200),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  mobilePhone: z.string().optional(),
  title: z.string().optional(),
  company: z.string().optional(),
  industry: z.string().optional(),
  linkedinUrl: z.string().url().optional().or(z.literal("")),
  personaSummary: z.string().optional(),
  personaTags: z.array(z.string()).optional(),
  backgroundNotes: z.string().optional(),
  priorityTier: PriorityTierEnum.optional(),
  starred: z.boolean().optional(),
  preferredLang: z.string().optional(),
});

export const documentUrlSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  type: z.string().optional(),
});

export const documentProcessSchema = z.object({
  documentId: z.string().min(1),
});

export const prepSchema = z.object({
  prospectId: z.string().min(1),
});

export const enrichSchema = z.object({
  prospectId: z.string().optional(),
  prospectIds: z.array(z.string()).optional(),
  content: z.string().optional(),
}).refine((d) => !!(d.prospectId || (d.prospectIds && d.prospectIds.length > 0) || (d.content && d.content.trim())), {
  message: "prospectId, prospectIds, or content is required",
});

export const voiceExampleSchema = z.object({
  language: z.string().default("en"),
  originalDraft: z.string().min(1),
  revisedDraft: z.string().min(1),
});

export const suggestionActionSchema = z.object({
  action: z.enum(["approve", "dismiss"]),
});

export const companyProfilePutSchema = z.object({
  website: z.string().url(),
});

export const companyProfilePatchSchema = z.object({
  publish: z.boolean().optional(),
  name: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),
  valueProposition: z.string().optional(),
  fullProfile: z.string().optional(),
  offerings: z.unknown().optional(),
  icp: z.unknown().optional(),
  competitors: z.unknown().optional(),
  targetIndustries: z.unknown().optional(),
  targetPersonas: z.unknown().optional(),
  differentiators: z.unknown().optional(),
  painPointsSolved: z.unknown().optional(),
});

export const captureSchema = z.object({
  url: z.string().optional(),
  sourceUrl: z.string().optional(),
  title: z.string().optional(),
  content: z.string().max(2000).optional(),
  prospectId: z.string().optional(),
  prospectName: z.string().optional(),
  searchTerm: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  company: z.string().optional(),
  companyId: z.string().optional(),
  jobTitle: z.string().optional(),
  linkedinUrl: z.string().url().optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  signalType: z.string().default("other"),
  note: z.string().optional(),
  urgencyScore: z.number().int().min(1).max(5).optional(),
  createSignal: z.boolean().default(true),
});

/** Attempt to parse a request body with a Zod schema. Returns the data or a 400 Response. */
export async function parseRequestBody<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<{ data: T } | { error: Response }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      error: new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      ),
    };
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      error: new Response(
        JSON.stringify({
          error: "Validation failed",
          details: result.error.flatten().fieldErrors,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      ),
    };
  }
  return { data: result.data };
}
