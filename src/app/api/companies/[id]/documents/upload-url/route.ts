import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { randomUUID } from "crypto";

const BUCKET = "company-documents";
const MAX_FILE_SIZE = 30 * 1024 * 1024; // 30MB

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const { id: companyId } = await params;
    const { requireCompanyAccess } = await import("@/lib/access");
    const accessResult = await requireCompanyAccess(companyId, userId, {
      allowCollaborator: true,
    });
    if ("error" in accessResult) return accessResult.error;

    const company = await prisma.company.findFirst({
      where: { id: companyId },
    });
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    let body: { filename: string; title?: string; type?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const filename = (body.filename || "").trim();
    if (!filename || !filename.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Valid PDF filename required" },
        { status: 400 }
      );
    }

    const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${companyId}/${userId}/${randomUUID()}-${sanitized}`;

    return NextResponse.json({
      path,
      bucket: BUCKET,
      title: (body.title || filename).trim(),
      type: body.type || "annual_report",
      maxBytes: MAX_FILE_SIZE,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to create upload path";
    console.error("POST /api/companies/[id]/documents/upload-url error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
