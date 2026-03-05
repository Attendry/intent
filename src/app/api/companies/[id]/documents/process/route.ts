import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { debugLog } from "@/lib/debug";
import { documentProcessSchema, parseRequestBody } from "@/lib/validation";
import { extractDocumentIntel } from "@/lib/ai";
import { createFragmentFromCompanyDocument } from "@/lib/fragment-sync";
import { readFile } from "fs/promises";

export const maxDuration = 120;

async function updateProgress(
  docId: string,
  stage: string,
  pct: number,
  error?: string
) {
  await prisma.companyDocument.update({
    where: { id: docId },
    data: {
      processingStage: stage,
      processingPct: pct,
      ...(error ? { processingError: error, status: "failed" } : {}),
    },
  });
}

async function parsePdf(buffer: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(buffer);
  const { text } = await extractText(pdf, { mergePages: true });
  return text as string;
}

async function downloadWithHeaders(url: string): Promise<Response> {
  return fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept:
        "application/pdf,text/html,application/xhtml+xml,*/*;q=0.8",
    },
    redirect: "follow",
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: companyId } = await params;

  try {
    const parsed = await parseRequestBody(request, documentProcessSchema);
    if ("error" in parsed) {
      console.error("[doc-process] Validation failed");
      return parsed.error;
    }
    const { documentId } = parsed.data;

    const doc = await prisma.companyDocument.findUnique({
      where: { id: documentId },
    });
    if (!doc || doc.companyId !== companyId) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    await prisma.companyDocument.update({
      where: { id: documentId },
      data: {
        status: "processing",
        processingStage: "downloading",
        processingPct: 5,
        processingError: null,
      },
    });

    // --- Stage 1: Download / read the file ---
    let rawBuffer: Uint8Array;
    let isPdf = false;

    try {
      if (doc.filePath) {
        debugLog("[doc-process] Reading local file:", doc.filePath);
        const fileData = await readFile(doc.filePath);
        rawBuffer = new Uint8Array(fileData);
        isPdf = doc.filePath.toLowerCase().endsWith(".pdf");
      } else if (doc.sourceUrl) {
        debugLog("[doc-process] Downloading:", doc.sourceUrl);
        const response = await downloadWithHeaders(doc.sourceUrl);

        if (!response.ok) {
          throw new Error(
            `Download failed: HTTP ${response.status} ${response.statusText}`
          );
        }

        const contentType = response.headers.get("content-type") || "";
        isPdf =
          contentType.includes("application/pdf") ||
          doc.sourceUrl.toLowerCase().endsWith(".pdf");

        const arrayBuf = await response.arrayBuffer();
        rawBuffer = new Uint8Array(arrayBuf);

        if (rawBuffer.length === 0) {
          throw new Error("Downloaded file is empty (0 bytes)");
        }

        if (rawBuffer.length < 100 && !isPdf) {
          const preview = new TextDecoder().decode(rawBuffer.slice(0, 100));
          if (
            preview.includes("<!DOCTYPE") ||
            preview.includes("Access Denied")
          ) {
            throw new Error(
              "URL returned an error page instead of the document. The file may require authentication."
            );
          }
        }

        debugLog(
          `[doc-process] Downloaded ${rawBuffer.length} bytes, isPdf=${isPdf}`
        );
      } else {
        throw new Error("No file path or source URL");
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Download failed";
      console.error("[doc-process] Download stage failed:", msg);
      await updateProgress(documentId, "downloading", 5, msg);
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    await updateProgress(documentId, "parsing", 25);

    // --- Stage 2: Parse text from the content ---
    let rawText = "";
    try {
      if (isPdf) {
        if (rawBuffer.length < 10) {
          throw new Error(
            `PDF file too small (${rawBuffer.length} bytes) — likely not a valid PDF`
          );
        }
        const header = new TextDecoder().decode(rawBuffer.slice(0, 5));
        if (!header.startsWith("%PDF")) {
          throw new Error(
            "File does not start with %PDF header — may not be a valid PDF. The URL might redirect to a login page."
          );
        }
        debugLog("[doc-process] Parsing PDF...");
        rawText = await parsePdf(rawBuffer);
      } else {
        const html = new TextDecoder().decode(rawBuffer);
        rawText = html
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

      if (rawText.length < 50) {
        throw new Error(
          `Extracted text too short (${rawText.length} chars) — document may be image-only or corrupted`
        );
      }

      debugLog(
        `[doc-process] Parsed ${rawText.length} chars of text`
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Text extraction failed";
      console.error("[doc-process] Parse stage failed:", msg);
      await updateProgress(documentId, "parsing", 25, msg);
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    await updateProgress(documentId, "extracting", 50);

    // --- Stage 3: AI extraction ---
    const truncatedText = rawText.slice(0, 100000);

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, userId: true },
    });
    if (!company) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }

    let extraction;
    try {
      debugLog(
        "[doc-process] Running AI extraction for",
        company.name
      );
      extraction = await extractDocumentIntel(
        company.userId,
        truncatedText,
        company.name,
        doc.type
      );
      debugLog(
        `[doc-process] AI extracted ${extraction.entries.length} intel entries`
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "AI extraction failed";
      console.error("[doc-process] AI stage failed:", msg);
      await updateProgress(documentId, "extracting", 50, msg);
      await prisma.companyDocument.update({
        where: { id: documentId },
        data: { rawText: truncatedText.slice(0, 10000) },
      });
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    await updateProgress(documentId, "saving", 85);

    // --- Stage 4: Save results ---
    const updatedDoc = await prisma.companyDocument.update({
      where: { id: documentId },
      data: {
        status: "completed",
        processingStage: "done",
        processingPct: 100,
        processingError: null,
        rawText: truncatedText.slice(0, 50000),
        fullSummary: extraction.fullSummary,
        processedAt: new Date(),
      },
    });

    createFragmentFromCompanyDocument({
      id: updatedDoc.id,
      companyId: updatedDoc.companyId,
      title: updatedDoc.title,
      type: updatedDoc.type,
      fullSummary: updatedDoc.fullSummary,
    }).catch((e) => console.error("[fragment-sync] companyDocument:", e));

    let intelCreated = 0;
    for (const entry of extraction.entries) {
      await prisma.companyIntel.create({
        data: {
          companyId,
          documentId,
          type: entry.type,
          summary: entry.summary,
          sourceRef: entry.sourceRef || null,
          sourceQuote: entry.sourceQuote || null,
          date: entry.date ? new Date(entry.date) : null,
          urgencyScore: entry.urgencyScore || 3,
        },
      });
      intelCreated++;
    }

    if (intelCreated > 0) {
      await prisma.company.update({
        where: { id: companyId },
        data: { intelCountSinceSynth: { increment: intelCreated } },
      });
    }

    debugLog(
      `[doc-process] Complete: ${intelCreated} intel entries saved`
    );

    const baseUrl = request.nextUrl.origin;
    fetch(`${baseUrl}/api/companies/${companyId}/synthesize`, {
      method: "POST",
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      documentId,
      fullSummary: extraction.fullSummary,
      intelCreated,
    });
  } catch (error) {
    console.error("[doc-process] unexpected error:", error);
    return NextResponse.json(
      { error: "Document processing failed" },
      { status: 500 }
    );
  }
}
