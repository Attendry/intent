import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getCompanyAccess, requireCompanyAccess } from "@/lib/access";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const accessResult = await requireCompanyAccess(id, auth.user.id, {
      allowCollaborator: true,
    });
    if ("error" in accessResult) return accessResult.error;

    const access = await getCompanyAccess(id, auth.user.id);

    const company = await prisma.company.findFirst({
      where: { id },
      include: {
        prospects: {
          include: {
            signals: {
              where: { actedOn: false, dismissed: false },
            },
            outreach: {
              orderBy: { createdAt: "desc" },
              take: 5,
            },
            meetingLogs: {
              orderBy: { createdAt: "desc" },
              take: 3,
            },
          },
        },
      },
    });

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const prospectIds = company.prospects.map((p) => p.id);
    const findings = await prisma.savedFinding.findMany({
      where: prospectIds.length > 0
        ? { OR: [{ companyId: id }, { prospectId: { in: prospectIds } }] }
        : { companyId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const now = new Date();
    const prospectsWithAction = company.prospects.map((p) => {
      const hasOutreach = p.outreach.length > 0;
      const hasMeeting = p.meetingLogs.length > 0 || p.outreach.some((o) => o.outcome === "meeting_booked");
      const isContacted = hasOutreach || hasMeeting;
      const unactedSignals = p.signals.length;
      const isOverdue = p.nextFollowUpAt && new Date(p.nextFollowUpAt) < now;

      let nextBestAction = "No action";
      if (unactedSignals > 0) nextBestAction = "Act on signal";
      else if (isOverdue) nextBestAction = "Follow up";
      else if (p.pipelineStage === "qualified") nextBestAction = "Schedule meeting";
      else if (p.pipelineStage === "proposal") nextBestAction = "Send proposal";
      else if (!isContacted) nextBestAction = "Initial outreach";

      return {
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        title: p.title,
        roleArchetype: p.roleArchetype,
        lastContactedAt: p.lastContactedAt,
        pipelineStage: p.pipelineStage || "new",
        unactedSignalCount: unactedSignals,
        hasMeeting,
        isContacted,
        nextBestAction,
        lastMeetingSummary: p.meetingLogs[0]?.summary || null,
      };
    });

    const priorityActions = prospectsWithAction
      .filter((p) => p.nextBestAction !== "No action")
      .sort((a, b) => {
        const order = { "Act on signal": 0, "Follow up": 1, "Initial outreach": 2, "Schedule meeting": 3, "Send proposal": 4 };
        return (order[a.nextBestAction as keyof typeof order] ?? 99) - (order[b.nextBestAction as keyof typeof order] ?? 99);
      })
      .slice(0, 3);

    const contactedCount = prospectsWithAction.filter((p) => p.isContacted).length;
    const totalProspects = prospectsWithAction.length;
    const coverageSummary = totalProspects > 0
      ? { contacted: contactedCount, total: totalProspects, rolesContacted: contactedCount }
      : null;

    const collaborators = await prisma.accountCollaborator.findMany({
      where: { companyId: id },
      include: {
        user: { select: { id: true, email: true } },
        inviter: { select: { email: true } },
      },
      orderBy: { invitedAt: "desc" },
    });

    return NextResponse.json({
      company: {
        id: company.id,
        name: company.name,
        industry: company.industry,
        fitBucket: company.fitBucket,
      },
      access: access ?? "owner",
      collaborators: collaborators.map((c) => ({
        id: c.id,
        userId: c.userId,
        email: c.user.email,
        role: c.role,
        invitedBy: c.inviter.email,
        invitedAt: c.invitedAt,
        acceptedAt: c.acceptedAt,
        status: c.acceptedAt ? "accepted" : "pending",
      })),
      prospects: prospectsWithAction,
      priorityActions,
      coverage: coverageSummary,
      findings: findings.map((f) => ({ id: f.id, content: f.content, createdAt: f.createdAt })),
    });
  } catch (error) {
    console.error("GET /api/companies/[id]/account error:", error);
    return NextResponse.json(
      { error: "Failed to fetch account data" },
      { status: 500 }
    );
  }
}
