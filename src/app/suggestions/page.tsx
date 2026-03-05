"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Link2,
  FileText,
  ChevronDown,
  ChevronUp,
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
  const [importExpanded, setImportExpanded] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importText, setImportText] = useState("");
  const [importEventName, setImportEventName] = useState("");
  const [importing, setImporting] = useState(false);
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

  const handleImport = async (file?: File) => {
    const url = importUrl.trim() || undefined;
    const text = importText.trim().length >= 50 ? importText.trim() : undefined;
    const eventName = importEventName.trim() || undefined;

    if (file) {
      if (file.size < 50) {
        toast("File too small (min 50 bytes)", "error");
        return;
      }
      setImporting(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        if (eventName) formData.append("eventName", eventName);
        const res = await fetch("/api/event-attendees/import", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Import failed");
        toast(data.message || `${data.created} prospect(s) added for review`, "success");
        if (data.created > 0) {
          setImportEventName("");
          fetchSuggestions();
        }
      } catch (e) {
        toast(e instanceof Error ? e.message : "Import failed", "error");
      } finally {
        setImporting(false);
      }
      return;
    }

    if (!url && !text) {
      toast("Enter a URL, paste content (min 50 chars), or upload a file", "error");
      return;
    }
    setImporting(true);
    try {
      const res = await fetch("/api/event-attendees/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url || undefined,
          text: text || undefined,
          eventName: eventName || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      toast(data.message || `${data.created} prospect(s) added for review`, "success");
      if (data.created > 0) {
        setImportUrl("");
        setImportText("");
        setImportEventName("");
        fetchSuggestions();
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Import failed", "error");
    } finally {
      setImporting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.name.toLowerCase().endsWith(".pdf")) {
      handleImport(file);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result ?? "");
        if (text.length >= 50) setImportText(text);
        else toast("File content too short (min 50 chars)", "error");
      };
      reader.readAsText(file);
    }
    e.target.value = "";
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

      <Card className="mb-8 overflow-hidden">
        <button
          type="button"
          onClick={() => setImportExpanded((x) => !x)}
          className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Import event attendees</span>
            <span className="text-xs text-muted-foreground">
              From URL or document
            </span>
          </div>
          {importExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        {importExpanded && (
          <div className="border-t border-border p-4 space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Event URL
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="https://event-website.com/attendees"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  className="flex-1"
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Paste a URL to an event page, attendee list, or speaker list. HTML and PDF supported.
              </p>
            </div>
            <div className="relative">
              <div className="absolute left-0 right-0 top-0 h-px bg-border" />
              <span className="relative -top-2.5 left-0 bg-card px-1 text-[10px] text-muted-foreground uppercase tracking-wider">
                or paste / upload
              </span>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Document content
              </label>
              <textarea
                placeholder="Paste attendee list, speaker list, or event prospectus..."
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="flex items-center gap-2 mt-1.5">
                <label className="cursor-pointer">
                  <span className="text-[11px] text-primary hover:underline">
                    Upload .txt or .pdf
                  </span>
                  <input
                    type="file"
                    accept=".txt,.pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
                <span className="text-[11px] text-muted-foreground">
                  — PDFs are sent directly for extraction
                </span>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Event name (optional)
              </label>
              <Input
                placeholder="e.g. SaaStr Annual 2025"
                value={importEventName}
                onChange={(e) => setImportEventName(e.target.value)}
              />
            </div>
            <Button
              onClick={() => handleImport()}
              disabled={importing || (!importUrl.trim() && importText.trim().length < 50)}
              className="gap-2"
            >
              {importing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              Extract attendees
            </Button>
          </div>
        )}
      </Card>

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
