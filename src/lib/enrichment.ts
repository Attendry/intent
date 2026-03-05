import { prisma } from "@/lib/db";
import { debugLog } from "@/lib/debug";
import { generatePersonaSummary } from "@/lib/ai";

export async function enrichProspect(userId: string, prospectId: string): Promise<void> {
  const prospect = await prisma.prospect.findFirst({ where: { id: prospectId, userId } });
  if (!prospect) throw new Error(`Prospect ${prospectId} not found`);

  if (prospect.personaSummary) {
    debugLog(`[enrich] Skipping ${prospect.firstName} ${prospect.lastName} — already has persona`);
    return;
  }

  debugLog(`[enrich] Generating persona for ${prospect.firstName} ${prospect.lastName}…`);
  const result = await generatePersonaSummary({
    userId,
    firstName: prospect.firstName,
    lastName: prospect.lastName,
    title: prospect.title || "",
    company: prospect.company || "",
    industry: prospect.industry || "",
  });

  await prisma.prospect.update({
    where: { id: prospectId },
    data: {
      personaSummary: result.summary,
      roleArchetype: result.roleArchetype,
    },
  });
  debugLog(`[enrich] ✓ Persona saved for ${prospect.firstName} ${prospect.lastName} (archetype: ${result.roleArchetype})`);
}

export async function enrichImportBatch(userId: string, prospectIds: string[]): Promise<{
  succeeded: string[];
  failed: { id: string; error: string }[];
}> {
  const succeeded: string[] = [];
  const failed: { id: string; error: string }[] = [];

  for (const id of prospectIds) {
    try {
      await enrichProspect(userId, id);
      succeeded.push(id);
    } catch (err) {
      failed.push({
        id,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return { succeeded, failed };
}
