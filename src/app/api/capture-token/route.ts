import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { generateCaptureToken, verifyCaptureToken } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;

    const token = request.headers.get("x-capture-token");
    if (token) {
      const valid = await verifyCaptureToken(auth.user.id, token);
      return NextResponse.json({ valid });
    }

    return NextResponse.json({ hasAuth: true });
  } catch (error) {
    console.error("GET /api/capture-token error:", error);
    return NextResponse.json({ error: "Failed to verify token" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;

    const token = await generateCaptureToken(auth.user.id);
    return NextResponse.json({ token });
  } catch (error) {
    console.error("POST /api/capture-token error:", error);
    return NextResponse.json({ error: "Failed to generate token" }, { status: 500 });
  }
}
