"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import {
  Linkedin,
  Newspaper,
  Rss,
  Clock,
  ChevronDown,
  FileText,
  X,
  Send,
  Calendar,
  Briefcase,
  UserPlus,
  Users,
  RefreshCw,
  Lightbulb,
  Share2,
  DollarSign,
  Handshake,
  UserCog,
  TrendingUp,
  AlertTriangle,
  Shield,
  Target,
  ChevronRight,
} from "lucide-react";
import { getInitials, timeAgo, formatDate } from "@/lib/format";

interface QueueSignal {
  id: string;
  type: string;
  summary: string | null;
  sourceUrl: string | null;
  urgencyScore: number;
  createdAt: string;
  outreachAngle: string | null;
}

interface FollowUpReason {
  lastContactedAt: string | null;
  lastChannel: string | null;
  lastOutcome: string | null;
  daysOverdue: number;
}

interface ContentSuggestion {
  id: string;
  title: string;
  type: string;
}

export interface QueueItemData {
  prospect: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    title: string | null;
    company: string | null;
    industry: string | null;
    linkedinUrl: string | null;
    personaSummary: string | null;
    starred: boolean;
    preferredLang: string;
    lastContactedAt: string | null;
    nextFollowUpAt: string | null;
  };
  signal?: QueueSignal;
  followUpReason?: FollowUpReason;
  suggestedReason?: string;
  score: number;
  contentSuggestions: ContentSuggestion[];
  queueType: "signal" | "followup" | "suggested";
}

interface QueueCardProps {
  item: QueueItemData;
  onDismiss: (signalId: string) => void;
  onSnooze: (signalId: string, until: string) => void;
  onReviewSend: (item: QueueItemData) => void;
}

const SOURCE_ICONS: Record<string, typeof Linkedin> = {
  linkedin_post: Linkedin,
  company_news: Newspaper,
  rss: Rss,
  job_change: Briefcase,
  hiring: Newspaper,
  conference: Calendar,
  re_engagement: RefreshCw,
  new_prospect: UserPlus,
  funding: DollarSign,
  partnership: Handshake,
  leadership_change: UserCog,
  earnings: TrendingUp,
  strategy: Lightbulb,
  risk: AlertTriangle,
  competitor: Shield,
  buying_signal: Target,
  objection: AlertTriangle,
  next_step: ChevronRight,
  competitor_mention: Users,
  timing: Clock,
};

function getUrgencyGradient(score: number) {
  if (score >= 4) return "gradient-danger";
  if (score >= 3) return "gradient-warning";
  return "gradient-info";
}

function getAvatarGradient(queueType: string, urgency: number) {
  if (queueType === "suggested") return "gradient-primary";
  if (urgency >= 4) return "gradient-danger";
  if (urgency >= 3) return "gradient-warning";
  return "gradient-primary";
}

