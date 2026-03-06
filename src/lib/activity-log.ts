import { prisma } from "@/lib/db";

export type ActivityAction =
  | "collaborator_added"
  | "finding_shared"
  | "handoff_requested"
  | "handoff_accepted"
  | "intel_added"
  | "meeting_logged";

/**
 * Log an account activity event for coaching and attribution.
 * Fire-and-forget; errors are logged but do not fail the caller.
 */
export async function logAccountActivity(
  companyId: string,
  userId: string,
  action: ActivityAction,
  entityType?: string,
  entityId?: string
): Promise<void> {
  try {
    await prisma.accountActivityLog.create({
      data: {
        companyId,
        userId,
        action,
        entityType: entityType ?? null,
        entityId: entityId ?? null,
      },
    });
  } catch (e) {
    console.error("[activity-log] Failed to log:", action, e);
  }
}
