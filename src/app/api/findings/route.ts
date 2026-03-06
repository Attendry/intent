import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { createFragmentFromSavedFinding } from "@/lib/fragment-sync";
import { logAccountActivity } from "@/lib/activity-log";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") || "all"; // all | shared | by-account

    const baseWhere =
      filter === "shared"
        ? { shares: { some: { sharedWithId: userId } } }
        : filter === "by-account"
          ? {
              OR: [
                { prospect: { userId } },
                { company: { userId } },
                {
                  company: {
                    collaborators: {
                      some: { userId, acceptedAt: { not: null } },
                    },
                  },
                },
                {
                  prospect: {
                    companyRef: {
                      collaborators: {
                        some: { userId, acceptedAt: { not: null } },
                      },
                    },
                  },
                },
              ],
              NOT: { shares: { some: { sharedWithId: userId } } },
            }
          : {
              OR: [
          { prospect: { userId } },
          { company: { userId } },
          {
            company: {
              collaborators: {
                some: { userId, acceptedAt: { not: null } },
              },
            },
          },
          {
            prospect: {
              companyRef: {
                collaborators: {
                  some: { userId, acceptedAt: { not: null } },
                },
              },
            },
          },
          { shares: { some: { sharedWithId: userId } } },
        ],
      };

    const findings = await prisma.savedFinding.findMany({
      where: baseWhere,
      orderBy: { createdAt: "desc" },
      include: {
        prospect: {
          include: {
            companyRef: { select: { id: true, name: true } },
          },
        },
        company: {
          select: { id: true, name: true },
        },
        createdBy: { select: { id: true, email: true } },
        shares: {
          where: { sharedWithId: userId },
          select: { shareType: true, sharedBy: { select: { email: true } } },
        },
      },
    });
    return NextResponse.json(findings);
  } catch (e) {
    console.error("[findings] list error:", e);
    return NextResponse.json(
      { error: "Failed to list findings" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const body = await request.json();
    const { content, prospectId, companyId } = body as {
      content: string;
      prospectId?: string;
      companyId?: string;
    };

    if (!content?.trim()) {
      return NextResponse.json(
        { error: "content is required" },
        { status: 400 }
      );
    }

    if (prospectId) {
      const prospect = await prisma.prospect.findFirst({ where: { id: prospectId, userId } });
      if (!prospect) {
        return NextResponse.json({ error: "Prospect not found" }, { status: 404 });
      }
    }
    if (companyId) {
      const { requireCompanyAccess } = await import("@/lib/access");
      const accessResult = await requireCompanyAccess(companyId, userId, {
        allowCollaborator: true,
      });
      if ("error" in accessResult) return accessResult.error;
    }

    const sharedWithIds = Array.isArray(body.sharedWithIds)
      ? (body.sharedWithIds as string[]).filter(Boolean)
      : [];
    const shareType = typeof body.shareType === "string" && ["actionable", "fyi", "handoff"].includes(body.shareType)
      ? body.shareType
      : "fyi";

    const finding = await prisma.savedFinding.create({
      data: {
        content: content.trim(),
        prospectId: prospectId || null,
        companyId: companyId || null,
        createdById: userId,
      },
    });

    createFragmentFromSavedFinding({
      id: finding.id,
      content: finding.content,
      prospectId: finding.prospectId,
      companyId: finding.companyId,
    }).catch((e) => console.error("[fragment-sync] finding:", e));

    if (sharedWithIds.length > 0) {
      await prisma.findingShare.createMany({
        data: sharedWithIds.map((sharedWithId) => ({
          findingId: finding.id,
          sharedWithId,
          sharedById: userId,
          shareType,
        })),
        skipDuplicates: true,
      });
      const activityCompanyId = finding.companyId ?? (finding.prospectId
        ? (await prisma.prospect.findUnique({
            where: { id: finding.prospectId },
            select: { companyId: true },
          }))?.companyId
        : null);
      if (activityCompanyId) {
        logAccountActivity(
          activityCompanyId,
          userId,
          "finding_shared",
          "finding",
          finding.id
        ).catch(() => {});
      }
    }

    const withRelations = await prisma.savedFinding.findUnique({
      where: { id: finding.id },
      include: {
        prospect: {
          include: {
            companyRef: { select: { id: true, name: true } },
          },
        },
        company: { select: { id: true, name: true } },
        createdBy: { select: { id: true, email: true } },
      },
    });

    return NextResponse.json(withRelations ?? finding, { status: 201 });
  } catch (e) {
    console.error("[findings] create error:", e);
    return NextResponse.json(
      { error: "Failed to save finding" },
      { status: 500 }
    );
  }
}
