import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { extractCompanyProfile } from "@/lib/ai";
import { requireAuth } from "@/lib/auth";
import crypto from "crypto";

function computeContentHash(
  items: { id: string; updatedAt: Date }[]
): string {
  const payload = items
    .map((c) => `${c.id}:${c.updatedAt.getTime()}`)
    .sort()
    .join("|");
  return crypto.createHash("md5").update(payload).digest("hex");
}

async function fetchAndParseWebsite(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
    },
    redirect: "follow",
  });

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

    const body = await request.json();
    const { website } = body;

    if (!website) {
      return NextResponse.json(
        { error: "website URL is required" },
        { status: 400 }
      );
    }

    let rawWebsiteText: string;
    try {
      rawWebsiteText = await fetchAndParseWebsite(website);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch website";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    if (rawWebsiteText.length < 50) {
      return NextResponse.json(
        { error: "Website text too short to analyze" },
        { status: 400 }
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
        website,
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
        website,
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
    return NextResponse.json(
      { error: "Failed to generate company profile" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const body = await request.json();
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
    return NextResponse.json(
      { error: "Failed to update company profile" },
      { status: 500 }
    );
  }
}
