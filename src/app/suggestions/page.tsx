"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  UserPlus,
  X,
  Check,
  Loader2,
  Calendar,
  ExternalLink,
  Inbox,
  Building2,
  Briefcase,
} from "lucide-react";

interface Suggestion {
  id: string;
  firstName: string;
  lastName: string;
  title: string | null;
  company: string | null;
  linkedinUrl: string | null;
  source: string;
  signalType: string;
  reason: string;
  status: string;
  createdAt: string;
}

export default function SuggestionsPage() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const fetchSuggestions = useCallback(async () => {
    try {
      const res = await fetch("/api/suggestions?status=pending");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setSuggestions(data.suggestions || []);
    } catch {
      toast("Failed to load suggestions", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const handleAction = async (id: string, action: "approve" | "dismiss") => {
    setProcessing((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/suggestions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error("Failed");

      setSuggestions((prev) => prev.filter((s) => s.id !== id));
      toast(
        action === "approve"
          ? "Prospect created and enrichment started"
          : "Suggestion dismissed",
        action === "approve" ? "success" : "default"
      );
    } catch {
      toast("Action failed", "error");
    } finally {
      setProcessing((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleBulkApprove = async () => {
    for (const s of suggestions) {
      await handleAction(s.id, "approve");
    }
  };

  const handleBulkDismiss = async () => {
    for (const s of suggestions) {
      await handleAction(s.id, "dismiss");
    }
  };

  return (
    <div className="mx-auto max-w-3xl animate-fade-in">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-info text-white shadow-soft">
            <UserPlus className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Prospect Suggestions
            </h1>
            <p className="text-sm text-muted-foreground">
              People discovered from conferences and events. Review and add to
              your pipeline.
            </p>
          </div>
        </div>
        {suggestions.length > 1 && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkDismiss}
              className="gap-1.5"
            >
              <X className="h-3.5 w-3.5" />
              Dismiss All
            </Button>
            <Button size="sm" onClick={handleBulkApprove} className="gap-1.5">
              <Check className="h-3.5 w-3.5" />
              Approve All
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mb-4" />
          <p className="text-sm font-medium">Loading suggestions...</p>
        </div>
      ) : suggestions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-muted/20 py-24">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60">
            <Inbox className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            No pending suggestions.
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground/70">
            New suggestions will appear when conferences and events are scanned.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {suggestions.map((s, i) => (
            <Card
              key={s.id}
              className="animate-slide-up overflow-hidden"
              style={{
                animationDelay: `${i * 40}ms`,
                animationFillMode: "both",
              }}
            >
              <div className="flex items-start gap-4 p-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl gradient-info text-xs font-bold text-white shadow-soft">
                  {s.firstName[0]}
                  {s.lastName[0]}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {s.firstName} {s.lastName}
                    </span>
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0"
                    >
                      {s.signalType}
                    </Badge>
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    {s.title && (
                      <span className="inline-flex items-center gap-1">
                        <Briefcase className="h-3 w-3" />
                        {s.title}
                      </span>
                    )}
                    {s.company && (
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {s.company}
                      </span>
                    )}
                  </div>

                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/10">
                      <Calendar className="h-3 w-3 text-primary" />
                    </div>
                    <span className="font-medium">{s.reason}</span>
                    {s.source && !s.source.startsWith("predicthq:") && (
                      <a
                        href={s.source}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Source
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    size="sm"
                    onClick={() => handleAction(s.id, "approve")}
                    disabled={processing.has(s.id)}
                    className="gap-1.5"
                  >
                    {processing.has(s.id) ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    Approve
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleAction(s.id, "dismiss")}
                    disabled={processing.has(s.id)}
                    className={cn(
                      "text-muted-foreground hover:text-destructive"
                    )}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
