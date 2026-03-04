import type { Prospect, Signal } from "@/generated/prisma/client";
import { addDays, isPast } from "date-fns";

export interface CadenceSettings {
  email: { initialDelayDays: number; followUpIntervalDays: number; maxTouches: number };
  linkedin: { initialDelayDays: number; followUpIntervalDays: number; maxTouches: number };
  phone: { initialDelayDays: number; followUpIntervalDays: number; maxTouches: number };
  escalationThreshold: number;
  cooldownDays: number;
}

export function getDefaultSettings(): CadenceSettings {
  return {
    email: { initialDelayDays: 0, followUpIntervalDays: 5, maxTouches: 4 },
    linkedin: { initialDelayDays: 1, followUpIntervalDays: 7, maxTouches: 3 },
    phone: { initialDelayDays: 2, followUpIntervalDays: 10, maxTouches: 2 },
    escalationThreshold: 3,
    cooldownDays: 30,
  };
}

export type OutreachOutcome = "no_response" | "positive" | "negative" | "meeting_booked";

export interface OutcomeCadenceRules {
  no_response_days?: number;
  positive_days?: number;
  negative_days?: number;
  meeting_booked_days?: number | null; // null = no follow-up (handoff)
}

export function calculateNextFollowUp(
  channel: string,
  outreachDate: Date,
  cadenceSettings?: CadenceSettings,
  outcome?: OutreachOutcome,
  outcomeRules?: OutcomeCadenceRules
): Date | null {
  if (outcome === "meeting_booked" && outcomeRules?.meeting_booked_days === null) {
    return null;
  }
  if (outcome === "negative" && outcomeRules?.negative_days === null) {
    return null;
  }

  const rules = outcomeRules || {};
  let days: number;
  if (outcome === "positive" && rules.positive_days !== undefined) {
    days = rules.positive_days;
  } else if (outcome === "meeting_booked" && rules.meeting_booked_days !== undefined && rules.meeting_booked_days !== null) {
    days = rules.meeting_booked_days;
  } else if (outcome === "negative" && rules.negative_days !== undefined) {
    days = rules.negative_days;
  } else if (outcome === "no_response" && rules.no_response_days !== undefined) {
    days = rules.no_response_days;
  } else {
    const settings = cadenceSettings || getDefaultSettings();
    const channelKey = channel as keyof Pick<CadenceSettings, "email" | "linkedin" | "phone">;
    const channelSettings = settings[channelKey] || settings.email;
    days = channelSettings.followUpIntervalDays;
  }

  return addDays(outreachDate, days);
}

export function getOverdueProspects(
  prospects: (Prospect & { outreach?: { channel: string; createdAt: Date }[] })[],
  settings?: CadenceSettings
): Prospect[] {
  return prospects.filter((p) => {
    if (!p.nextFollowUpAt) return false;
    return isPast(p.nextFollowUpAt);
  });
}

export function shouldEscalate(
  prospect: Prospect,
  signals: Signal[],
  settings?: CadenceSettings
): boolean {
  const resolvedSettings = settings || getDefaultSettings();
  const unactedSignals = signals.filter((s) => !s.actedOn && !s.dismissed);
  return unactedSignals.length >= resolvedSettings.escalationThreshold;
}
