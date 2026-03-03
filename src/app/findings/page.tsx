"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Bookmark,
  Loader2,
  User,
  Building2,
  ChevronDown,
  ChevronRight,
  Link2,
  Trash2,
  Search,
} from "lucide-react";
import { formatDaysAgo } from "@/lib/format";
import { useToast } from "@/components/ui/toast";

interface SavedFinding {
  id: string;
  content: string;
  source: string;
  prospectId: string | null;
  companyId: string | null;
  createdAt: string;
  prospect?: {
    id: string;
    firstName: string;
    lastName: string;
    company: string | null;
    companyId: string | null;
    companyRef?: { id: string; name: string } | null;
  } | null;
  company?: {
    id: string;
    name: string;
  } | null;
}

type GroupKey = string;

function getGroupKey(f: SavedFinding): GroupKey {
  try {
    if (f.companyId && f.company) return f.company.id;
    if (f.prospect?.companyId && f.prospect?.companyRef)
      return f.prospect.companyRef.id;
  } catch {
    /* fall through */
  }
  return "__unlinked__";
}

function getGroupLabel(f: SavedFinding): string {
  try {
    if (f.company?.name) return f.company.name;
    if (f.prospect?.companyRef?.name) return f.prospect.companyRef.name;
  } catch {
    /* fall through */
  }
  return "Unlinked";
}

function groupFindings(findings: SavedFinding[]): Map<GroupKey, { label: string; findings: SavedFinding[] }> {
  const map = new Map<GroupKey, { label: string; findings: SavedFinding[] }>();
  for (const f of findings) {
    const key = getGroupKey(f);
    const label = getGroupLabel(f);
    if (!map.has(key)) {
      map.set(key, { label, findings: [] });
    }
    map.get(key)!.findings.push(f);
  }
  // Sort findings within each group by date
  for (const g of map.values()) {
    g.findings.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }
  return map;
}

