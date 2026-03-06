import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { requireCompanyAccess } from "@/lib/access";

/**
 * GET /api/companies/[id]/export
 * Export account summary as Markdown for handoffs.
 * Query: ?format=md (default) or ?format=json
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;

    const { id: companyId } = await params;
    const accessResult = await requireCompanyAccess(companyId, auth.user.id, {
      allowCollaborator: true,
    });
    if ("error" in accessResult) return accessResult.error;

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "md";

    const company = await prisma.company.findFirst({
      where: { id: companyId },
      include: {
        prospects: {
          include: {
            meetingLogs: { orderBy: { createdAt: "desc" } },
            outreach: { orderBy: { createdAt: "desc" }, take: 5 },
          },
        },
        intel: { orderBy: { createdAt: "desc" } },
        documents: {
          where: { status: "completed" },
          select: { title: true, fullSummary: true },
        },
      },
    });

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const findings = await prisma.savedFinding.findMany({
      where: {
        OR: [
          { companyId },
          { prospectId: { in: company.prospects.map((p) => p.id) } },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    if (format === "json") {
      return NextResponse.json({
        company: {
          name: company.name,
          industry: company.industry,
          website: company.website,
          fitBucket: company.fitBucket,
          battlecard: company.battlecard,
        },
        intel: company.intel,
        findings,
        prospects: company.prospects.map((p) => ({
          ...p,
          meetingLogs: p.meetingLogs,
          outreach: p.outreach,
        })),
      });
    }

    const lines: string[] = [];
    lines.push(`# Account Summary: ${company.name}`);
    lines.push("");
    lines.push(`**Industry:** ${company.industry || "—"}`);
    lines.push(`**Website:** ${company.website || "—"}`);
    lines.push(`**Fit:** ${company.fitBucket || "—"}`);
    lines.push("");

    if (company.battlecard) {
      try {
        const battlecard = JSON.parse(company.battlecard) as Record<string, unknown>;
        if (battlecard && typeof battlecard === "object") {
          lines.push("## Battlecard");
          lines.push("");
          for (const [k, v] of Object.entries(battlecard)) {
            if (v && typeof v === "string") {
              lines.push(`### ${k}`);
              lines.push(v);
              lines.push("");
            }
          }
        }
      } catch {
        lines.push("## Battlecard");
        lines.push("");
        lines.push(company.battlecard);
        lines.push("");
      }
    }

    lines.push("## Intelligence");
    lines.push("");
    if (company.intel.length === 0) {
      lines.push("No intel entries.");
    } else {
      for (const i of company.intel) {
        lines.push(`- **${i.type}** (${i.date ? new Date(i.date).toLocaleDateString() : "—"}): ${i.summary}`);
        if (i.actionContext) lines.push(`  - *So what?* ${i.actionContext}`);
      }
    }
    lines.push("");

    lines.push("## Findings");
    lines.push("");
    if (findings.length === 0) {
      lines.push("No saved findings.");
    } else {
      for (const f of findings) {
        lines.push(`- ${f.content}`);
        lines.push(`  *${new Date(f.createdAt).toLocaleDateString()}*`);
      }
    }
    lines.push("");

    lines.push("## Buying Committee & Meeting Notes");
    lines.push("");
    for (const p of company.prospects) {
      lines.push(`### ${p.firstName} ${p.lastName}${p.title ? ` — ${p.title}` : ""}`);
      lines.push("");
      if (p.meetingLogs.length > 0) {
        for (const m of p.meetingLogs) {
          lines.push(`**${m.meetingDate ? new Date(m.meetingDate).toLocaleDateString() : "—"}**`);
          if (m.summary) lines.push(m.summary);
          if (m.notes) lines.push(m.notes);
          if (m.actionItems) lines.push(`*Action items:* ${m.actionItems}`);
          lines.push("");
        }
      } else {
        lines.push("No meeting notes.");
        lines.push("");
      }
    }

    const markdown = lines.join("\n");

    return new NextResponse(markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${company.name.replace(/[^a-zA-Z0-9]/g, "_")}_account_summary.md"`,
      },
    });
  } catch (error) {
    console.error("GET /api/companies/[id]/export error:", error);
    return NextResponse.json(
      { error: "Failed to export" },
      { status: 500 }
    );
  }
}
