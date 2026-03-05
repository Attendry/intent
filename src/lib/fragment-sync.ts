/**
 * Event-driven fragment sync. Call these after creating/updating source entities.
 * Fragments are derived from existing data—no migration of raw data.
 */
import { prisma } from "@/lib/db";

export type FragmentType =
  | "intel"
  | "finding"
  | "signal"
  | "outreach"
  | "synthesis"
  | "content"
  | "document"
  | "competitive"
  | "manual";

export type FragmentStatus = "active" | "acted" | "dismissed";

function buildMetadata(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify(overrides);
}

/**
 * Create fragment from CompanyIntel
 */
export async function createFragmentFromCompanyIntel(intel: {
  id: string;
  companyId: string;
  type: string;
  summary: string;
  actionContext: string | null;
  urgencyScore: number;
  date: Date | null;
}) {
  const company = await prisma.company.findUnique({
    where: { id: intel.companyId },
    select: { userId: true },
  });
  if (!company) return;

  await prisma.knowledgeFragment.create({
    data: {
      userId: company.userId,
      companyId: intel.companyId,
      type: "intel",
      sourceId: `companyIntel:${intel.id}`,
      content: intel.summary,
      metadata: buildMetadata({
        urgency: intel.urgencyScore,
        date: intel.date?.toISOString(),
        actionContext: intel.actionContext,
        intelType: intel.type,
      }),
      status: "active",
    },
  });
}

/**
 * Create fragment from SavedFinding. Derive userId from prospect or company.
 */
export async function createFragmentFromSavedFinding(finding: {
  id: string;
  content: string;
  prospectId: string | null;
  companyId: string | null;
}) {
  let userId: string | null = null;
  if (finding.prospectId) {
    const p = await prisma.prospect.findUnique({
      where: { id: finding.prospectId },
      select: { userId: true },
    });
    userId = p?.userId ?? null;
  }
  if (!userId && finding.companyId) {
    const c = await prisma.company.findUnique({
      where: { id: finding.companyId },
      select: { userId: true },
    });
    userId = c?.userId ?? null;
  }
  if (!userId) return; // Orphan finding—skip fragment

  await prisma.knowledgeFragment.create({
    data: {
      userId,
      companyId: finding.companyId,
      prospectId: finding.prospectId,
      type: "finding",
      sourceId: `savedFinding:${finding.id}`,
      content: finding.content,
      status: "active",
    },
  });
}

/**
 * Create fragment from Signal. Exclude acted/dismissed from active retrieval.
 */
export async function createFragmentFromSignal(signal: {
  id: string;
  prospectId: string;
  type: string;
  summary: string | null;
  rawContent: string | null;
  urgencyScore: number;
  actedOn: boolean;
  dismissed: boolean;
}) {
  const prospect = await prisma.prospect.findUnique({
    where: { id: signal.prospectId },
    select: { userId: true, companyId: true, pipelineStage: true },
  });
  if (!prospect) return;

  const content =
    signal.summary?.trim() ||
    (signal.rawContent?.slice(0, 500) ?? "") ||
    `Signal: ${signal.type}`;
  const status: FragmentStatus =
    signal.actedOn || signal.dismissed ? "acted" : "active";

  await prisma.knowledgeFragment.create({
    data: {
      userId: prospect.userId,
      companyId: prospect.companyId,
      prospectId: signal.prospectId,
      type: "signal",
      sourceId: `signal:${signal.id}`,
      content,
      metadata: buildMetadata({
        urgency: signal.urgencyScore,
        signalType: signal.type,
        pipelineStage: prospect.pipelineStage,
      }),
      status,
    },
  });
}

/**
 * Update fragment status when Signal is acted on or dismissed
 */
export async function updateFragmentStatusForSignal(
  signalId: string,
  status: FragmentStatus
) {
  await prisma.knowledgeFragment.updateMany({
    where: { sourceId: `signal:${signalId}` },
    data: { status },
  });
}

/**
 * Create fragment from OutreachLog
 */
export async function createFragmentFromOutreachLog(outreach: {
  id: string;
  prospectId: string;
  channel: string;
  messageSent: string | null;
  subjectLine: string | null;
  outcome: string;
  notes: string | null;
}) {
  const prospect = await prisma.prospect.findUnique({
    where: { id: outreach.prospectId },
    select: { userId: true, companyId: true },
  });
  if (!prospect) return;

  const content =
    outreach.notes?.trim() ||
    outreach.subjectLine?.trim() ||
    outreach.messageSent?.slice(0, 300) ||
    `Outreach via ${outreach.channel}: ${outreach.outcome}`;

  await prisma.knowledgeFragment.create({
    data: {
      userId: prospect.userId,
      companyId: prospect.companyId,
      prospectId: outreach.prospectId,
      type: "outreach",
      sourceId: `outreachLog:${outreach.id}`,
      content,
      metadata: buildMetadata({
        channel: outreach.channel,
        outcome: outreach.outcome,
      }),
      status: "active",
    },
  });
}

/**
 * Create fragment from Content (summary, persona/use-case fit)
 */
export async function createFragmentFromContent(content: {
  id: string;
  userId: string;
  title: string;
  type: string;
  summary: string | null;
  personaFit: string | null;
  useCaseFit: string | null;
}) {
  const parts: string[] = [content.title, content.type];
  if (content.summary) parts.push(content.summary);
  if (content.personaFit) parts.push(`Persona fit: ${content.personaFit}`);
  if (content.useCaseFit) parts.push(`Use cases: ${content.useCaseFit}`);

  await prisma.knowledgeFragment.create({
    data: {
      userId: content.userId,
      type: "content",
      sourceId: `content:${content.id}`,
      content: parts.join(" | "),
      metadata: buildMetadata({
        contentType: content.type,
        personaFit: content.personaFit,
        useCaseFit: content.useCaseFit,
      }),
      status: "active",
    },
  });
}

/**
 * Create fragment from MeetingLog
 */
export async function createFragmentFromMeetingLog(meeting: {
  id: string;
  prospectId: string;
  userId: string;
  summary: string | null;
  notes: string | null;
  actionItems: string | null;
  outcome: string | null;
}) {
  const prospect = await prisma.prospect.findUnique({
    where: { id: meeting.prospectId },
    select: { companyId: true },
  });

  const content =
    meeting.summary?.trim() ||
    meeting.notes?.trim() ||
    meeting.actionItems ||
    `Meeting: ${meeting.outcome || "logged"}`;

  await prisma.knowledgeFragment.create({
    data: {
      userId: meeting.userId,
      companyId: prospect?.companyId ?? null,
      prospectId: meeting.prospectId,
      type: "synthesis",
      sourceId: `meetingLog:${meeting.id}`,
      content,
      metadata: buildMetadata({
        outcome: meeting.outcome,
      }),
      status: "active",
    },
  });
}

/**
 * Create fragment from CompanyDocument when status is completed
 */
export async function createFragmentFromCompanyDocument(doc: {
  id: string;
  companyId: string;
  title: string;
  type: string;
  fullSummary: string | null;
}) {
  const company = await prisma.company.findUnique({
    where: { id: doc.companyId },
    select: { userId: true },
  });
  if (!company) return;

  const content =
    doc.fullSummary?.trim() || `${doc.title} (${doc.type}) - document processed`;

  await prisma.knowledgeFragment.create({
    data: {
      userId: company.userId,
      companyId: doc.companyId,
      type: "document",
      sourceId: `companyDocument:${doc.id}`,
      content,
      metadata: buildMetadata({
        documentType: doc.type,
      }),
      status: "active",
    },
  });
}