export default function FindingsPage() {
  const [findings, setFindings] = useState<SavedFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<GroupKey>>(new Set());
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [linkFindingId, setLinkFindingId] = useState<string | null>(null);
  const [linkSearch, setLinkSearch] = useState("");
  const [linkResults, setLinkResults] = useState<{
    prospects: { id: string; firstName: string; lastName: string; company: string | null }[];
    companies: { id: string; name: string; industry: string | null }[];
  } | null>(null);
  const [linkSearching, setLinkSearching] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchFindings = useCallback(async () => {
    try {
      const res = await fetch("/api/findings");
      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json();
      setFindings(json);
      setExpandedGroups((prev) => {
        if (prev.size === 0) return new Set(groupFindings(json).keys());
        return prev;
      });
    } catch {
      setFindings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFindings();
  }, [fetchFindings]);

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/findings/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      setFindings((prev) => prev.filter((f) => f.id !== id));
      toast("Finding deleted", "success");
    } catch {
      toast("Failed to delete finding", "error");
    } finally {
      setDeleteId(null);
    }
  };

  const handleLink = async (
    findingId: string,
    type: "company" | "prospect",
    id: string
  ) => {
    setUpdating(findingId);
    try {
      const body =
        type === "company"
          ? { companyId: id, prospectId: null }
          : { prospectId: id, companyId: null };
      const res = await fetch(`/api/findings/${findingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed");
      const updated = await res.json();
      setFindings((prev) =>
        prev.map((f) => (f.id === findingId ? updated : f))
      );
      toast("Finding linked", "success");
      setLinkFindingId(null);
      setLinkSearch("");
      setLinkResults(null);
    } catch {
      toast("Failed to link finding", "error");
    } finally {
      setUpdating(null);
    }
  };

  const handleUnlink = async (findingId: string) => {
    setUpdating(findingId);
    try {
      const res = await fetch(`/api/findings/${findingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: null, prospectId: null }),
      });
      if (!res.ok) throw new Error("Failed");
      const updated = await res.json();
      setFindings((prev) =>
        prev.map((f) => (f.id === findingId ? updated : f))
      );
      toast("Link removed", "success");
      setLinkFindingId(null);
    } catch {
      toast("Failed to unlink", "error");
    } finally {
      setUpdating(null);
    }
  };

  useEffect(() => {
    if (!linkFindingId || linkSearch.length < 2) {
      setLinkResults(null);
      return;
    }
    const t = setTimeout(async () => {
      setLinkSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(linkSearch)}`);
        if (res.ok) {
          const data = await res.json();
          setLinkResults({ prospects: data.prospects || [], companies: data.companies || [] });
        }
      } catch {
        setLinkResults(null);
      } finally {
        setLinkSearching(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [linkFindingId, linkSearch]);

  const groups = groupFindings(findings);
  const toggleGroup = (key: GroupKey) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Saved Findings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Insights saved from the Sales Assistant, grouped by company
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : findings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-4">
              <Bookmark className="h-7 w-7 text-primary" />
            </div>
            <h3 className="font-semibold text-lg">No saved findings yet</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm">
              Hover over any Sales Assistant response and click &quot;Save finding&quot; to capture insights here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {Array.from(groups.entries()).map(([key, { label, findings: groupFindings }]) => {
            const isExpanded = expandedGroups.has(key);
            return (
              <Card key={key}>
                <button
                  type="button"
                  onClick={() => toggleGroup(key)}
                  className="w-full text-left"
                >
                  <CardHeader className="flex flex-row items-center gap-3 py-4">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base flex items-center gap-2">
                        {key === "__unlinked__" ? (
                          <Bookmark className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Building2 className="h-4 w-4 text-primary" />
                        )}
                        {label}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {groupFindings.length} finding{groupFindings.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </CardHeader>
                </button>
                {isExpanded && (
                  <CardContent className="pt-0 space-y-3">
                    {groupFindings.map((f) => (
                      <FindingCard
                        key={f.id}
                        finding={f}
                        onDelete={() => setDeleteId(f.id)}
                        onLink={() => setLinkFindingId(f.id)}
                        isLinking={linkFindingId === f.id}
                        linkSearch={linkSearch}
                        setLinkSearch={setLinkSearch}
                        linkResults={linkResults}
                        linkSearching={linkSearching}
                        onSelectLink={(type, id) => handleLink(f.id, type, id)}
                        onUnlink={() => handleUnlink(f.id)}
                        updating={updating === f.id}
                        onCloseLink={() => {
                          setLinkFindingId(null);
                          setLinkSearch("");
                          setLinkResults(null);
                        }}
                      />
                    ))}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete finding"
        description="This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => { if (deleteId) handleDelete(deleteId); }}
      />
    </div>
  );
}

function FindingCard({
  finding,
  onDelete,
  onLink,
  isLinking,
  linkSearch,
  setLinkSearch,
  linkResults,
  linkSearching,
  onSelectLink,
  onUnlink,
  updating,
  onCloseLink,
}: {
  finding: SavedFinding;
  onDelete: () => void;
  onLink: () => void;
  isLinking: boolean;
  linkSearch: string;
  setLinkSearch: (v: string) => void;
  linkResults: { prospects: { id: string; firstName: string; lastName: string; company: string | null }[]; companies: { id: string; name: string; industry: string | null }[] } | null;
  linkSearching: boolean;
  onSelectLink: (type: "company" | "prospect", id: string) => void;
  onUnlink: () => void;
  updating: boolean;
  onCloseLink: () => void;
}) {
  const hasLink = finding.companyId || finding.prospectId;

  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {finding.prospect && (
            <Link
              href={`/prospects/${finding.prospect.id}`}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary hover:bg-primary/20"
            >
              <User className="h-3 w-3" />
              {finding.prospect.firstName} {finding.prospect.lastName}
              {finding.prospect.company && `, ${finding.prospect.company}`}
            </Link>
          )}
          {finding.company && (
            <Link
              href={`/companies/${finding.company.id}`}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary hover:bg-primary/20"
            >
              <Building2 className="h-3 w-3" />
              {finding.company.name}
            </Link>
          )}
          {!hasLink && (
            <span className="text-xs text-muted-foreground">Not linked</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={onLink}
            disabled={updating}
          >
            <Link2 className="h-3 w-3 mr-1" />
            {hasLink ? "Change" : "Link"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-destructive hover:text-destructive"
            onClick={onDelete}
            disabled={updating}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {isLinking && (
        <div className="rounded-lg border border-border bg-card p-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={linkSearch}
              onChange={(e) => setLinkSearch(e.target.value)}
              placeholder="Search company or prospect..."
              className="pl-8 h-8 text-sm"
              autoFocus
            />
          </div>
          {linkSearching ? (
            <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Searching...
            </div>
          ) : linkResults && (linkResults.companies.length > 0 || linkResults.prospects.length > 0) ? (
            <div className="max-h-40 overflow-y-auto space-y-1">
              {linkResults.companies.map((c) => (
                <button
                  key={`c-${c.id}`}
                  type="button"
                  onClick={() => onSelectLink("company", c.id)}
                  className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted"
                >
                  <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="font-medium">{c.name}</span>
                  {c.industry && (
                    <span className="text-xs text-muted-foreground">{c.industry}</span>
                  )}
                </button>
              ))}
              {linkResults.prospects.map((p) => (
                <button
                  key={`p-${p.id}`}
                  type="button"
                  onClick={() => onSelectLink("prospect", p.id)}
                  className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted"
                >
                  <User className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="font-medium">{p.firstName} {p.lastName}</span>
                  {p.company && (
                    <span className="text-xs text-muted-foreground">at {p.company}</span>
                  )}
                </button>
              ))}
            </div>
          ) : linkSearch.length >= 2 ? (
            <p className="text-xs text-muted-foreground py-2">No results</p>
          ) : null}
          <div className="flex items-center gap-2 pt-1">
            {hasLink && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={onUnlink}
              >
                Remove link
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onCloseLink}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">{formatDaysAgo(finding.createdAt)}</p>
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{finding.content}</p>
    </div>
  );
}
