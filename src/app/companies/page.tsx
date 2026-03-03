"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Building2,
  Plus,
  Users,
  FileText,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Merge,
} from "lucide-react";
import { freshnessColor } from "@/lib/format";

interface CompanyRow {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  size: string | null;
  synthStatus: string;
  lastSynthesizedAt: string | null;
  intelCountSinceSynth: number;
  _count: { prospects: number; intel: number; documents: number };
}

function normalizeForCompare(name: string): string {
  return name
    .replace(/\b(GmbH|AG|Inc\.?|Ltd\.?|Corp\.?|SE|S\.A\.?|PLC|LLC|Co\.?|Group|Holdings?|International)\b/gi, "")
    .replace(/[.,&]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function findDuplicates(companies: CompanyRow[]): [CompanyRow, CompanyRow][] {
  const pairs: [CompanyRow, CompanyRow][] = [];
  const seen = new Set<string>();
  for (let i = 0; i < companies.length; i++) {
    for (let j = i + 1; j < companies.length; j++) {
      const a = normalizeForCompare(companies[i].name);
      const b = normalizeForCompare(companies[j].name);
      if (a === b) {
        const key = [companies[i].id, companies[j].id].sort().join("-");
        if (!seen.has(key)) {
          seen.add(key);
          pairs.push([companies[i], companies[j]]);
        }
      }
    }
  }
  return pairs;
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [merging, setMerging] = useState<string | null>(null);

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/companies");
      const data = await res.json();
      setCompanies(data.data || data);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  const filtered = useMemo(
    () => companies.filter((c) => c.name.toLowerCase().includes(search.toLowerCase())),
    [companies, search]
  );

  const duplicates = useMemo(() => findDuplicates(companies), [companies]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      setNewName("");
      setShowCreate(false);
      fetchCompanies();
    } catch { /* ignore */ } finally {
      setCreating(false);
    }
  };

  const handleMerge = async (sourceId: string, targetId: string) => {
    setMerging(sourceId);
    try {
      await fetch("/api/companies/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId, targetId }),
      });
      fetchCompanies();
    } catch { /* ignore */ } finally {
      setMerging(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Companies</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {companies.length} companies tracked
          </p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Company
        </Button>
      </div>

      {showCreate && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-soft">
          <Input
            placeholder="Company name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            className="flex-1"
          />
          <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
          </Button>
        </div>
      )}

      {duplicates.length > 0 && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-yellow-600 dark:text-yellow-400">
            <AlertTriangle className="h-4 w-4" />
            Possible duplicates detected
          </div>
          <div className="mt-3 space-y-2">
            {duplicates.map(([a, b]) => (
              <div key={`${a.id}-${b.id}`} className="flex items-center gap-3 text-sm">
                <span className="font-medium">{a.name}</span>
                <span className="text-muted-foreground">&amp;</span>
                <span className="font-medium">{b.name}</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto gap-1.5"
                  disabled={merging === a.id}
                  onClick={() => handleMerge(a.id, b.id)}
                >
                  {merging === a.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Merge className="h-3 w-3" />
                  )}
                  Merge into {b.name}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search companies..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground/40" />
          <p className="mt-4 text-sm text-muted-foreground">
            {search ? "No companies match your search." : "No companies yet. Import prospects or add a company."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Company</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Industry</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Prospects</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Intel</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Docs</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/companies/${c.id}`} className="flex items-center gap-3 font-medium text-foreground hover:text-primary transition-colors">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          {c.name}
                          <div className={`h-2 w-2 rounded-full ${freshnessColor(c.lastSynthesizedAt)}`} title={c.lastSynthesizedAt ? `Last synthesized: ${new Date(c.lastSynthesizedAt).toLocaleDateString()}` : "Not yet synthesized"} />
                        </div>
                        {c.size && <span className="text-xs text-muted-foreground">{c.size}</span>}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.industry || "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Users className="h-3.5 w-3.5" /> {c._count.prospects}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      {c._count.intel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <FileText className="h-3.5 w-3.5" /> {c._count.documents}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {c.synthStatus === "pending" && (
                      <span className="inline-flex items-center gap-1 text-xs text-yellow-600">
                        <RefreshCw className="h-3 w-3 animate-spin" /> Syncing
                      </span>
                    )}
                    {c.synthStatus === "completed" && (
                      <span className="text-xs text-green-600">Ready</span>
                    )}
                    {c.synthStatus === "failed" && (
                      <span className="text-xs text-red-600">Error</span>
                    )}
                    {c.synthStatus === "none" && (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
