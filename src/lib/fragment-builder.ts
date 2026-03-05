/**
 * Fragment builder: aggregates fragments for a company into a structured account context.
 * Used by chat, brief, and meeting prep.
 */
import { prisma } from "@/lib/db";

export interface AccountFragmentSet {
  companyId: string;
  companyName: string;
  fitBucket: string | null;
  fragments: FragmentItem[];
  accountCoverage: AccountCoverage;
  pipelineStages: string[];
}

export interface FragmentItem {
  id: string;
  type: string;
  content: string;
  metadata: Record<string, unknown>;
  prospectId: string | null;
  prospectName: string | null;
  createdAt: Date;
  sourceId: string;
}

export interface AccountCoverage {
  prospectsContacted: number;
  prospectsTotal: number;
  rolesCovered: string[];
  rolesMissing: string[];
  lastContactByProspect: Array<{ prospectId: string; name: string; lastContactedAt: Date | null }>;
}

const ROLE_ARCHETYPES = [
  "finance",
  "technology",
  "legal",
  "operations",
  "executive",
  "general",
];

/**
 * Build fragments for a company. Excludes acted/dismissed signals.
 */
export async function buildFragmentsForCompany(
  companyId: string,
  options?: { limit?: number }
): Promise<AccountFragmentSet> {
  const limit = options?.limit ?? 50;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      fitBucket: true,
      userId: true,
    },
  });
  if (!company) {
    throw new Error("Company not found");
  }

  // Load active fragments for this company
  const fragments = await prisma.knowledgeFragment.findMany({
    where: {
      companyId,
      status: "active",
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      prospect: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });

  // Also load fragments from prospects at this company (signals, outreach) that may not have companyId set
  const prospects = await prisma.prospect.findMany({
    where: { companyId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      roleArchetype: true,
      lastContactedAt: true,
    },
  });

  const prospectIds = prospects.map((p) => p.id);
  const prospectFragments = await prisma.knowledgeFragment.findMany({
    where: {
      prospectId: { in: prospectIds },
      status: "active",
      OR: [{ companyId }, { companyId: null }],
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      prospect: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });

  // Merge and dedupe by id
  const seen = new Set<string>();
  const merged: typeof fragments = [];
  for (const f of [...fragments, ...prospectFragments]) {
    if (seen.has(f.id)) continue;
    seen.add(f.id);
    merged.push(f);
  }
  merged.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const fragmentItems: FragmentItem[] = merged.slice(0, limit).map((f) => {
    let metadata: Record<string, unknown> = {};
    try {
      if (f.metadata) metadata = JSON.parse(f.metadata) as Record<string, unknown>;
    } catch {
      /* ignore */
    }
    return {
      id: f.id,
      type: f.type,
      content: f.content,
      metadata,
      prospectId: f.prospectId,
      prospectName: f.prospect
        ? `${f.prospect.firstName} ${f.prospect.lastName}`
        : null,
      createdAt: f.createdAt,
      sourceId: f.sourceId,
    };
  });

  // Account coverage
  const rolesCovered = [
    ...new Set(
      prospects
        .filter((p) => p.roleArchetype && p.lastContactedAt)
        .map((p) => p.roleArchetype!)
    ),
  ];
  const rolesMissing = ROLE_ARCHETYPES.filter(
    (r) => r !== "general" && !rolesCovered.includes(r)
  );

  const lastContactByProspect = prospects.map((p) => ({
    prospectId: p.id,
    name: `${p.firstName} ${p.lastName}`,
    lastContactedAt: p.lastContactedAt,
  }));

  const accountCoverage: AccountCoverage = {
    prospectsContacted: prospects.filter((p) => p.lastContactedAt).length,
    prospectsTotal: prospects.length,
    rolesCovered,
    rolesMissing,
    lastContactByProspect,
  };

  const pipelineStages = [
    ...new Set(
      fragmentItems
        .map((f) => f.metadata.pipelineStage as string | undefined)
        .filter((s): s is string => Boolean(s))
    ),
  ];

  return {
    companyId,
    companyName: company.name,
    fitBucket: company.fitBucket,
    fragments: fragmentItems,
    accountCoverage,
    pipelineStages,
  };
}

/**
 * Build fragments for a prospect (includes company context).
 */
export async function buildFragmentsForProspect(prospectId: string) {
  const prospect = await prisma.prospect.findUnique({
    where: { id: prospectId },
    include: {
      companyRef: { select: { id: true, name: true } },
    },
  });
  if (!prospect) throw new Error("Prospect not found");

  const companyId = prospect.companyId ?? prospect.companyRef?.id;
  if (companyId) {
    const accountSet = await buildFragmentsForCompany(companyId, { limit: 30 });
    // Filter to prospect-specific or company-level
    const relevant = accountSet.fragments.filter(
      (f) => !f.prospectId || f.prospectId === prospectId
    );
    return {
      prospect,
      companyName: accountSet.companyName,
      fragments: relevant,
      accountCoverage: accountSet.accountCoverage,
    };
  }

  // No company - just prospect fragments
  const fragments = await prisma.knowledgeFragment.findMany({
    where: { prospectId, status: "active" },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return {
    prospect,
    companyName: null,
    fragments: fragments.map((f) => {
      let metadata: Record<string, unknown> = {};
      try {
        if (f.metadata) metadata = JSON.parse(f.metadata) as Record<string, unknown>;
      } catch {
        /* ignore */
      }
      return {
        id: f.id,
        type: f.type,
        content: f.content,
        metadata,
        prospectId: f.prospectId,
        prospectName: null,
        createdAt: f.createdAt,
        sourceId: f.sourceId,
      };
    }),
    accountCoverage: null,
  };
}
