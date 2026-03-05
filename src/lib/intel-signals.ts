import { prisma } from "@/lib/db";
import { createFragmentFromSignal } from "@/lib/fragment-sync";

/**
 * Derive outreach angle from intel type when document extraction doesn't provide one.
 */
export function deriveOutreachAngle(type: string, companyName: string): string {
  const templates: Record<string, string> = {
    funding: "Recent funding — great time to reach out about growth initiatives.",
    partnership: "Partnership news — explore synergies.",
    hiring: "Hiring signal — they may be scaling; relevant for your solution.",
    leadership_change: "Leadership change — new priorities may create opportunity.",
    competitor: "Competitive mention — displacement opportunity.",
  };
  return (
    templates[type] ??
    `Recent ${type.replace(/_/g, " ")} at ${companyName} — consider reaching out.`
  );
}

/**
 * Create prospect signals for all prospects at a company when high-urgency intel is extracted.
 * Returns the count of signals created.
 */
export async function createProspectSignalsFromIntel(params: {
  companyId: string;
  intel: {
    type: string;
    summary: string;
    sourceUrl: string | null;
    urgencyScore: number;
    actionContext?: string | null;
  };
}): Promise<number> {
  const { companyId, intel } = params;

  const prospects = await prisma.prospect.findMany({
    where: { companyId },
    select: { id: true },
  });

  let created = 0;
  for (const prospect of prospects) {
    try {
      const existing = await prisma.signal.findFirst({
        where: {
          prospectId: prospect.id,
          summary: intel.summary,
          actedOn: false,
          dismissed: false,
        },
      });
      if (existing) continue;

      const sig = await prisma.signal.create({
        data: {
          prospectId: prospect.id,
          type: intel.type,
          summary: intel.summary,
          sourceUrl: intel.sourceUrl,
          urgencyScore: intel.urgencyScore,
          outreachAngle: intel.actionContext ?? null,
        },
      });

      createFragmentFromSignal({
        id: sig.id,
        prospectId: sig.prospectId,
        type: sig.type,
        summary: sig.summary,
        rawContent: null,
        urgencyScore: sig.urgencyScore,
        actedOn: sig.actedOn,
        dismissed: sig.dismissed,
      }).catch((e) => console.error("[fragment-sync] signal:", e));

      created++;
    } catch (err) {
      console.error("[intel-signals] Failed to create signal for prospect:", prospect.id, err);
      // Continue with other prospects
    }
  }

  return created;
}
