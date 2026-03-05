"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Loader2,
  ChevronDown,
  ChevronRight,
  Building2,
  User,
  AlertTriangle,
  Target,
  Calendar,
} from "lucide-react";
import { formatLastContacted } from "@/lib/format";
import { useToast } from "@/components/ui/toast";

const STAGE_LABELS: Record<string, string> = {
  new: "New",
  meeting_booked: "Meeting Booked",
  qualified: "Qualified",
  proposal: "Proposal",
  negotiation: "Negotiation",
  closed_won: "Won",
  closed_lost: "Lost",
};

interface PipelineProspect {
  id: string;
  firstName: string;
  lastName: string;
  company: string | null;
  companyId: string | null;
  pipelineStage: string | null;
  lastContactedAt: string | null;
  companyRef: { fitBucket: string | null } | null;
  isStale: boolean;
}

interface PipelineData {
  byStage: Record<string, PipelineProspect[]>;
  activeStages: readonly string[];
  closedStages: readonly string[];
  total: number;
  counts: Record<string, number>;
}

export default function PipelinePage() {
  const [data, setData] = useState<PipelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [closedCollapsed, setClosedCollapsed] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchPipeline = useCallback(async () => {
    try {
      const res = await fetch("/api/pipeline");
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setData(json);
    } catch {
      toast("Failed to load pipeline", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPipeline();
  }, [fetchPipeline]);

  const handleStageChange = async (prospectId: string, newStage: string) => {
    if (newStage === "") return;
    setUpdatingId(prospectId);
    try {
      const res = await fetch(`/api/prospects/${prospectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipelineStage: newStage }),
      });
      if (!res.ok) throw new Error("Failed to update");
      await fetchPipeline();
      toast("Stage updated", "success");
    } catch {
      toast("Failed to update stage", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mb-4 h-8 w-8 animate-spin" />
        <p className="text-sm font-medium">Loading pipeline...</p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const activeTotal = data.activeStages.reduce((sum, s) => sum + (data.counts[s] || 0), 0);
  const closedTotal = data.closedStages.reduce((sum, s) => sum + (data.counts[s] || 0), 0);

  if (data.total === 0) {
    return (
      <div className="mx-auto max-w-2xl animate-fade-in text-center py-24">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Target className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Your pipeline is empty</h1>
        <p className="mt-2 text-sm text-muted-foreground mb-6">
          Log a meeting outcome from a prospect, or add prospects from your queue.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/">
            <Button className="gap-2">Go to Queue</Button>
          </Link>
          <Link href="/prospects">
            <Button variant="outline" className="gap-2">View Prospects</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl animate-fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Pipeline</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.total} prospect{data.total !== 1 ? "s" : ""} in pipeline
        </p>
      </div>

      {/* Active stages */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {data.activeStages.map((stageKey) => {
          const prospects = data.byStage[stageKey] || [];
          return (
            <div
              key={stageKey}
              className="rounded-xl border border-border bg-card overflow-hidden"
            >
              <div className="flex items-center justify-between p-3 bg-muted/30 border-b border-border">
                <h2 className="text-sm font-semibold">{STAGE_LABELS[stageKey] || stageKey}</h2>
                <Badge variant="outline">{prospects.length}</Badge>
              </div>
              <div className="p-2 space-y-2 min-h-[120px]">
                {prospects.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">None</p>
                ) : (
                  prospects.map((p) => (
                    <PipelineCard
                      key={p.id}
                      prospect={p}
                      onStageChange={handleStageChange}
                      updating={updatingId === p.id}
                      stages={data.activeStages.concat(data.closedStages)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Closed stages (collapsed) */}
      <div className="mt-6 rounded-xl border border-border">
        <button
          onClick={() => setClosedCollapsed(!closedCollapsed)}
          className="flex w-full items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            {closedCollapsed ? (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-sm font-semibold">Closed</span>
            <span className="text-xs text-muted-foreground">
              ({data.counts.closed_won || 0} won, {data.counts.closed_lost || 0} lost)
            </span>
          </div>
          <Badge variant="outline">{closedTotal}</Badge>
        </button>
        {!closedCollapsed && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4">
            {data.closedStages.map((stageKey) => {
              const prospects = data.byStage[stageKey] || [];
              return (
                <div key={stageKey} className="rounded-lg border border-border/50 bg-card p-3">
                  <h3 className="text-xs font-semibold text-muted-foreground mb-2">
                    {STAGE_LABELS[stageKey] || stageKey}
                  </h3>
                  <div className="space-y-2">
                    {prospects.length === 0 ? (
                      <p className="text-xs text-muted-foreground">None</p>
                    ) : (
                      prospects.map((p) => (
                        <PipelineCard
                          key={p.id}
                          prospect={p}
                          onStageChange={handleStageChange}
                          updating={updatingId === p.id}
                          stages={data.activeStages.concat(data.closedStages)}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function PipelineCard({
  prospect,
  onStageChange,
  updating,
  stages,
}: {
  prospect: PipelineProspect;
  onStageChange: (id: string, stage: string) => void;
  updating: boolean;
  stages: readonly string[];
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border/50 bg-background p-4 transition-all hover:border-border",
        prospect.isStale && "border-amber-200 dark:border-amber-800"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <Link href={`/prospects/${prospect.id}`} className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="text-sm font-semibold truncate">
              {prospect.firstName} {prospect.lastName}
            </span>
          </div>
          {prospect.company && (
            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
              <Building2 className="h-3 w-3 shrink-0" />
              <span className="truncate">{prospect.company}</span>
            </div>
          )}
        </Link>
        {prospect.isStale && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0 text-amber-600 border-amber-300">
            At risk
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-3 mt-2">
        <Select
          value={prospect.pipelineStage || "new"}
          onChange={(e) => onStageChange(prospect.id, e.target.value)}
          disabled={updating}
          className="h-8 text-xs min-w-0 flex-1"
          onClick={(e) => e.stopPropagation()}
        >
          {stages.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABELS[s] || s}
            </option>
          ))}
        </Select>
        {prospect.lastContactedAt && (
          <span className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-0.5">
            <Calendar className="h-3 w-3" />
            {formatLastContacted(prospect.lastContactedAt)}
          </span>
        )}
      </div>
    </div>
  );
}
