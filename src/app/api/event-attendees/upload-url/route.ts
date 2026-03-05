import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { randomUUID } from "crypto";

const BUCKET = "event-attendees";
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;

    let body: { filename: string; eventName?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const filename = (body.filename || "").trim();
    if (!filename) {
      return NextResponse.json(
        { error: "filename is required" },
        { status: 400 }
      );
    }

    const ext = "." + (filename.split(".").pop() || "").toLowerCase();
    if (![".pdf", ".txt"].includes(ext)) {
      return NextResponse.json(
        { error: "Only PDF and TXT files are supported" },
        { status: 400 }
      );
    }

    const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${userId}/${randomUUID()}-${sanitized}`;

    return NextResponse.json({
      path,
      bucket: BUCKET,
      eventName: (body.eventName || "").trim() || undefined,
      maxBytes: MAX_FILE_BYTES,
    });
  } catch (error) {
    console.error("POST /api/event-attendees/upload-url error:", error);
    return NextResponse.json(
      { error: "Failed to create upload path" },
      { status: 500 }
    );
  }
}
