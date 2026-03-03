/**
 * Cleans scraped web content (especially from LinkedIn) by removing
 * navigation, UI chrome, and boilerplate text.
 */

const LINKEDIN_BOILERPLATE = [
  // Navigation & UI
  /\b\d+\s*notifications?\s+total\b/gi,
  /\bSkip to (search|main content)\b/gi,
  /\bKeyboard shortcuts\b/gi,
  /\bClose jump menu\b/gi,
  /\bSearch new feed updates\b/gi,
  /\bnotifications?\s*$/gim,
  /\b\d+\s*\d+\s*(new\s+)?(product\s+)?notifications?\b/gi,
  /\b\d+\s*(new\s+)?(product\s+)?notifications?\b/gi,
  /^Home\s*$/gim,
  /\bMy Network\b/gi,
  /\bJobs\s*$/gim,
  /\bMessaging\s*$/gim,
  /\b\d+\s*connections?\b/gi,
  /\b\d+\s*mutual connections?\b/gi,
  /\bContact info\b/gi,
  /\bPending\b/gi,
  /\bView in Recruiter\b/gi,
  /\bSales insights\b/gi,
  /\bKey signals\b/gi,
  /\bPeople who can introduce you\b/gi,
  /\b(?:has|has moderate|has high|has low)\s+buyer intent\b/gi,
  /\b(?:and|,\s*)\s*\d+\s*more\s+(?:of\s+your\s+)?connections?\b/gi,
  /\b\d+(?:st|nd|rd|th)\s+degree\s+connection\b/gi,
  /\bFor Business\b/gi,
  /\bRecruiter\s*$/gim,
  // Common LinkedIn profile chrome
  /\b(?:Follow|Message|More)\s*$/gm,
  /\b(?:See all|See more)\s*(?:activity|experience|education)?\s*$/gim,
  /\b(?:Experience|Education|Licenses|Certifications|Skills)\s*$/gm,
  /\b(?:About|Activity|Featured)\s*$/gm,
  // Repeated short fragments
  /\b(?:Sign in|Log in|Join now)\b/gi,
  /\b(?:Privacy|Terms|Cookie)\s*(?:Policy|Settings)?\b/gi,
  /\bLinkedIn\s*(?:Corporation|©|Inc\.?)?\b/gi,
];

const GENERIC_BOILERPLATE = [
  // Number-only lines or very short UI-like lines
  /^\s*\d+\s*$/gm,
  /^\s*[A-Z][a-z]+\s+(?:and|or)\s+\d+\s+[a-z]+\s*$/gm,
];

/**
 * Removes known LinkedIn and generic UI boilerplate from scraped content.
 */
export function cleanScrapedContent(raw: string): string {
  if (!raw?.trim()) return "";

  let text = raw
    .replace(/\s+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Remove LinkedIn boilerplate phrases
  for (const pattern of LINKEDIN_BOILERPLATE) {
    text = text.replace(pattern, " ");
  }

  // Remove generic boilerplate
  for (const pattern of GENERIC_BOILERPLATE) {
    text = text.replace(pattern, "");
  }

  // Collapse repeated phrases (e.g. "Fabian Badtke, Hans Wulff, and 11 other mutual connections" appearing twice)
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const line of lines) {
    const normalized = line.toLowerCase().replace(/\s+/g, " ");
    if (normalized.length < 4) continue; // Skip very short fragments
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    deduped.push(line);
  }

  // Filter out lines that are mostly numbers or single repeated words
  const filtered = deduped.filter((line) => {
    const words = line.split(/\s+/);
    if (words.length === 1 && words[0].length < 3) return false;
    const alphaRatio = line.replace(/[^a-zA-Z]/g, "").length / Math.max(line.length, 1);
    if (alphaRatio < 0.3) return false; // Mostly non-alpha
    return true;
  });

  return filtered.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Extracts a concise summary from cleaned content, preferring the first
 * meaningful block (often the profile headline).
 */
export function extractLeadSummary(cleaned: string, maxLength = 300): string {
  if (!cleaned?.trim()) return "";

  const blocks = cleaned.split(/\n\n+/).filter((b) => b.trim().length > 20);

  // Prefer blocks that look like profile info (name, title, company, location)
  const profileLike = blocks.find(
    (b) =>
      / at |, |\bHead of\b|\bVP\b|\bDirector\b|\bManager\b|\bCEO\b|\bCFO\b/i.test(b) &&
      !/notification|connection|message|search/i.test(b)
  );

  const best = profileLike || blocks[0] || cleaned;
  const trimmed = best.trim().slice(0, maxLength);
  return trimmed.length < best.length ? `${trimmed}…` : trimmed;
}
