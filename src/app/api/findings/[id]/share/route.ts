import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { logAccountActivity } from "@/lib/activity-log";

/**
 * POST /api/findings/[id]/share
 * Share a finding with users by email.
 * Body: { emails: string[], shareType?: "actionable" | "fyi" | "handoff", message?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;

    const { id: findingId } = await params;
    const finding = await prisma.savedFinding.findFirst({
      where: {
        id: findingId,
        OR: [
          { prospect: { userId: auth.user.id } },
          { company: { userId: auth.user.id } },
          {
            company: {
              collaborators: {
                some: { userId: auth.user.id, acceptedAt: { not: null } },
              },
            },
          },
          {
            prospect: {
              companyRef: {
                collaborators: {
                  some: { userId: auth.user.id, acceptedAt: { not: null } },
                },
              },
            },
          },
          { shares: { some: { sharedWithId: auth.user.id } } },
        ],
      },
      select: { companyId: true, prospect: { select: { companyId: true } } },
    });

    if (!finding) {
      return NextResponse.json({ error: "Finding not found" }, { status: 404 });
    }

    const companyId =
      finding.companyId ?? finding.prospect?.companyId ?? null;

    const body = await request.json();
    const emails = Array.isArray(body.emails)
      ? (body.emails as string[]).map((e) => String(e).trim().toLowerCase()).filter(Boolean)
      : [];
    const shareType =
      typeof body.shareType === "string" &&
      ["actionable", "fyi", "handoff"].includes(body.shareType)
        ? body.shareType
        : "fyi";
    const message = typeof body.message === "string" ? body.message : null;

    if (emails.length === 0) {
      return NextResponse.json(
        { error: "At least one email is required" },
        { status: 400 }
      );
    }

    const users = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { id: true, email: true },
    });

    const created: { userId: string; email: string | null }[] = [];
    for (const user of users) {
      if (user.id === auth.user.id) continue;

      await prisma.findingShare.upsert({
        where: {
          findingId_sharedWithId: { findingId, sharedWithId: user.id },
        },
        create: {
          findingId,
          sharedWithId: user.id,
          sharedById: auth.user.id,
          shareType,
          message,
        },
        update: { shareType, message },
      });
      created.push({ userId: user.id, email: user.email });
    }

    if (companyId && created.length > 0) {
      logAccountActivity(
        companyId,
        auth.user.id,
        "finding_shared",
        "finding",
        findingId
      ).catch(() => {});
    }

    const notFound = emails.filter(
      (e) => !users.some((u) => u.email?.toLowerCase() === e)
    );

    return NextResponse.json({
      shared: created,
      notFound,
    });
  } catch (error) {
    console.error("POST /api/findings/[id]/share error:", error);
    return NextResponse.json(
      { error: "Failed to share finding" },
      { status: 500 }
    );
  }
}
