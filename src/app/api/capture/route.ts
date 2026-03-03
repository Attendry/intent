import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { captureSchema, parseRequestBody } from "@/lib/validation";
import { cleanScrapedContent, extractLeadSummary } from "@/lib/content-cleanup";
import { findOrCreateCompany } from "@/lib/company-utils";
import { getCaptureAuth } from "@/lib/auth";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCaptureAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Use session or capture token." },
        { status: 401, headers: CORS_HEADERS }
      );
    }
    const userId = user.id;

    const parsed = await parseRequestBody(request, captureSchema);
    if ("error" in parsed) return parsed.error;
    const body = parsed.data;

    const sourceUrl = body.sourceUrl || body.url || null;
    const createSignal = body.createSignal !== false;
    let prospect = null;

    // 1. Use prospectId if provided
    if (body.prospectId) {
      prospect = await prisma.prospect.findFirst({
        where: { id: body.prospectId, userId },
      });
    }

    // 2. Search by name if no prospect yet
    if (!prospect) {
      const searchTerm = body.prospectName || body.searchTerm || "";
      const firstName = body.firstName || "";
      const lastName = body.lastName || "";
      const nameFromSearch = searchTerm.trim().split(/\s+/);
      const fName = firstName || nameFromSearch[0] || "";
      const lName = lastName || nameFromSearch.slice(1).join(" ") || "";

      if (searchTerm) {
        const candidates = await prisma.prospect.findMany({
          where: {
            userId,
            OR: [
              {
                AND: [
                  { firstName: { contains: nameFromSearch[0] || "" } },
                  ...(nameFromSearch.length > 1
                    ? [{ lastName: { contains: nameFromSearch.slice(1).join(" ") } }]
                    : []),
                ],
              },
              { company: { contains: searchTerm } },
            ],
          },
          take: 5,
        });

        if (candidates.length === 1) {
          prospect = candidates[0];
        } else if (candidates.length > 1) {
          const exact =
            candidates.find(
              (c) =>
                c.firstName.toLowerCase() === (fName || nameFromSearch[0] || "").toLowerCase() &&
                c.lastName.toLowerCase() === (lName || nameFromSearch.slice(1).join(" ") || "").toLowerCase()
            ) ||
            (body.email?.trim() &&
              candidates.find((c) => c.email?.toLowerCase() === body.email?.trim().toLowerCase())) ||
            (body.linkedinUrl?.trim() &&
              candidates.find((c) => {
                const lu = body.linkedinUrl?.trim();
                return lu && c.linkedinUrl?.includes(lu);
              }));
          prospect = exact || candidates[0];
        }
      }

      // 3. Check for duplicate by email or linkedinUrl
      if (!prospect) {
        const dupConditions: { email?: { equals: string }; linkedinUrl?: { contains: string } }[] = [];
        if (body.email?.trim()) dupConditions.push({ email: { equals: body.email.trim() } });
        if (body.linkedinUrl?.trim()) dupConditions.push({ linkedinUrl: { contains: body.linkedinUrl.trim() } });
        if (dupConditions.length > 0) {
          const existing = await prisma.prospect.findFirst({
            where: { userId, OR: dupConditions },
          });
          if (existing) prospect = existing;
        }
      }

      // 4. Create new prospect with full lead data
      if (!prospect) {
        const companyName = body.company?.trim() || null;
        let companyId: string | null = body.companyId || null;
        let canonicalCompanyName: string | null = companyName;

        if (companyName && !companyId) {
          const result = await findOrCreateCompany(userId, companyName);
          if (result) {
            companyId = result.id;
            canonicalCompanyName = result.name;
          }
        } else if (companyId) {
          const existing = await prisma.company.findFirst({
            where: { id: companyId, userId },
          });
          if (existing) canonicalCompanyName = existing.name;
        }

        const backgroundNote = sourceUrl
          ? `Created via bookmarklet from ${sourceUrl}`
          : "Created via bookmarklet";

        prospect = await prisma.prospect.create({
          data: {
            userId,
            firstName: fName || "Unknown",
            lastName: lName || "Capture",
            company: canonicalCompanyName,
            companyId,
            title: body.jobTitle || null,
            linkedinUrl: body.linkedinUrl || null,
            email: body.email || null,
            backgroundNotes: backgroundNote,
          },
        });
      }
    }

    // 5. Allocate company to existing prospect if missing
    const companyName = body.company?.trim() || null;
    const companyIdFromForm = body.companyId || null;
    if (
      prospect &&
      (!prospect.companyId || !prospect.company) &&
      (companyName || companyIdFromForm)
    ) {
      let companyId: string | null = companyIdFromForm;
      let canonicalCompanyName: string | null = prospect.company;

      if (companyName && !companyId) {
        const result = await findOrCreateCompany(userId, companyName);
        if (result) {
          companyId = result.id;
          canonicalCompanyName = result.name;
        }
      } else if (companyId) {
        const existing = await prisma.company.findFirst({
          where: { id: companyId, userId },
        });
        if (existing) canonicalCompanyName = existing.name;
      }

      if (companyId) {
        await prisma.prospect.update({
          where: { id: prospect.id },
          data: { companyId, company: canonicalCompanyName },
        });
        prospect = { ...prospect, companyId, company: canonicalCompanyName };
      }
    }

    if (!prospect) {
      return NextResponse.json(
        { error: "Prospect or lead data required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    let signal = null;
    if (createSignal) {
      const rawContentFromPage = body.content ? cleanScrapedContent(body.content) : null;
      const rawContent = body.note?.trim() || rawContentFromPage || null;
      const summary =
        body.note?.trim() ||
        (rawContentFromPage ? extractLeadSummary(rawContentFromPage, 300) : null) ||
        rawContent?.slice(0, 300) ||
        null;

      signal = await prisma.signal.create({
        data: {
          prospectId: prospect.id,
          type: body.signalType,
          sourceUrl,
          rawContent,
          summary,
          urgencyScore: body.urgencyScore ?? 3,
        },
      });
    }

    return NextResponse.json(
      {
        prospect: {
          id: prospect.id,
          firstName: prospect.firstName,
          lastName: prospect.lastName,
          company: prospect.company,
        },
        signal: signal
          ? {
              id: signal.id,
              type: signal.type,
              summary: signal.summary,
            }
          : null,
        matched: !!body.prospectId || !!(body.prospectName || body.searchTerm),
      },
      { status: 201, headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error("POST /api/capture error:", error);
    return NextResponse.json(
      { error: "Failed to capture signal" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
