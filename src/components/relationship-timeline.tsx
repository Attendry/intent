"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MEETING_OUTCOME_LABELS } from "@/lib/constants";
import {
  Mail,
  Linkedin,
  Phone,
  MessageSquare,
  Zap,
  Newspaper,
  Briefcase,
  Users,
  Calendar,
  Lock,
  Video,
} from "lucide-react";

interface TimelineSignal {
  id: string;
  type: string;
  summary: string | null;
  urgencyScore: number;
  sourceUrl: string | null;
  createdAt: string;
  private?: boolean;
}

interface TimelineOutreach {
  id: string;
  channel: string;
  messageSent: string | null;
  subjectLine: string | null;
  outcome: string;
  createdAt: string;
}

interface TimelineMeeting {
  id: string;
  notes: string | null;
  summary: string | null;
  outcome: string | null;
  meetingDate: string | null;
  suggestedStage: string | null;
  createdAt: string;
}

interface RelationshipTimelineProps {
  signals: TimelineSignal[];
  outreach: TimelineOutreach[];
  meetings?: TimelineMeeting[];
  redactedSignalIds?: Set<string>;
  onTogglePrivate?: (signalId: string, isPrivate: boolean) => void;
}

type TimelineEntry =
  | { kind: "signal"; date: Date; data: TimelineSignal }
  | { kind: "outreach"; date: Date; data: TimelineOutreach }
  | { kind: "meeting"; date: Date; data: TimelineMeeting };

const SIGNAL_TYPE_LABELS: Record<string, string> = {
  linkedin_post: "LinkedIn Post",
  company_news: "Company News",
  job_change: "Job Change",
  hiring: "Hiring",
  conference: "Conference",
  re_engagement: "Re-engagement",
  new_prospect: "New Prospect",
  other: "Other",
};

const SIGNAL_ICONS: Record<string, typeof Zap> = {
  linkedin_post: Linkedin,
  company_news: Newspaper,
  job_change: Briefcase,
  hiring: Users,
  conference: Calendar,
  re_engagement: Zap,
  new_prospect: Zap,
};

const CHANNEL_ICONS: Record<string, typeof Mail> = {
  email: Mail,
  linkedin: Linkedin,
  phone: Phone,
};

