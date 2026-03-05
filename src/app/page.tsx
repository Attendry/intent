"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import QueueCard, { type QueueItemData } from "@/components/queue-card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import Link from "next/link";
import {
  Zap,
  Clock,
  ArrowUpDown,
  Inbox,
  Loader2,
  Target,
  TrendingUp,
  CheckSquare,
  Square,
  X,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import LandingPage from "@/components/landing-page";

type FilterTab = "all" | "signal" | "followup" | "suggested";
type SortKey = "priority" | "recent" | "company" | "cadence";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function HomePage() {
  const [user, setUser] = useState<{ id: string } | null | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user: u } }) => setUser(u ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (user === undefined) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (user === null) {
    return <LandingPage />;
  }

  return <DashboardContent />;
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const filterParam = searchParams.get("filter") as FilterTab | null;
  const [items, setItems] = useState<QueueItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [sort, setSort] = useState<SortKey>("priority");

  useEffect(() => {
    if (filterParam && ["all", "signal", "followup", "suggested"].includes(filterParam)) {
      setFilter(filterParam as FilterTab);
    }
  }, [filterParam]);
  const [signalCount, setSignalCount] = useState(0);
  const [followUpCount, setFollowUpCount] = useState(0);
  const [suggestedCount, setSuggestedCount] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [briefItems, setBriefItems] = useState<Array<{
    id: string;
    type: string;
    prospectName: string;
    companyName: string | null;
    summary: string;
    nextBestAction: string;
    ctaUrl: string;
    sourceAttribution?: string;
  }>>([]);
  const [briefLoading, setBriefLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchQueue = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const res = await fetch("/api/queue", { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error("Failed to fetch queue");
      const text = await res.text();
      let data: { items?: QueueItemData[]; signalCount?: number; followUpCount?: number; suggestedCount?: number };
      try {
        data = text ? JSON.parse(text) : { items: [], signalCount: 0, followUpCount: 0, suggestedCount: 0 };
      } catch {
        throw new Error("Invalid response from server");
      }
      setItems(data.items || []);
      setSignalCount(data.signalCount || 0);
      setFollowUpCount(data.followUpCount || 0);
      setSuggestedCount(data.suggestedCount || 0);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.name === "AbortError"
            ? "Request timed out. Please try again."
            : err.message
          : "Failed to load queue"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const fetchBrief = useCallback(async () => {
    try {
      const res = await fetch("/api/brain/brief");
      if (res.ok) {
        const data = await res.json();
        setBriefItems(data.items || []);
      }
    } catch {
      setBriefItems([]);
    } finally {
      setBriefLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBrief();
  }, [fetchBrief]);

  const handleDismiss = async (signalId: string) => {
    const dismissedItem = items.find((i) => i.signal?.id === signalId);
    setItems((prev) => prev.filter((i) => i.signal?.id !== signalId));

    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);

    const timer = setTimeout(async () => {
      try {
        await fetch(`/api/signals/${signalId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dismissed: true }),
        });
      } catch {
        if (dismissedItem) {
          setItems((prev) => [...prev, dismissedItem]);
        }
        toast("Failed to dismiss signal", "error");
      }
    }, 5000);

    undoTimerRef.current = timer;

    toast("Signal dismissed.", "info", {
      action: {
        label: "Undo",
        onClick: (dismiss) => {
          clearTimeout(timer);
          undoTimerRef.current = null;
          if (dismissedItem) {
            setItems((prev) => [...prev, dismissedItem]);
            toast("Dismiss undone", "success");
          }
          dismiss();
        },
      },
    });
  };

  const handleSnooze = async (signalId: string, until: string) => {
    try {
      await fetch(`/api/signals/${signalId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snoozedUntil: until }),
      });
      setItems((prev) => prev.filter((i) => i.signal?.id !== signalId));
      toast("Signal snoozed", "success");
    } catch {
      toast("Failed to snooze signal", "error");
    }
  };

  const handleReviewSend = (item: QueueItemData) => {
    const signalParam = item.signal ? `&signalId=${item.signal.id}` : "";
    router.push(`/prospects/${item.prospect.id}?action=draft${signalParam}`);
  };

  const getItemKey = (item: QueueItemData) => item.prospect.id + (item.signal?.id || "followup");

  const toggleSelect = (item: QueueItemData) => {
    const key = getItemKey(item);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(sorted.map(getItemKey)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBatchDismiss = async () => {
    const selectedItems = sorted.filter((item) => selectedIds.has(getItemKey(item)));
    const signalItems = selectedItems.filter((item) => item.signal);
    if (signalItems.length === 0) {
      toast("No dismissable items selected", "error");
      return;
    }

    setItems((prev) => prev.filter((item) => !selectedIds.has(getItemKey(item))));
    setSelectedIds(new Set());

    const failed: string[] = [];
    await Promise.allSettled(
      signalItems.map(async (item) => {
        try {
          await fetch(`/api/signals/${item.signal!.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dismissed: true }),
          });
        } catch {
          failed.push(item.prospect.firstName);
        }
      })
    );

    if (failed.length > 0) {
      toast(`Failed to dismiss ${failed.length} item(s)`, "error");
      fetchQueue();
    } else {
      toast(`Dismissed ${signalItems.length} item(s)`, "success");
    }
  };

  const handleBatchSnooze = async (days: number) => {
    const selectedItems = sorted.filter((item) => selectedIds.has(getItemKey(item)));
    const signalItems = selectedItems.filter((item) => item.signal);
    if (signalItems.length === 0) {
      toast("No snoozable items selected", "error");
      return;
    }

    const until = new Date();
    until.setDate(until.getDate() + days);

    setItems((prev) => prev.filter((item) => !selectedIds.has(getItemKey(item))));
    setSelectedIds(new Set());

    await Promise.allSettled(
      signalItems.map((item) =>
        fetch(`/api/signals/${item.signal!.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ snoozedUntil: until.toISOString() }),
        })
      )
    );

    toast(`Snoozed ${signalItems.length} item(s) for ${days} day(s)`, "success");
  };

  const sorted = useMemo(() => {
    const filtered = items.filter((item) => {
      if (filter === "signal") return item.queueType === "signal";
      if (filter === "followup") return item.queueType === "followup";
      if (filter === "suggested") return item.queueType === "suggested";
      return true;
    });

    return [...filtered].sort((a, b) => {
      switch (sort) {
        case "recent": {
          const aDate = a.signal?.createdAt || a.prospect.lastContactedAt || "";
          const bDate = b.signal?.createdAt || b.prospect.lastContactedAt || "";
          return new Date(bDate).getTime() - new Date(aDate).getTime();
        }
        case "company":
          return (a.prospect.company || "").localeCompare(b.prospect.company || "");
        case "cadence": {
          const aOverdue = a.followUpReason?.daysOverdue ?? 0;
          const bOverdue = b.followUpReason?.daysOverdue ?? 0;
          return bOverdue - aOverdue;
        }
        default:
          return b.score - a.score;
      }
    });
  }, [items, filter, sort]);

  const total = items.length;
  const hasSelection = selectedIds.size > 0;

  return (
    <div className="mx-auto max-w-4xl animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {getGreeting()}.
        </h1>
        <p className="mt-1.5 text-base text-muted-foreground">
          {loading ? (
            "Loading your queue..."
          ) : total === 0 ? (
            "No prospects to reach out to today."
          ) : (
            <>{total} prospect{total !== 1 ? "s" : ""} to reach out to today.</>
          )}
        </p>
      </div>

      {/* Today's Brief */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Today&apos;s Brief
        </h2>
        {briefLoading ? (
          <div className="rounded-xl border border-border/60 bg-card p-6">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading priorities...
            </div>
          </div>
        ) : briefItems.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Your daily priorities will appear here. Add prospects and companies to get started.
            </p>
            <Link href="/prospects/import" className="mt-2 inline-block text-sm text-primary hover:underline">
              Import prospects
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border border-border/60 bg-card divide-y divide-border/60">
            {briefItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-4 p-4 hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    {item.prospectName}
                    {item.companyName && (
                      <span className="text-muted-foreground font-normal"> at {item.companyName}</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {item.summary}
                    {item.sourceAttribution && (
                      <span className="ml-1">— {item.sourceAttribution}</span>
                    )}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="shrink-0 gap-1"
                  onClick={() => router.push(item.ctaUrl)}
                >
                  {item.nextBestAction}
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filter stats + sort */}
      <div className="mb-6 flex flex-col gap-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {loading ? (
            <>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-7 w-12" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <>
            <StatCard
              label="Total Queue"
              value={total}
              icon={<Target className="h-4 w-4" />}
              gradient="gradient-primary"
              active={filter === "all"}
              onClick={() => setFilter("all")}
            />
            <StatCard
              label="Active Signals"
              value={signalCount}
              icon={<Zap className="h-4 w-4" />}
              gradient="gradient-info"
              active={filter === "signal"}
              onClick={() => setFilter("signal")}
            />
            <StatCard
              label="Follow-ups Due"
              value={followUpCount}
              icon={<Clock className="h-4 w-4" />}
              gradient="gradient-warning"
              active={filter === "followup"}
              onClick={() => setFilter("followup")}
            />
            <StatCard
              label="Suggested"
              value={suggestedCount}
              icon={<TrendingUp className="h-4 w-4" />}
              gradient="gradient-success"
              active={filter === "suggested"}
              onClick={() => setFilter("suggested")}
            />
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
          {loading ? (
            <Skeleton className="h-9 w-[140px] rounded-xl" />
          ) : (
            <Select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-9 w-auto min-w-[140px] rounded-xl px-3 text-xs font-medium"
            >
              <option value="priority">Priority</option>
              <option value="recent">Recent signals</option>
              <option value="company">Company</option>
              <option value="cadence">Cadence urgency</option>
            </Select>
          )}
        </div>
      </div>

      {/* Batch action bar */}
      {hasSelection && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 animate-slide-up">
          <span className="text-sm font-semibold text-foreground">{selectedIds.size} selected</span>
          <div className="flex items-center gap-2 ml-auto">
            <Button size="sm" variant="outline" onClick={() => handleBatchSnooze(1)} className="text-xs">
              Snooze 1d
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleBatchSnooze(7)} className="text-xs">
              Snooze 7d
            </Button>
            <Button size="sm" variant="outline" onClick={handleBatchDismiss} className="text-xs text-destructive hover:text-destructive">
              Dismiss All
            </Button>
            <Button size="sm" variant="ghost" onClick={clearSelection} className="text-xs gap-1">
              <X className="h-3 w-3" /> Clear
            </Button>
          </div>
        </div>
      )}

      {/* Queue list */}
      {loading ? (
        <QueueSkeleton />
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-24">
          <p className="text-sm text-destructive mb-4 font-medium">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchQueue}>
            Retry
          </Button>
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <div className="flex flex-col gap-3">
          {sorted.length > 1 && (
            <div className="flex items-center gap-2 mb-1">
              <button
                onClick={hasSelection ? clearSelection : selectAll}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {hasSelection ? (
                  <CheckSquare className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Square className="h-3.5 w-3.5" />
                )}
                {hasSelection ? "Deselect all" : "Select all"}
              </button>
            </div>
          )}
          {sorted.map((item, i) => (
            <div key={getItemKey(item)} className="flex items-start gap-2 animate-slide-up" style={{ animationDelay: `${Math.min(i, 12) * 40}ms`, animationFillMode: "both" }}>
              <button
                onClick={() => toggleSelect(item)}
                className="mt-5 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              >
                {selectedIds.has(getItemKey(item)) ? (
                  <CheckSquare className="h-4 w-4 text-primary" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
              </button>
              <div className="flex-1">
                <QueueCard
                  item={item}
                  onDismiss={handleDismiss}
                  onSnooze={handleSnooze}
                  onReviewSend={handleReviewSend}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  gradient,
  active,
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  gradient: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative w-full overflow-hidden rounded-2xl border p-5 text-left shadow-soft transition-all duration-200 hover:shadow-elevated focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-2 ${
        active
          ? "border-primary/50 bg-primary/5 ring-2 ring-primary/20"
          : "border-border/60 bg-card hover:border-border"
      }`}
    >
      <div className={`absolute -right-3 -top-3 h-16 w-16 rounded-full ${gradient} opacity-10 blur-lg`} />
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${gradient} text-white shadow-soft`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
        </div>
      </div>
    </button>
  );
}

function QueueSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
          <div className="flex items-start gap-4">
            <Skeleton className="h-11 w-11 rounded-xl shrink-0" />
            <div className="flex-1 min-w-0 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
              <Skeleton className="h-3 w-full max-w-xs" />
              <div className="flex gap-1.5 pt-2">
                <Skeleton className="h-1.5 w-5 rounded-full" />
                <Skeleton className="h-1.5 w-5 rounded-full" />
                <Skeleton className="h-1.5 w-5 rounded-full" />
                <Skeleton className="h-1.5 w-5 rounded-full" />
                <Skeleton className="h-1.5 w-5 rounded-full" />
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Skeleton className="h-9 w-24 rounded-lg" />
              <Skeleton className="h-9 w-20 rounded-lg" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ filter }: { filter: FilterTab }) {
  let message = "Your queue is empty. No prospects need attention today.";
  if (filter === "signal")
    message = "No signal-triggered items. New signals will appear here.";
  if (filter === "followup")
    message = "No follow-ups due today. You're all caught up!";
  if (filter === "suggested")
    message = "No suggested outreach. All prospects have recent activity.";

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-muted/20 py-24">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60">
        <Inbox className="h-8 w-8 text-muted-foreground/50" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">{message}</p>
      <p className="mt-1.5 text-xs text-muted-foreground/70">
        Add prospects and signals to get started.
      </p>
    </div>
  );
}
