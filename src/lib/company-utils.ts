import { prisma } from "@/lib/db";

/**
 * Normalizes company name for duplicate detection by stripping common
 * suffixes and punctuation. "Acme Inc." and "Acme Inc" match.
 */
export function normalizeCompanyName(name: string): string {
  return name
    .replace(
      /\b(GmbH|AG|Inc\.?|Ltd\.?|Corp\.?|SE|S\.A\.?|PLC|LLC|Co\.?|Group|Holdings?|International)\b/gi,
      ""
    )
    .replace(/[.,&]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Finds an existing company by name (exact or normalized match) or creates
 * a new one. Returns { id, name } to ensure we use the canonical name.
 */
export async function findOrCreateCompany(
  userId: string,
  companyName: string
): Promise<{ id: string; name: string } | null> {
  const trimmed = companyName?.trim();
  if (!trimmed) return null;

  // 1. Exact match (case-insensitive)
  const candidatesForExact = await prisma.company.findMany({
    where: { userId, name: { contains: trimmed } },
    take: 20,
  });
  const exact = candidatesForExact.find(
    (c) => c.name.toLowerCase() === trimmed.toLowerCase()
  );
  if (exact) {
    return { id: exact.id, name: exact.name };
  }

  // 2. Normalized match: find candidates by first significant word
  const normalizedInput = normalizeCompanyName(trimmed);
  if (!normalizedInput) return null;

  const firstWord = trimmed.split(/\s+/)[0];
  if (!firstWord || firstWord.length < 2) {
    const created = await prisma.company.create({
      data: { userId, name: trimmed },
    });
    return { id: created.id, name: created.name };
  }

  const candidates = await prisma.company.findMany({
    where: { userId, name: { contains: firstWord } },
    take: 30,
  });

  const match = candidates.find(
    (c) => normalizeCompanyName(c.name) === normalizedInput
  );
  if (match) {
    return { id: match.id, name: match.name };
  }

  // 3. No match — create with user's provided name
  try {
    const created = await prisma.company.create({
      data: { userId, name: trimmed },
    });
    return { id: created.id, name: created.name };
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      const retryCandidates = await prisma.company.findMany({
        where: { userId, name: { contains: firstWord } },
        take: 30,
      });
      const retryMatch = retryCandidates.find(
        (c) => normalizeCompanyName(c.name) === normalizedInput
      );
      if (retryMatch) return { id: retryMatch.id, name: retryMatch.name };
    }
    throw err;
  }
}
