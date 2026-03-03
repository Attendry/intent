"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Search,
  Upload,
  Star,
  Zap,
  Clock,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Users,
  AlertCircle,
} from "lucide-react";
import { formatLastContacted, getInitials } from "@/lib/format";

type FilterTab = "all" | "starred" | "has_signals" | "overdue";

interface ProspectRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  title: string | null;
  company: string | null;
  starred: boolean;
  lastContactedAt: string | null;
  _signalCount: number;
  _latestSignalUrgency: number | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function getUrgencyDotGradient(urgency: number | null) {
  if (!urgency) return "";
  if (urgency >= 4) return "gradient-danger";
  if (urgency >= 3) return "gradient-warning";
  return "gradient-info";
}

const FILTER_TABS: { key: FilterTab; label: string; icon?: typeof Star }[] = [
  { key: "all", label: "All" },
  { key: "starred", label: "Starred", icon: Star },
  { key: "has_signals", label: "Has signals", icon: Zap },
  { key: "overdue", label: "Overdue", icon: Clock },
];

export default function ProspectsPage() {
  const [prospects, setProspects] = useState<ProspectRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("all");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchProspects = useCallback(
    async (page: number) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (debouncedSearch) params.set("q", debouncedSearch);
        if (filter !== "all") params.set("filter", filter);
        params.set("page", String(page));
        params.set("limit", "20");

        const res = await fetch(`/api/prospects?${params}`);
        if (!res.ok) throw new Error("Failed to fetch prospects");
        const text = await res.text();
        let data: { data?: ProspectRow[]; pagination?: Pagination };
        try {
          data = text ? JSON.parse(text) : { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };
        } catch {
          throw new Error("Invalid response from server");
        }
        setProspects(data.data || []);
        setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load prospects"
        );
      } finally {
        setLoading(false);
      }
    },
    [debouncedSearch, filter]
  );

  useEffect(() => {
    fetchProspects(1);
  }, [fetchProspects]);

  const rangeStart = (pagination.page - 1) * pagination.limit + 1;
  const rangeEnd = Math.min(
    pagination.page * pagination.limit,
    pagination.total
  );

  return (
    <div className="mx-auto max-w-5xl animate-fade-in">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Prospects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your prospect pipeline and track engagement.
          </p>
        </div>
        <Link href="/prospects/import">
          <Button variant="outline" className="gap-2">
            <Upload className="h-4 w-4" />
            Import CSV
          </Button>
        </Link>
      </div>

      {/* Search + filter */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or company..."
            className="h-10 pl-10 text-sm"
          />
        </div>

        <div className="flex gap-1 rounded-xl bg-muted/60 p-1">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all duration-200",
                filter === tab.key
                  ? "bg-card text-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.icon && <tab.icon className="h-3.5 w-3.5" />}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="mb-4 h-8 w-8 animate-spin" />
          <p className="text-sm font-medium">Loading prospects...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-24">
          <AlertCircle className="mb-3 h-8 w-8 text-destructive" />
          <p className="mb-4 text-sm font-medium text-destructive">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchProspects(pagination.page)}
          >
            Retry
          </Button>
        </div>
      ) : prospects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-muted/20 py-24">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60">
            <Users className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            {debouncedSearch
              ? "No prospects match your search."
              : "No prospects yet. Import a CSV to get started."}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-soft">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Name
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Company
                  </th>
                  <th className="hidden px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">
                    Title
                  </th>
                  <th className="px-5 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Signals
                  </th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Last Contacted
                  </th>
                </tr>
              </thead>
              <tbody>
                {prospects.map((p, i) => (
                  <tr
                    key={p.id}
                    className="border-b border-border/40 transition-colors last:border-0 hover:bg-muted/30 animate-slide-up"
                    style={{ animationDelay: `${i * 30}ms`, animationFillMode: "both" }}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[11px] font-bold text-primary">
                          {getInitials(p.firstName, p.lastName)}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {p.starred && (
                            <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />
                          )}
                          <Link
                            href={`/prospects/${p.id}`}
                            className="font-semibold text-foreground hover:text-primary transition-colors"
                          >
                            {p.firstName} {p.lastName}
                          </Link>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">
                      {p.company || "—"}
                    </td>
                    <td className="hidden px-5 py-3.5 text-muted-foreground md:table-cell">
                      {p.title || "—"}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {p._signalCount > 0 ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className={cn(
                              "h-2 w-2 rounded-full",
                              getUrgencyDotGradient(p._latestSignalUrgency)
                            )}
                          />
                          <span className="text-xs font-semibold">
                            {p._signalCount}
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/60">0</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {p.lastContactedAt ? (
                        <span className="text-xs text-muted-foreground">
                          {formatLastContacted(p.lastContactedAt)}
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-destructive/80">
                          Never
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium">
              Showing {rangeStart}–{rangeEnd} of {pagination.total}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => fetchProspects(pagination.page - 1)}
                className="gap-1"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchProspects(pagination.page + 1)}
                className="gap-1"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
