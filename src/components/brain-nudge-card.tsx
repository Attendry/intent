"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sparkles, ChevronDown, ChevronRight } from "lucide-react";

interface Nudge {
  text: string;
  nextBestAction: string;
  ctaUrl: string;
}

interface BrainNudgeCardProps {
  prospectId?: string;
  companyId?: string;
}

export function BrainNudgeCard({ prospectId, companyId }: BrainNudgeCardProps) {
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!prospectId && !companyId) {
      setLoading(false);
      return;
    }
    const params = new URLSearchParams();
    if (prospectId) params.set("prospectId", prospectId);
    if (companyId) params.set("companyId", companyId);
    fetch(`/api/brain/nudge?${params}`)
      .then((res) => res.json())
      .then((data) => setNudges(data.nudges || []))
      .catch(() => setNudges([]))
      .finally(() => setLoading(false));
  }, [prospectId, companyId]);

  if (loading || nudges.length === 0) return null;

  return (
    <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-primary/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-medium text-foreground">Brain says</span>
        </div>
        {collapsed ? (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {!collapsed && (
        <div className="border-t border-primary/10 p-4 space-y-3">
          {nudges.map((n, i) => (
            <div key={i} className="flex items-start justify-between gap-3">
              <p className="text-sm text-muted-foreground flex-1">{n.text}</p>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0"
                onClick={() => router.push(n.ctaUrl)}
              >
                {n.nextBestAction}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
