import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const { id } = await params;
    const company = await prisma.company.findFirst({
      where: { id, userId },
      include: {
        prospects: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            title: true,
            email: true,
            roleArchetype: true,
            lastContactedAt: true,
            personaSummary: true,
          },
          orderBy: { lastName: "asc" },
        },
        intel: {
          orderBy: { createdAt: "desc" },
          include: {
            document: {
              select: { sourceUrl: true, title: true },
            },
          },
        },
        documents: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Compute viewUrl for documents (serve uploaded files via API)
    const documentsWithViewUrl = company.documents.map((doc) => ({
      ...doc,
      filePath: undefined,
      viewUrl: doc.sourceUrl
        ? doc.sourceUrl
        : doc.filePath
          ? `/api/companies/${id}/documents/serve?docId=${doc.id}`
          : null,
    }));

    // Compute viewUrl on intel entries' parent documents
    const intelWithDocUrl = company.intel.map((entry) => {
      const doc = entry.document;
      const docViewUrl = doc
        ? doc.sourceUrl || `/api/companies/${id}/documents/serve?docId=${entry.documentId}`
        : null;
      return {
        ...entry,
        document: doc ? { ...doc, viewUrl: docViewUrl } : null,
      };
    });

    return NextResponse.json({
      ...company,
      documents: documentsWithViewUrl,
      intel: intelWithDocUrl,
    });
  } catch (error) {
    console.error("GET /api/companies/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch company" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.company.findFirst({ where: { id, userId } });
    if (!existing) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.industry !== undefined) data.industry = body.industry;
    if (body.website !== undefined) data.website = body.website;
    if (body.size !== undefined) data.size = body.size;
    if (body.hqLocation !== undefined) data.hqLocation = body.hqLocation;
    if (body.notes !== undefined) data.notes = body.notes;

    const company = await prisma.company.update({ where: { id }, data });
    return NextResponse.json(company);
  } catch (error) {
    console.error("PUT /api/companies/[id] error:", error);
    return NextResponse.json({ error: "Failed to update company" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const { id } = await params;
    const existing = await prisma.company.findFirst({ where: { id, userId } });
    if (!existing) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }
    await prisma.company.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/companies/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete company" }, { status: 500 });
  }
}
