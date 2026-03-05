import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { eventAttendeesImportSchema, parseRequestBody } from "@/lib/validation";
import { extractEventAttendees } from "@/lib/ai";
import { extractTextFromUrl, extractTextFromBuffer } from "@/lib/text-extract";
import { normalizeCompanyName } from "@/lib/company-utils";

export const maxDuration = 90;

function matchKey(firstName: string, lastName: string, company: string | null): string {
  const fn = firstName.trim().toLowerCase();
  const ln = lastName.trim().toLowerCase();
  const co = company ? normalizeCompanyName(company) : "";
  return `${fn}|${ln}|${co}`;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    let url: string | undefined;
    let text: string | undefined;
    let eventName: string | undefined;

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      eventName = (formData.get("eventName") as string)?.trim() || undefined;
      if (file && file.size > 0) {
        const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
        if (file.size > MAX_FILE_BYTES) {
          return NextResponse.json(
            { error: "File too large (max 10MB)" },
            { status: 400 }
          );
        }
        const buffer = new Uint8Array(await file.arrayBuffer());
        if (buffer.length < 50) {
          return NextResponse.json(
            { error: "File too small (min 50 bytes)" },
            { status: 400 }
          );
        }
        try {
          text = await extractTextFromBuffer(buffer, file.name);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Failed to parse file";
          return NextResponse.json({ error: msg }, { status: 400 });
        }
        if (text.length < 50) {
          return NextResponse.json(
            { error: "Extracted text too short (min 50 chars)" },
            { status: 400 }
          );
        }
      } else {
        return NextResponse.json(
          { error: "file is required for form upload" },
          { status: 400 }
        );
      }
    } else {
      const parsed = await parseRequestBody(request, eventAttendeesImportSchema);
      if ("error" in parsed) return parsed.error;
      url = parsed.data.url;
      text = parsed.data.text;
      eventName = parsed.data.eventName;
    }

    let rawText: string;
    const source = url || `event:${eventName || "unknown"}`;

    if (url) {
      try {
        const result = await extractTextFromUrl(url);
        rawText = result.text;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to fetch URL";
        return NextResponse.json({ error: msg }, { status: 400 });
      }
    } else if (text) {
      rawText = text;
    } else {
      return NextResponse.json(
        { error: "url or text is required" },
        { status: 400 }
      );
    }

    if (rawText.length < 50) {
      return NextResponse.json(
        { error: "Content too short to extract attendees (min 50 chars)" },
        { status: 400 }
      );
    }

    let attendees: Awaited<ReturnType<typeof extractEventAttendees>>;
    try {
      attendees = await extractEventAttendees(userId, rawText, eventName || null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI extraction failed";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    if (attendees.length === 0) {
      return NextResponse.json({
        success: true,
        created: 0,
        skipped: 0,
        duplicates: [],
        message: "No attendees found in the content.",
      });
    }

    const [prospects, pendingSuggestions] = await Promise.all([
      prisma.prospect.findMany({
        where: { userId },
        select: { firstName: true, lastName: true, company: true },
      }),
      prisma.prospectSuggestion.findMany({
        where: { userId, status: "pending" },
        select: { firstName: true, lastName: true, company: true },
      }),
    ]);

    const existingKeys = new Set<string>();
    for (const p of prospects) {
      existingKeys.add(matchKey(p.firstName, p.lastName, p.company));
    }
    for (const s of pendingSuggestions) {
      existingKeys.add(matchKey(s.firstName, s.lastName, s.company));
    }

    const duplicates: { firstName: string; lastName: string; company: string | null; reason: string }[] = [];
    const toCreate: typeof attendees = [];

    for (const a of attendees) {
      const company = a.company ?? null;
      const key = matchKey(a.firstName, a.lastName, company);
      if (existingKeys.has(key)) {
        duplicates.push({
          firstName: a.firstName,
          lastName: a.lastName,
          company,
          reason: "already_exists",
        });
        continue;
      }
      existingKeys.add(key);
      toCreate.push(a);
    }

    const reasonText = eventName
      ? `Event attendee: ${eventName}`
      : "Event attendee (imported from URL or document)";

    for (const a of toCreate) {
      await prisma.prospectSuggestion.create({
        data: {
          userId,
          firstName: a.firstName,
          lastName: a.lastName,
          title: a.title,
          company: a.company ?? null,
          source,
          signalType: "conference",
          reason: reasonText,
          status: "pending",
        },
      });
    }

    return NextResponse.json({
      success: true,
      created: toCreate.length,
      skipped: duplicates.length,
      duplicates: duplicates.slice(0, 50),
      message:
        toCreate.length > 0
          ? `${toCreate.length} prospect(s) added for review. ${duplicates.length} duplicate(s) skipped.`
          : `All ${attendees.length} attendee(s) were duplicates.`,
    });
  } catch (error) {
    console.error("[event-attendees/import] error:", error);
    return NextResponse.json(
      { error: "Import failed" },
      { status: 500 }
    );
  }
}
