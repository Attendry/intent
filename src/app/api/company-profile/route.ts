import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { extractCompanyProfile, isGeminiConfigured, GEMINI_NOT_CONFIGURED_MSG } from "@/lib/ai";
import { requireAuth } from "@/lib/auth";
import crypto from "crypto";

// Website fetch + Gemini analysis can exceed default 10–15s; allow up to 60s
export const maxDuration = 60;

function computeContentHash(
  items: { id: string; updatedAt: Date }[]
): string {
  const payload = items
    .map((c) => `${c.id}:${c.updatedAt.getTime()}`)
    .sort()
    .join("|");
  return crypto.createHash("md5").update(payload).digest("hex");
}

function normalizeWebsiteUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("URL must use http or https");
    }
    return url.toString();
  } catch {
    // If no protocol, assume https
    if (!/^https?:\/\//i.test(trimmed)) {
      return `https://${trimmed}`;
    }
    throw new Error("Invalid website URL");
  }
}

async function fetchAndParseWebsite(url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25_000);

  const response = await fetch(url, {
    signal: controller.signal,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
    },
    redirect: "follow",
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(`Failed to fetch website: HTTP ${response.status}`);
  }

  const html = await response.text();
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export async function GET() {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const profile = await prisma.companyProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return NextResponse.json({ profile: null, isContentStale: false, staleFitCount: 0 });
    }

    const contentItems = await prisma.content.findMany({
      where: { userId },
      select: { id: true, updatedAt: true },
    });
    const currentHash = computeContentHash(contentItems);
    const isContentStale =
      profile.contentVersionHash !== null &&
      profile.contentVersionHash !== currentHash;

    let staleFitCount = 0;
    if (profile.profileVersionHash) {
      staleFitCount = await prisma.company.count({
        where: {
          userId,
          lastFitAnalyzedAt: { not: null },
          NOT: { profileVersionUsed: profile.profileVersionHash },
        },
      });
    }

    return NextResponse.json({ profile, isContentStale, staleFitCount });
  } catch (error) {
    console.error("GET /api/company-profile error:", error);
    return NextResponse.json(
      { error: "Failed to fetch company profile" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    let body: { website?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }
    const { website } = body;

    if (!website || typeof website !== "string") {
      return NextResponse.json(
        { error: "website URL is required" },
        { status: 400 }
      );
    }

    let normalizedUrl: string;
    try {
      normalizedUrl = normalizeWebsiteUrl(website);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid website URL";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    let rawWebsiteText: string;
    try {
      rawWebsiteText = await fetchAndParseWebsite(normalizedUrl);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.name === "AbortError"
            ? "Website request timed out (25s)"
            : err.message
          : "Failed to fetch website";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    if (rawWebsiteText.length < 50) {
      return NextResponse.json(
        { error: "Website text too short to analyze" },
        { status: 400 }
      );
    }

    if (!(await isGeminiConfigured(userId))) {
      return NextResponse.json(
        { error: GEMINI_NOT_CONFIGURED_MSG },
        { status: 503 }
      );
    }

    const contentItems = await prisma.content.findMany({
      where: { userId },
      select: {
        id: true,
        title: true,
        type: true,
        summary: true,
        body: true,
        tags: true,
        personaFit: true,
        useCaseFit: true,
        updatedAt: true,
      },
    });

    const result = await extractCompanyProfile({
      userId,
      websiteText: rawWebsiteText,
      contentItems,
    });

    const contentHash = computeContentHash(
      contentItems.map((c) => ({ id: c.id, updatedAt: c.updatedAt }))
    );

    const profile = await prisma.companyProfile.upsert({
      where: { userId },
      create: {
        userId,
        name: result.name,
        website: normalizedUrl,
        rawWebsiteText,
        valueProposition: result.valueProposition,
        offerings: JSON.stringify(result.offerings),
        icp: JSON.stringify(result.icp),
        competitors: JSON.stringify(result.competitors),
        targetIndustries: JSON.stringify(result.targetIndustries),
        targetPersonas: JSON.stringify(result.targetPersonas),
        differentiators: JSON.stringify(result.differentiators),
        painPointsSolved: JSON.stringify(result.painPointsSolved),
        fullProfile: result.fullProfile,
        status: "draft",
        contentVersionHash: contentHash,
        lastAnalyzedAt: new Date(),
      },
      update: {
        name: result.name,
        website: normalizedUrl,
        rawWebsiteText,
        valueProposition: result.valueProposition,
        offerings: JSON.stringify(result.offerings),
        icp: JSON.stringify(result.icp),
        competitors: JSON.stringify(result.competitors),
        targetIndustries: JSON.stringify(result.targetIndustries),
        targetPersonas: JSON.stringify(result.targetPersonas),
        differentiators: JSON.stringify(result.differentiators),
        painPointsSolved: JSON.stringify(result.painPointsSolved),
        fullProfile: result.fullProfile,
        status: "draft",
        contentVersionHash: contentHash,
        lastAnalyzedAt: new Date(),
      },
    });

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("PUT /api/company-profile error:", error);
    const msg = error instanceof Error ? error.message : "";
    const isGeminiError = msg.includes("Gemini") || msg.includes("API key");
    return NextResponse.json(
      { error: isGeminiError ? msg : "Failed to generate company profile" },
      { status: isGeminiError ? 503 : 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }
    const { publish, ...fields } = body;

    const existing = await prisma.companyProfile.findUnique({
      where: { userId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "No company profile exists. Create one first via PUT." },
        { status: 404 }
      );
    }

    const data: Record<string, unknown> = {};

    const stringFields = [
      "name",
      "website",
      "valueProposition",
      "fullProfile",
    ] as const;
    for (const f of stringFields) {
      if (fields[f] !== undefined) data[f] = fields[f];
    }

    const jsonFields = [
      "offerings",
      "icp",
      "competitors",
      "targetIndustries",
      "targetPersonas",
      "differentiators",
      "painPointsSolved",
    ] as const;
    for (const f of jsonFields) {
      if (fields[f] !== undefined) {
        data[f] =
          typeof fields[f] === "string" ? fields[f] : JSON.stringify(fields[f]);
      }
    }

    if (publish) {
      data.status = "published";
      const newVersion = crypto.randomUUID().slice(0, 8);
      data.profileVersionHash = newVersion;
    }

    const profile = await prisma.companyProfile.update({
      where: { userId },
      data,
    });

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("PATCH /api/company-profile error:", error);
    const msg = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: msg || "Failed to update company profile" },
      { status: 500 }
    );
  }
}
