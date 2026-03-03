"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import {
  Send,
  Zap,
  AlertTriangle,
  Clock,
  Loader2,
  AlertCircle,
  TrendingUp,
  UserX,
  Trophy,
  ListPlus,
  BarChart3,
} from "lucide-react";
import { formatDaysAgo } from "@/lib/format";
import { CONTENT_TYPE_LABELS } from "@/lib/constants";

interface ReviewData {
  outreachThisWeek: number;
  outreachLastWeek: number;
  outreachWoW: number;
  responseRate: number;
  meetingsBooked: number;
  signalsThisWeek: number;
  overdueFollowUps: number;
  unactedProspects: {
    id: string;
    firstName: string;
    lastName: string;
    company: string | null;
    signalCount: number;
    highestUrgency: number;
  }[];
  staleProspects: {
    id: string;
    firstName: string;
    lastName: string;
    company: string | null;
    lastContactedAt: string | null;
  }[];
  topContent: {
    id: string;
    title: string;
    type: string;
    timesUsed: number;
    positiveOutcomes?: number;
    meetingsBooked?: number;
  }[];
  staleDays: number;
}

function urgencyColor(urgency: number): string {
  if (urgency >= 4) return "text-destructive font-bold";
  if (urgency >= 3) return "text-amber-600 dark:text-amber-400 font-bold";
  return "text-muted-foreground font-semibold";
}

export default function ReviewPage() {
  const [data, setData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingToQueue, setAddingToQueue] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/review");
        if (!res.ok) throw new Error("Failed to load review data");
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load review");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const addStaleToQueue = async () => {
    if (!data?.staleProspects.length) return;
    setAddingToQueue(true);
    try {
      let added = 0;
      for (const prospect of data.staleProspects) {
        const res = await fetch("/api/signals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prospectId: prospect.id,
            type: "other",
            summary: `Re-engagement: no contact in 30+ days`,
            urgencyScore: 2,
            outreachAngle: "Check in and re-engage the relationship.",
          }),
        });
        if (res.ok) added++;
      }
      toast(`Added ${added} stale prospect${added !== 1 ? "s" : ""} to queue`, "success");
    } catch {
      toast("Failed to add prospects to queue", "error");
    } finally {
      setAddingToQueue(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mb-4 h-8 w-8 animate-spin" />
        <p className="text-sm font-medium">Loading weekly review...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <AlertCircle className="mb-3 h-8 w-8 text-destructive" />
        <p className="mb-4 text-sm font-medium text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl animate-fade-in">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary text-white shadow-soft">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Weekly Review</h1>
          <p className="text-sm text-muted-foreground">Track your outreach performance and identify opportunities.</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <SummaryCard
          label="Outreach Sent"
          value={data.outreachThisWeek}
          icon={<Send className="h-5 w-5" />}
          color="success"
          sub={data.outreachWoW !== 0 ? `${data.outreachWoW > 0 ? "+" : ""}${data.outreachWoW}% vs last week` : undefined}
        />
        <SummaryCard
          label="Response Rate"
          value={`${data.responseRate}%`}
          icon={<Send className="h-5 w-5" />}
          color="success"
        />
        <SummaryCard
          label="Meetings Booked"
          value={data.meetingsBooked}
          icon={<Send className="h-5 w-5" />}
          color="success"
        />
        <SummaryCard
          label="Signals Detected"
          value={data.signalsThisWeek}
          icon={<Zap className="h-5 w-5" />}
          color="info"
        />
        <SummaryCard
          label="Not Acted On"
          value={data.unactedProspects.length}
          icon={<AlertTriangle className="h-5 w-5" />}
          color="warning"
        />
        <SummaryCard
          label="Overdue Follow-ups"
          value={data.overdueFollowUps}
          icon={<Clock className="h-5 w-5" />}
          color="danger"
        />
      </div>

      {/* Missed Opportunities */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5 text-base">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg gradient-warning text-white">
              <UserX className="h-3.5 w-3.5" />
            </div>
            Missed Opportunities
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.unactedProspects.length === 0 ? (
            <p className="py-6 text-center text-sm font-medium text-muted-foreground">
              No unacted signals — you&apos;re on top of things.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border/60">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Prospect
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Company
                    </th>
                    <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Signals
                    </th>
                    <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Urgency
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.unactedProspects.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-5 py-3">
                        <Link
                          href={`/prospects/${p.id}`}
                          className="font-semibold text-foreground hover:text-primary transition-colors"
                        >
                          {p.firstName} {p.lastName}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {p.company || "—"}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <Badge variant="secondary" className="text-xs">
                          {p.signalCount}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={urgencyColor(p.highestUrgency)}>
                          {p.highestUrgency}/5
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stale Prospects */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2.5 text-base">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg gradient-info text-white">
                <TrendingUp className="h-3.5 w-3.5" />
              </div>
              Stale Prospects
              <span className="text-xs font-normal text-muted-foreground">
                ({data.staleDays}+ days since last contact)
              </span>
            </CardTitle>
            {data.staleProspects.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={addStaleToQueue}
                disabled={addingToQueue}
              >
                {addingToQueue ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ListPlus className="h-3.5 w-3.5" />
                )}
                Add all to queue
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {data.staleProspects.length === 0 ? (
            <p className="py-6 text-center text-sm font-medium text-muted-foreground">
              No stale prospects — all contacts are active.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border/60">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Prospect
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Company
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Last Contacted
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.staleProspects.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-5 py-3">
                        <Link
                          href={`/prospects/${p.id}`}
                          className="font-semibold text-foreground hover:text-primary transition-colors"
                        >
                          {p.firstName} {p.lastName}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {p.company || "—"}
                      </td>
                      <td className="px-5 py-3 text-right text-xs text-muted-foreground">
                        {formatDaysAgo(p.lastContactedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Performing Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5 text-base">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400 text-white">
              <Trophy className="h-3.5 w-3.5" />
            </div>
            Top Performing Content
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.topContent.length === 0 ? (
            <p className="py-6 text-center text-sm font-medium text-muted-foreground">
              No content has been used yet. Add content in the{" "}
              <Link href="/content" className="text-primary hover:underline font-semibold">
                Content Library
              </Link>
              .
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border/60">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      #
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Title
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Type
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Used
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Positive
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Meetings
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.topContent.map((c, i) => (
                    <tr
                      key={c.id}
                      className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-5 py-3 text-muted-foreground font-medium">
                        {i + 1}
                      </td>
                      <td className="px-5 py-3 font-semibold text-foreground">
                        {c.title}
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant="outline" className="text-xs">
                          {CONTENT_TYPE_LABELS[c.type] || c.type}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-right font-bold">
                        {c.timesUsed}
                      </td>
                      <td className="px-5 py-3 text-right text-muted-foreground">
                        {c.positiveOutcomes ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-right text-muted-foreground">
                        {c.meetingsBooked ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  color,
  sub,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: "success" | "info" | "warning" | "danger";
  sub?: string;
}) {
  const gradients = {
    success: "gradient-success",
    info: "gradient-info",
    warning: "gradient-warning",
    danger: "gradient-danger",
  };

  return (
    <Card className="relative overflow-hidden">
      <div className={`absolute -right-4 -top-4 h-20 w-20 rounded-full ${gradients[color]} opacity-10 blur-xl`} />
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${gradients[color]} text-white shadow-soft`}>
          {icon}
        </div>
        <div>
          <p className="text-3xl font-bold tracking-tight text-foreground">{value}</p>
          <p className="text-xs font-semibold text-muted-foreground">{label}</p>
          {sub && <p className="text-[10px] text-muted-foreground/80 mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
