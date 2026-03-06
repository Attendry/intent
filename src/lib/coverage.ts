/**
 * Proactive coverage: combines company profile, fit analysis, and AI inference
 * to surface both contact gaps (known but uncontacted) and persona gaps
 * (key roles we should have but don't).
 */
import { prisma } from "@/lib/db";
import { inferBuyingCommitteePersonas, isGeminiConfigured } from "@/lib/ai";

function parseJson<T>(val: string | null, fallback: T): T {
  if (!val) return fallback;
  try {
    return JSON.parse(val) as T;
  } catch {
    return fallback;
  }
}

/** Normalize persona/title for fuzzy matching (lowercase, trim, collapse spaces). */
function normalizePersona(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b(vp|vice president|chief|cto|cio|cfo|coo)\b/gi, (m) => m.toLowerCase());
}

/** Check if two persona strings likely refer to the same role. */
function personasMatch(a: string, b: string): boolean {
  const na = normalizePersona(a);
  const nb = normalizePersona(b);
  if (na === nb) return true;
  // One contains the other (e.g. "VP Engineering" vs "Engineering")
  if (na.includes(nb) || nb.includes(na)) return true;
  // Common aliases
  const aliases: Record<string, string[]> = {
    cto: ["chief technology officer", "cto", "vp engineering", "vp of engineering"],
    cfo: ["chief financial officer", "cfo", "vp finance", "vp of finance"],
    cio: ["chief information officer", "cio", "vp it", "vp of it"],
    "vp sales": ["vp of sales", "head of sales", "sales director"],
    "vp marketing": ["vp of marketing", "cmo", "chief marketing officer"],
  };
  for (const [canon, variants] of Object.entries(aliases)) {
    if (variants.some((v) => na.includes(v) || nb.includes(v))) {
      if (variants.some((v) => na.includes(v)) && variants.some((v) => nb.includes(v))) return true;
    }
  }
  return false;
}

/** Dedupe and normalize a list of personas. */
function dedupePersonas(personas: string[]): string[] {
  const seen: string[] = [];
  for (const p of personas) {
    const trimmed = p.trim();
    if (!trimmed) continue;
    if (seen.some((s) => personasMatch(s, trimmed))) continue;
    seen.push(trimmed);
  }
  return seen;
}

export interface ProactiveCoverageResult {
  /** Contact gap: known prospects we haven't contacted. */
  contactGap: {
    contacted: number;
    total: number;
    uncontacted: Array<{ id: string; name: string; title: string | null }>;
  };
  /** Persona gap: key roles we should have but don't (no prospect, or no contacted prospect). */
  personaGap: {
    missingPersonas: string[];
    source: "profile" | "fit" | "ai" | "combined";
    /** Personas we have a prospect for but haven't contacted. */
    knownButUncontacted: Array<{ persona: string; prospectName: string; prospectId: string }>;
    /** True if we had target personas from profile/fit/AI to compare against. */
    hasTargetPersonas: boolean;
  };
}

export async function computeProactiveCoverage(
  companyId: string,
  userId: string
): Promise<ProactiveCoverageResult> {
  const company = await prisma.company.findFirst({
    where: { id: companyId },
    include: {
      prospects: {
        include: {
          outreach: { take: 1 },
          meetingLogs: { take: 1 },
        },
      },
    },
  });

  if (!company) {
    throw new Error("Company not found");
  }

  // Contact gap: existing logic
  const prospects = company.prospects.map((p) => {
    const hasOutreach = p.outreach.length > 0;
    const hasMeeting = p.meetingLogs.length > 0;
    const isContacted = hasOutreach || hasMeeting;
    return {
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      title: p.title,
      roleArchetype: p.roleArchetype,
      isContacted,
    };
  });

  const contactedCount = prospects.filter((p) => p.isContacted).length;
  const uncontacted = prospects
    .filter((p) => !p.isContacted)
    .map((p) => ({
      id: p.id,
      name: `${p.firstName} ${p.lastName}`,
      title: p.title || p.roleArchetype,
    }));

  // Build target personas from profile + fit + AI
  const ownerId = company.userId;
  const profile = await prisma.companyProfile.findUnique({
    where: { userId: ownerId },
  });

  let targetPersonas: string[] = [];
  let fitMissingPersonas: string[] = [];
  let aiPersonas: string[] = [];

  // 1. From company profile: targetPersonas + idealBuyer from offerings
  if (profile && profile.status === "published") {
    const fromProfile = parseJson<string[]>(profile.targetPersonas, []);
    const offerings = parseJson<{ idealBuyer: string }[]>(profile.offerings, []);
    const fromOfferings = offerings.map((o) => o.idealBuyer).filter(Boolean);
    targetPersonas = dedupePersonas([...fromProfile, ...fromOfferings]);
  }

  // 2. From fit analysis: missingPersonas (already account-specific)
  if (company.fitAnalysis) {
    try {
      const fit = JSON.parse(company.fitAnalysis) as {
        dimensions?: { relationshipDepth?: { missingPersonas?: string[] } };
      };
      fitMissingPersonas = fit.dimensions?.relationshipDepth?.missingPersonas ?? [];
      fitMissingPersonas = dedupePersonas(fitMissingPersonas);
    } catch {
      /* ignore malformed fit */
    }
  }

  // 3. AI inference: infer buying committee for this account type
  const geminiOk = await isGeminiConfigured(userId);
  if (geminiOk) {
    try {
      aiPersonas = await inferBuyingCommitteePersonas({
        userId,
        company: {
          name: company.name,
          industry: company.industry,
          size: company.size,
        },
        targetPersonas,
        existingContacts: prospects.map((p) => ({
          name: `${p.firstName} ${p.lastName}`,
          title: p.title || p.roleArchetype,
        })),
      });
    } catch (err) {
      console.warn("AI persona inference failed:", err);
    }
  }

  // Combine: union of profile, fit, and AI (deduped)
  const allTargetPersonas = dedupePersonas([
    ...targetPersonas,
    ...fitMissingPersonas,
    ...aiPersonas,
  ]);

  // Map prospects to personas (title or roleArchetype as proxy)
  const prospectPersonas = prospects.map((p) => ({
    prospect: p,
    persona: p.title || p.roleArchetype || "Unknown",
  }));

  // Personas we're missing entirely (no prospect)
  const missingPersonas: string[] = [];
  for (const target of allTargetPersonas) {
    const hasMatch = prospectPersonas.some((pp) =>
      personasMatch(pp.persona, target)
    );
    if (!hasMatch) {
      missingPersonas.push(target);
    }
  }

  // Personas we have a prospect for but haven't contacted
  const knownButUncontacted: ProactiveCoverageResult["personaGap"]["knownButUncontacted"] = [];
  for (const target of allTargetPersonas) {
    const match = prospectPersonas.find(
      (pp) => personasMatch(pp.persona, target) && !pp.prospect.isContacted
    );
    if (match) {
      knownButUncontacted.push({
        persona: target,
        prospectName: `${match.prospect.firstName} ${match.prospect.lastName}`,
        prospectId: match.prospect.id,
      });
    }
  }

  const source =
    fitMissingPersonas.length > 0 && aiPersonas.length > 0
      ? "combined"
      : fitMissingPersonas.length > 0
        ? "fit"
        : aiPersonas.length > 0
          ? "ai"
          : "profile";

  return {
    contactGap: {
      contacted: contactedCount,
      total: prospects.length,
      uncontacted,
    },
    personaGap: {
      missingPersonas,
      source,
      knownButUncontacted,
      hasTargetPersonas: allTargetPersonas.length > 0,
    },
  };
}
