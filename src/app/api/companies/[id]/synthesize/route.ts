import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateAccountSynthesis } from "@/lib/ai";
import { requireAuth } from "@/lib/auth";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const company = await prisma.company.findFirst({
      where: { id, userId },
      include: {
        intel: { orderBy: { createdAt: "desc" } },
        documents: {
          where: { status: "completed" },
          select: { fullSummary: true, title: true },
        },
        prospects: {
          select: {
            firstName: true,
            lastName: true,
            title: true,
            roleArchetype: true,
            personaSummary: true,
            signals: {
              where: { actedOn: false, dismissed: false, private: false },
              orderBy: { createdAt: "desc" },
              take: 5,
              select: { summary: true, type: true },
            },
          },
        },
      },
    });

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    await prisma.company.update({
      where: { id },
      data: { synthStatus: "pending", synthError: null },
    });

    try {
      const result = await generateAccountSynthesis({
        userId,
        companyName: company.name,
        industry: company.industry || undefined,
        intel: company.intel.map((i) => ({
          id: i.id,
          type: i.type,
          summary: i.summary,
          date: i.date?.toISOString().split("T")[0],
        })),
        documentSummaries: company.documents
          .filter((d) => d.fullSummary)
          .map((d) => `${d.title}: ${d.fullSummary}`),
        prospects: company.prospects.map((p) => ({
          name: `${p.firstName} ${p.lastName}`,
          title: p.title || undefined,
          roleArchetype: p.roleArchetype || undefined,
          personaSummary: p.personaSummary || undefined,
          recentSignals: p.signals.map((s) => `[${s.type}] ${s.summary || ""}`),
        })),
      });

      // Update action contexts on intel entries
      for (const [intelId, context] of Object.entries(result.actionContexts)) {
        await prisma.companyIntel.update({
          where: { id: intelId },
          data: { actionContext: context },
        }).catch(() => {});
      }

      await prisma.company.update({
        where: { id },
        data: {
          battlecard: JSON.stringify(result.battlecard),
          roleBriefingCache: JSON.stringify(result.roleBriefings),
          lastSynthesizedAt: new Date(),
          synthStatus: "completed",
          synthError: null,
          intelCountSinceSynth: 0,
        },
      });

      // Auto-trigger fit analysis if company profile is published
      const profile = await prisma.companyProfile.findUnique({
        where: { userId },
        select: { status: true },
      }).catch(() => null);

      if (profile?.status === "published") {
        const baseUrl = _request.nextUrl.origin;
        fetch(`${baseUrl}/api/companies/${id}/fit`, { method: "POST" }).catch(() => {});
      }

      return NextResponse.json({ success: true, synthStatus: "completed" });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Synthesis failed";
      console.error("[synthesize] AI call failed:", err);

      await prisma.company.update({
        where: { id },
        data: { synthStatus: "failed", synthError: errorMessage },
      });

      return NextResponse.json({ error: errorMessage, synthStatus: "failed" }, { status: 500 });
    }
  } catch (error) {
    console.error("[synthesize] error:", error);
    return NextResponse.json({ error: "Synthesis failed" }, { status: 500 });
  }
}