export default function QueueCard({ item, onDismiss, onSnooze, onReviewSend }: QueueCardProps) {
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);
  const [showDismissConfirm, setShowDismissConfirm] = useState(false);
  const snoozeRef = useRef<HTMLDivElement>(null);
  const { prospect, signal, followUpReason, suggestedReason, contentSuggestions, queueType } = item;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (snoozeRef.current && !snoozeRef.current.contains(e.target as Node)) {
        setShowSnoozeMenu(false);
      }
    };
    if (showSnoozeMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showSnoozeMenu]);
  const urgency = signal?.urgencyScore ?? (queueType === "suggested" ? 1 : 2);

  const SourceIcon = signal
    ? (SOURCE_ICONS[signal.type] || Newspaper)
    : queueType === "suggested"
      ? Lightbulb
      : Clock;

  const handleSnooze = (days: number) => {
    if (!signal) return;
    const until = new Date();
    until.setDate(until.getDate() + days);
    onSnooze(signal.id, until.toISOString());
    setShowSnoozeMenu(false);
  };

  return (
    <Card className="group relative overflow-hidden hover:shadow-elevated hover:border-border transition-all duration-300">
      <div className="flex items-start gap-4 p-5">
        {/* Avatar */}
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white shadow-soft",
            getAvatarGradient(queueType, urgency)
          )}
        >
          {getInitials(prospect.firstName, prospect.lastName)}
        </div>

        {/* Main content */}
        <div className="min-w-0 flex-1 overflow-hidden">
          {/* Name row */}
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href={`/prospects/${prospect.id}`}
              className="min-w-0 truncate text-sm font-semibold text-foreground hover:text-primary transition-colors"
            >
              {prospect.firstName} {prospect.lastName}
            </Link>
            {prospect.starred && (
              <span className="text-amber-400" title="Starred">&#9733;</span>
            )}
            {queueType === "suggested" && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1">
                <Lightbulb className="h-2.5 w-2.5" />
                Suggested
              </Badge>
            )}
          </div>

          {/* Title + company */}
          {(prospect.title || prospect.company) && (
            <p className="truncate text-[13px] text-muted-foreground mt-0.5">
              {prospect.title}{prospect.title && prospect.company ? " at " : ""}{prospect.company}
            </p>
          )}

          {/* Signal line */}
          {queueType === "signal" && signal && (
            <div className="mt-2.5 flex min-w-0 items-start gap-2 text-xs text-muted-foreground">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 mt-0.5">
                <SourceIcon className="h-3 w-3 text-primary" />
              </div>
              <p className="min-w-0 flex-1 line-clamp-2 font-medium break-words" title={signal.summary || undefined}>
                {signal.summary || signal.type.replace(/_/g, " ")}
              </p>
              <span className="shrink-0 text-[10px] text-muted-foreground/70">{timeAgo(signal.createdAt)}</span>
            </div>
          )}

          {/* Follow-up line */}
          {queueType === "followup" && followUpReason && (
            <div className="mt-2.5 flex min-w-0 items-start gap-2 text-xs text-muted-foreground">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-amber-500/10 mt-0.5">
                <Clock className="h-3 w-3 text-amber-600 dark:text-amber-400" />
              </div>
              <p className="min-w-0 flex-1 line-clamp-2 break-words">
                Follow-up due
                {followUpReason.lastContactedAt && (
                  <> &middot; Last contact {formatDate(followUpReason.lastContactedAt)}</>
                )}
                {followUpReason.lastChannel && (
                  <> via {followUpReason.lastChannel}</>
                )}
                {followUpReason.daysOverdue > 0 && (
                  <span className="font-semibold text-destructive">
                    {" "}&middot; {followUpReason.daysOverdue}d overdue
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Suggested line */}
          {queueType === "suggested" && suggestedReason && (
            <div className="mt-2.5 flex min-w-0 items-start gap-2 text-xs text-muted-foreground">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 mt-0.5">
                <Lightbulb className="h-3 w-3 text-primary" />
              </div>
              <p className="min-w-0 flex-1 line-clamp-2 font-medium break-words" title={suggestedReason}>
                {suggestedReason}
              </p>
            </div>
          )}

          {/* Urgency bar + content matches */}
          {queueType !== "suggested" && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-medium text-muted-foreground/70 mr-1">Urgency</span>
                {Array.from({ length: 5 }, (_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-1.5 w-5 rounded-full transition-all duration-300",
                      i < urgency ? getUrgencyGradient(urgency) : "bg-muted"
                    )}
                  />
                ))}
              </div>
              {contentSuggestions.length > 0 && (
                <div className="min-w-0 overflow-hidden rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1.5">
                  <p className="truncate text-[10px] font-semibold text-primary mb-1">Recommended content — use in draft</p>
                  <div className="flex min-w-0 flex-wrap gap-1.5">
                    {contentSuggestions.map((c) => (
                      <Badge key={c.id} variant="secondary" className="gap-1 text-[10px] py-0.5 px-2">
                        <FileText className="h-2.5 w-2.5" />
                        <span className="max-w-[100px] truncate">{c.title}</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            size="sm"
            onClick={() => onReviewSend(item)}
            className="gap-1.5"
          >
            <Send className="h-3.5 w-3.5" />
            {queueType === "suggested" ? "Reach Out" : "Review & Send"}
          </Button>
          <Link
            href={`/social-posts?prospectId=${prospect.id}${signal ? `&signalId=${signal.id}` : ""}`}
            className="inline-flex"
          >
            <Button variant="outline" size="sm" className="gap-1.5" title="Create social post">
              <Share2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Post</span>
            </Button>
          </Link>

          {queueType !== "suggested" && (
            <>
              <div className="relative" ref={snoozeRef}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSnoozeMenu(!showSnoozeMenu)}
                  className="gap-1"
                  disabled={!signal}
                >
                  <Clock className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Snooze</span>
                  <ChevronDown className="h-3 w-3" />
                </Button>

                {showSnoozeMenu && (
                  <div className="absolute right-0 top-full z-20 mt-1.5 w-40 rounded-xl border border-border/60 bg-card p-1.5 shadow-float animate-scale-in">
                    {[
                      { label: "Tomorrow", days: 1 },
                      { label: "Next week", days: 7 },
                      { label: "In 2 weeks", days: 14 },
                      { label: "In 1 month", days: 30 },
                    ].map(({ label, days }) => (
                      <button
                        key={days}
                        onClick={() => handleSnooze(days)}
                        className="flex w-full items-center rounded-lg px-3 py-2 text-xs font-medium hover:bg-muted transition-colors"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => signal && setShowDismissConfirm(true)}
                disabled={!signal}
                className="text-muted-foreground hover:text-destructive"
                title="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </Button>

              <ConfirmDialog
                open={showDismissConfirm}
                onOpenChange={setShowDismissConfirm}
                title="Dismiss signal?"
                description="This will remove this signal from your queue. You can always add it back manually."
                confirmLabel="Dismiss"
                variant="destructive"
                onConfirm={() => signal && onDismiss(signal.id)}
              />
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
