import type { Prospect, Signal } from "@/generated/prisma/client";

const WEIGHT_URGENCY = 0.4;
const WEIGHT_FRESHNESS = 0.25;
const WEIGHT_CADENCE = 0.2;
const WEIGHT_CONTENT_FIT = 0.1;
const WEIGHT_MANUAL_BOOST = 0.05;

const FRESHNESS_WINDOW_DAYS = 7;

function signalUrgencyScore(signals: Signal[]): number {
  const unacted = signals.filter((s) => !s.actedOn && !s.dismissed);
  if (unacted.length === 0) return 0;
  const maxUrgency = Math.max(...unacted.map((s) => s.urgencyScore));
  return (maxUrgency / 5) * 100;
}

function signalFreshnessScore(signals: Signal[]): number {
  const unacted = signals.filter((s) => !s.actedOn && !s.dismissed);
  if (unacted.length === 0) return 0;

  const now = Date.now();
  const freshest = Math.max(...unacted.map((s) => s.createdAt.getTime()));
  const ageDays = (now - freshest) / (1000 * 60 * 60 * 24);

  if (ageDays >= FRESHNESS_WINDOW_DAYS) return 0;
  return ((FRESHNESS_WINDOW_DAYS - ageDays) / FRESHNESS_WINDOW_DAYS) * 100;
}

function cadencePressureScore(prospect: Prospect): number {
  if (!prospect.nextFollowUpAt) return 0;

  const now = Date.now();
  const dueAt = prospect.nextFollowUpAt.getTime();
  const overdueDays = (now - dueAt) / (1000 * 60 * 60 * 24);

  if (overdueDays <= 0) return 0;
  return Math.min(overdueDays / 7, 1) * 100;
}

function contentFitScore(hasContentMatch: boolean): number {
  return hasContentMatch ? 100 : 0;
}

function manualBoostScore(prospect: Prospect): number {
  return prospect.starred ? 100 : 0;
}

export function calculatePriorityScore(
  prospect: Prospect,
  signals: Signal[],
  hasContentMatch: boolean
): number {
  const urgency = signalUrgencyScore(signals) * WEIGHT_URGENCY;
  const freshness = signalFreshnessScore(signals) * WEIGHT_FRESHNESS;
  const cadence = cadencePressureScore(prospect) * WEIGHT_CADENCE;
  const content = contentFitScore(hasContentMatch) * WEIGHT_CONTENT_FIT;
  const boost = manualBoostScore(prospect) * WEIGHT_MANUAL_BOOST;

  const raw = urgency + freshness + cadence + content + boost;
  return Math.round(Math.min(Math.max(raw, 0), 100));
}