const OUTCOME_CONFIG: Record<string, { label: string; className: string }> = {
  no_response: {
    label: "No response",
    className: "bg-muted text-muted-foreground",
  },
  positive: {
    label: "Positive",
    className: "gradient-success text-white",
  },
  negative: {
    label: "Negative",
    className: "gradient-danger text-white",
  },
  meeting_booked: {
    label: "Meeting booked",
    className: "gradient-primary text-white",
  },
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function RelationshipTimeline({
  signals,
  outreach,
  meetings = [],
  redactedSignalIds,
  onTogglePrivate,
}: RelationshipTimelineProps) {
  const entries: TimelineEntry[] = [
    ...signals.map(
      (s) =>
        ({
          kind: "signal",
          date: new Date(s.createdAt),
          data: s,
        }) as const
    ),
    ...outreach.map(
      (o) =>
        ({
          kind: "outreach",
          date: new Date(o.createdAt),
          data: o,
        }) as const
    ),
    ...meetings.map(
      (m) =>
        ({
          kind: "meeting",
          date: new Date(m.meetingDate || m.createdAt),
          data: m,
        }) as const
    ),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-muted/20 py-16 text-muted-foreground">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60">
          <MessageSquare className="h-6 w-6 opacity-50" />
        </div>
        <p className="text-sm font-medium">No activity yet.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-[17px] top-3 bottom-3 w-px bg-gradient-to-b from-primary/40 via-border to-transparent" />

      <div className="flex flex-col gap-1">
        {entries.map((entry, i) => {
          if (entry.kind === "signal") {
            const s = entry.data;
            const isRedacted = redactedSignalIds?.has(s.id);
            const Icon = isRedacted ? Lock : (SIGNAL_ICONS[s.type] || Zap);

            if (isRedacted) {
              return (
                <div key={`signal-${s.id}`} className="relative flex gap-4 py-3 animate-slide-up" style={{ animationDelay: `${i * 50}ms`, animationFillMode: "both" }}>
                  <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground shadow-soft">
                    <Lock className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1 rounded-xl border border-border/60 bg-card p-4 shadow-soft opacity-60">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium">{formatDate(s.createdAt)}</span>
                      <Badge variant="signal" className="text-[10px] px-1.5 py-0">
                        {SIGNAL_TYPE_LABELS[s.type] || s.type}
                      </Badge>
                    </div>
                    <p className="mt-1.5 text-sm text-muted-foreground italic">Private note</p>
                  </div>
                </div>
              );
            }

            return (
              <div key={`signal-${s.id}`} className="relative flex gap-4 py-3 animate-slide-up" style={{ animationDelay: `${i * 50}ms`, animationFillMode: "both" }}>
                <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl gradient-info text-white shadow-soft">
                  <Icon className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1 rounded-xl border border-border/60 bg-card p-4 shadow-soft transition-shadow hover:shadow-elevated">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium">{formatDate(s.createdAt)}</span>
                    <Badge variant="signal" className="text-[10px] px-1.5 py-0">
                      {SIGNAL_TYPE_LABELS[s.type] || s.type}
                    </Badge>
                    {s.private && (
                      <button
                        onClick={() => onTogglePrivate?.(s.id, false)}
                        className="flex items-center gap-1 text-amber-500 hover:text-amber-600 transition-colors"
                        title="Private — click to make public"
                      >
                        <Lock className="h-3 w-3" />
                      </button>
                    )}
                    <span className="ml-auto font-bold text-foreground">
                      {s.urgencyScore}/5
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-foreground leading-relaxed">
                    {s.summary || "No summary"}
                  </p>
                  {s.sourceUrl && (
                    <a
                      href={s.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
                    >
                      View source
                    </a>
                  )}
                </div>
              </div>
            );
          }

          if (entry.kind === "meeting") {
            const m = entry.data;
            return (
              <div key={`meeting-${m.id}`} className="relative flex gap-4 py-3 animate-slide-up" style={{ animationDelay: `${i * 50}ms`, animationFillMode: "both" }}>
                <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500 text-white shadow-soft">
                  <Video className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1 rounded-xl border border-border/60 bg-card p-4 shadow-soft transition-shadow hover:shadow-elevated">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium">{formatDate(m.createdAt)}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      Meeting
                    </Badge>
                    {m.outcome && (
                      <span className="rounded-lg px-2 py-0.5 text-[10px] font-semibold bg-muted">
                        {MEETING_OUTCOME_LABELS[m.outcome]?.label ?? m.outcome}
                      </span>
                    )}
                  </div>
                  {(m.summary || m.notes) && (
                    <p className="mt-1.5 text-sm text-foreground leading-relaxed line-clamp-3">
                      {m.summary || m.notes}
                    </p>
                  )}
                  {m.suggestedStage && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Suggested stage: {m.suggestedStage}
                    </p>
                  )}
                </div>
              </div>
            );
          }

          const o = entry.data;
          const ChannelIcon = CHANNEL_ICONS[o.channel] || MessageSquare;
          const outcomeConfig = OUTCOME_CONFIG[o.outcome] || OUTCOME_CONFIG.no_response;

          return (
            <div key={`outreach-${o.id}`} className="relative flex gap-4 py-3 animate-slide-up" style={{ animationDelay: `${i * 50}ms`, animationFillMode: "both" }}>
              <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl gradient-success text-white shadow-soft">
                <ChannelIcon className="h-4 w-4" />
              </div>

              <div className="min-w-0 flex-1 rounded-xl border border-border/60 bg-card p-4 shadow-soft transition-shadow hover:shadow-elevated">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium">{formatDate(o.createdAt)}</span>
                  <Badge variant="success" className="text-[10px] px-1.5 py-0">
                    {o.channel}
                  </Badge>
                  <span
                    className={cn(
                      "rounded-lg px-2 py-0.5 text-[10px] font-semibold",
                      outcomeConfig.className
                    )}
                  >
                    {outcomeConfig.label}
                  </span>
                </div>
                {o.subjectLine && (
                  <p className="mt-1.5 text-xs font-semibold text-foreground">
                    {o.subjectLine}
                  </p>
                )}
                {o.messageSent && (
                  <p className="mt-1 line-clamp-2 text-sm text-foreground leading-relaxed">
                    {o.messageSent}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
