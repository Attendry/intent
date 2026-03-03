import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import crypto from "crypto";
import type { User as PrismaUser } from "@prisma/client";

function hashCaptureToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Gets the authenticated user from Supabase session and syncs to our User table.
 * Returns null if not authenticated.
 */
export async function getAuthenticatedUser(): Promise<PrismaUser | null> {
  const supabase = await createClient();
  const {
    data: { user: supabaseUser },
  } = await supabase.auth.getUser();

  if (!supabaseUser) return null;

  const existing = await prisma.user.findUnique({
    where: { supabaseId: supabaseUser.id },
  });

  if (existing) {
    return existing;
  }

  const created = await prisma.user.create({
    data: {
      supabaseId: supabaseUser.id,
      email: supabaseUser.email ?? undefined,
    },
  });

  await prisma.userSettings.upsert({
    where: { userId: created.id },
    create: {
      userId: created.id,
      data: JSON.stringify({
        userName: "",
        userTitle: "",
        userCompany: "",
        signatureEn: "Best,",
        signatureDe: "Viele Grüße,",
        defaultLanguage: "en",
        germanFormality: "sie",
        tonePreference: "direct",
        customInstructions: "",
        cadence: {
          defaultFollowUpDays: 14,
          coldFollowUpDays: 5,
          reEngagementDays: 30,
          escalateAfterSignals: 3,
        },
        polling: { linkedinDays: 7, newsHours: 6, rssHours: 4 },
        apiKeys: { openai: "", proxycurl: "", gnews: "" },
      }),
    },
    update: {},
  });

  return created;
}

/**
 * Requires authentication. Returns user or throws/returns 401 Response.
 */
export async function requireAuth(): Promise<
  { user: PrismaUser } | { error: Response }
> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return {
      error: new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      ),
    };
  }
  return { user };
}

/**
 * Look up user by capture token. Returns null if token is invalid.
 */
export async function getUserByCaptureToken(token: string): Promise<PrismaUser | null> {
  if (!token || token.length < 16) return null;
  const hash = hashCaptureToken(token);
  return prisma.user.findUnique({
    where: { captureTokenHash: hash },
  });
}

/**
 * Generate a new capture token for the user. Stores hash in DB, returns plain token.
 * Caller must be authenticated.
 */
export async function generateCaptureToken(userId: string): Promise<string> {
  const token = `ic_${crypto.randomBytes(24).toString("base64url")}`;
  const hash = hashCaptureToken(token);
  await prisma.user.update({
    where: { id: userId },
    data: { captureTokenHash: hash, captureTokenCreatedAt: new Date() },
  });
  return token;
}

/**
 * Verify that the given token belongs to the given user.
 */
export async function verifyCaptureToken(userId: string, token: string): Promise<boolean> {
  const user = await getUserByCaptureToken(token);
  return user?.id === userId;
}

/**
 * Auth for capture flow: session OR capture token (header X-Capture-Token or Authorization: Bearer).
 * Use for /api/capture, /api/capture/enrich, and capture-related GET /api/prospects, /api/companies.
 */
export async function getCaptureAuth(request: Request): Promise<PrismaUser | null> {
  const sessionUser = await getAuthenticatedUser();
  if (sessionUser) return sessionUser;

  const token =
    request.headers.get("x-capture-token") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (token) return getUserByCaptureToken(token);
  return null;
}
