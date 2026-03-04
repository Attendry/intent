import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { documentUrlSchema, parseRequestBody } from "@/lib/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeFile, mkdir, unlink } from "fs/promises";
import { join } from "path";

const STORAGE_BUCKET = "company-documents";

const MAX_FILE_SIZE = 30 * 1024 * 1024; // 30MB
const ALLOWED_TYPES = ["application/pdf"];
const ALLOWED_EXTENSIONS = [".pdf"];

function isAllowedFile(file: File): { ok: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return { ok: false, error: `File too large. Maximum size is 30MB.` };
  }
  const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
  const typeOk = ALLOWED_TYPES.includes(file.type);
  const extOk = ALLOWED_EXTENSIONS.includes(ext);
  if (!typeOk && !extOk) {
    return { ok: false, error: `Invalid file type. Only PDF is supported.` };
  }
  return { ok: true };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const documents = await prisma.companyDocument.findMany({
      where: { companyId: id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(documents);
  } catch (error) {
    console.error("GET /api/companies/[id]/documents error:", error);
    return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const { id } = await params;
    const company = await prisma.company.findFirst({ where: { id, userId } });
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const title = (formData.get("title") as string) || "Uploaded Document";
      const type = (formData.get("type") as string) || "other";

      if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }

      const validation = isAllowedFile(file);
      if (!validation.ok) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }

      const uploadDir = join(process.cwd(), "uploads", "companies", id);
      await mkdir(uploadDir, { recursive: true });

      const fileName = `${Date.now()}-${file.name}`;
      const filePath = join(uploadDir, fileName);
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(filePath, buffer);

      const doc = await prisma.companyDocument.create({
        data: {
          companyId: id,
          title,
          type,
          filePath,
          status: "pending",
        },
      });

      const baseUrl = request.nextUrl.origin;
      const cookie = request.headers.get("cookie") || "";
      fetch(`${baseUrl}/api/companies/${id}/documents/process`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie,
        },
        body: JSON.stringify({ documentId: doc.id }),
      }).catch((err) => console.error("[documents] Process trigger failed:", err));

      return NextResponse.json(doc, { status: 201 });
    }

    const parsed = await parseRequestBody(request, documentUrlSchema);
    if ("error" in parsed) {
      console.error("[documents] Validation failed, status 400");
      return parsed.error;
    }
    const body = parsed.data;

    let sourceUrl: string;
    if (body.storagePath) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) {
        return NextResponse.json(
          { error: "Storage not configured" },
          { status: 503 }
        );
      }
      sourceUrl = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/company-documents/${body.storagePath}`;
    } else if (body.url) {
      sourceUrl = body.url;
    } else {
      return NextResponse.json(
        { error: "url or storagePath is required" },
        { status: 400 }
      );
    }

    const doc = await prisma.companyDocument.create({
      data: {
        companyId: id,
        title: body.title || "Linked Document",
        type: body.type || "other",
        sourceUrl,
        status: "pending",
      },
    });

    const baseUrl = request.nextUrl.origin;
    const cookie = request.headers.get("cookie") || "";
    fetch(`${baseUrl}/api/companies/${id}/documents/process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie,
      },
      body: JSON.stringify({ documentId: doc.id }),
    }).catch((err) => console.error("[documents] Process trigger failed:", err));

    return NextResponse.json(doc, { status: 201 });
  } catch (error) {
    console.error("POST /api/companies/[id]/documents error:", error);
    return NextResponse.json({ error: "Failed to upload document" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    const { id } = await params;
    const company = await prisma.company.findFirst({ where: { id, userId } });
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const docId = searchParams.get("docId");

    if (!docId) {
      return NextResponse.json({ error: "docId is required" }, { status: 400 });
    }

    const doc = await prisma.companyDocument.findUnique({ where: { id: docId } });
    if (!doc || doc.companyId !== id) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Delete associated intel entries
    await prisma.companyIntel.deleteMany({ where: { documentId: docId } });

    // Delete the file if it exists (local filesystem)
    if (doc.filePath) {
      try { await unlink(doc.filePath); } catch { /* file may not exist */ }
    }

    // Delete from Supabase Storage if sourceUrl points to our bucket
    if (doc.sourceUrl) {
      const match = doc.sourceUrl.match(
        /\/storage\/v1\/object\/public\/company-documents\/(.+)$/
      );
      if (match) {
        try {
          const supabase = createAdminClient();
          await supabase.storage.from(STORAGE_BUCKET).remove([match[1]]);
        } catch { /* storage may not be configured */ }
      }
    }

    await prisma.companyDocument.delete({ where: { id: docId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/companies/[id]/documents error:", error);
    return NextResponse.json({ error: "Failed to delete document" }, { status: 500 });
  }
}
