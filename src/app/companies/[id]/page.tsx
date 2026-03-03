"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Building2,
  Users,
  FileText,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Plus,
  Upload,
  LinkIcon,
  Search as SearchIcon,
  AlertCircle,
  CheckCircle2,
  User,
  Pencil,
  Save,
  X,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import Breadcrumbs from "@/components/breadcrumbs";
import { freshnessColor } from "@/lib/format";
import { INTEL_TYPE_LABELS, INTEL_TYPE_COLORS } from "@/lib/constants";
import FitAnalysisSection from "@/components/company/fit-analysis-section";

interface CompanyDetail {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  size: string | null;
  hqLocation: string | null;
  notes: string | null;
  battlecard: string | null;
  roleBriefingCache: string | null;
  lastSynthesizedAt: string | null;
  synthStatus: string;
  synthError: string | null;
  intelCountSinceSynth: number;
  prospects: {
    id: string;
    firstName: string;
    lastName: string;
    title: string | null;
    email: string | null;
    roleArchetype: string | null;
    lastContactedAt: string | null;
  }[];
  intel: {
    id: string;
    documentId?: string | null;
    type: string;
    summary: string;
    sourceRef: string | null;
    sourceQuote?: string | null;
    sourceUrl: string | null;
    date: string | null;
    urgencyScore: number;
    actionContext: string | null;
    createdAt: string;
    document?: { sourceUrl: string | null; title: string; viewUrl?: string | null } | null;
  }[];
  documents: {
    id: string;
    title: string;
    type: string;
    sourceUrl: string | null;
    viewUrl: string | null;
    status: string;
    processingStage: string | null;
    processingPct: number;
    processingError: string | null;
    createdAt: string;
  }[];
}


export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", industry: "", website: "", size: "", hqLocation: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [synthesizing, setSynthesizing] = useState(false);
  const [battlecardOpen, setBattlecardOpen] = useState(true);
  const [showAddIntel, setShowAddIntel] = useState(false);
  const [intelForm, setIntelForm] = useState({ type: "company_news", summary: "", sourceUrl: "", urgencyScore: 3 });
  const [addingIntel, setAddingIntel] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadMode, setUploadMode] = useState<"file" | "url">("file");
  const [docUrl, setDocUrl] = useState("");
  const [docTitle, setDocTitle] = useState("");
  const [docType, setDocType] = useState("annual_report");
  const [uploading, setUploading] = useState(false);
  const [findingReport, setFindingReport] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showLinkProspect, setShowLinkProspect] = useState(false);
  const [prospectSearch, setProspectSearch] = useState("");
  const [prospectResults, setProspectResults] = useState<{ id: string; firstName: string; lastName: string; title: string | null; company: string | null; companyId: string | null }[]>([]);
  const [searchingProspects, setSearchingProspects] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [confirmDeleteDocId, setConfirmDeleteDocId] = useState<string | null>(null);
  const [confirmUnlinkId, setConfirmUnlinkId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchCompany = useCallback(async () => {
    try {
      const res = await fetch(`/api/companies/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setCompany(data);
    } catch { toast("Failed to load company", "error"); } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchCompany(); }, [fetchCompany]);

  // Auto-poll when documents are processing or synthesis is running
  useEffect(() => {
    if (!company) return;
    const hasActiveDoc = company.documents.some(
      (d) => d.status === "processing" || d.status === "pending"
    );
    const isSynthesizing = company.synthStatus === "pending";
    if (!hasActiveDoc && !isSynthesizing) return;
    const interval = setInterval(fetchCompany, 3000);
    return () => clearInterval(interval);
  }, [company, fetchCompany]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (editing) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [editing]);

  const handleEdit = () => {
    if (!company) return;
    setEditForm({
      name: company.name,
      industry: company.industry || "",
      website: company.website || "",
      size: company.size || "",
      hqLocation: company.hqLocation || "",
      notes: company.notes || "",
    });
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/companies/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      setEditing(false);
      fetchCompany();
    } catch { toast("Failed to save changes", "error"); } finally {
      setSaving(false);
    }
  };

  const handleSynthesize = async () => {
    setSynthesizing(true);
    try {
      fetch(`/api/companies/${id}/synthesize`, { method: "POST" }).catch(() => {});
      // Update local state immediately so synthStatus shows "pending"
      if (company) {
        setCompany({ ...company, synthStatus: "pending", synthError: null });
      }
      setTimeout(() => setSynthesizing(false), 1000);
    } catch {
      toast("Failed to start synthesis", "error");
      setSynthesizing(false);
    }
  };

  const handleAddIntel = async () => {
    if (!intelForm.summary.trim()) return;
    setAddingIntel(true);
    try {
      await fetch(`/api/companies/${id}/intel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(intelForm),
      });
      setIntelForm({ type: "company_news", summary: "", sourceUrl: "", urgencyScore: 3 });
      setShowAddIntel(false);
      fetchCompany();
    } catch { toast("Failed to add intelligence", "error"); } finally {
      setAddingIntel(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", file.name);
      formData.append("type", docType);
      await fetch(`/api/companies/${id}/documents`, { method: "POST", body: formData });
      fetchCompany();
    } catch { toast("Failed to upload document", "error"); } finally {
      setUploading(false);
    }
  };

  const handleUrlUpload = async () => {
    if (!docUrl.trim()) return;
    setUploading(true);
    try {
      await fetch(`/api/companies/${id}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: docUrl, title: docTitle || docUrl, type: docType }),
      });
      setDocUrl("");
      setDocTitle("");
      setShowUpload(false);
      fetchCompany();
    } catch { toast("Failed to add document", "error"); } finally {
      setUploading(false);
    }
  };

  const [findReportMsg, setFindReportMsg] = useState<string | null>(null);

  const handleFindReport = async () => {
    setFindingReport(true);
    setFindReportMsg(null);
    try {
      const res = await fetch(`/api/companies/${id}/documents/find`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || "Failed to find annual report";
        const urls = data.triedUrls as string[] | undefined;
        setFindReportMsg(
          urls?.length
            ? `${msg}\n\nTried: ${urls.join(", ")}`
            : msg
        );
      } else if (data.message) {
        setFindReportMsg(data.message);
      } else if (data.success) {
        setFindReportMsg(`Found: ${data.title || data.url}. Processing...`);
        fetchCompany();
      }
    } catch {
      setFindReportMsg("Network error — could not reach the server.");
    } finally {
      setFindingReport(false);
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    try {
      await fetch(`/api/companies/${id}/documents?docId=${docId}`, { method: "DELETE" });
      fetchCompany();
    } catch { toast("Failed to delete document", "error"); }
  };

  const handleProspectSearch = async (query: string) => {
    setProspectSearch(query);
    if (query.trim().length < 2) { setProspectResults([]); return; }
    setSearchingProspects(true);
    try {
      const res = await fetch(`/api/prospects?q=${encodeURIComponent(query)}&limit=10`);
      const json = await res.json();
      const rows = json.data || json.prospects || [];
      const prospects = rows.map((p: Record<string, unknown>) => ({
        id: p.id as string,
        firstName: p.firstName as string,
        lastName: p.lastName as string,
        title: p.title as string | null,
        company: p.company as string | null,
        companyId: p.companyId as string | null,
      }));
      setProspectResults(prospects);
    } catch { toast("Search failed", "error"); setProspectResults([]); } finally {
      setSearchingProspects(false);
    }
  };


  const loadSuggestions = async () => {
    if (!company) return;
    setSearchingProspects(true);
    try {
      const res = await fetch(`/api/prospects?q=${encodeURIComponent(company.name)}&limit=20`);
      const json = await res.json();
      const rows = json.data || [];
      const unlinked = rows
        .filter((p: Record<string, unknown>) => p.companyId !== id)
        .map((p: Record<string, unknown>) => ({
          id: p.id as string,
          firstName: p.firstName as string,
          lastName: p.lastName as string,
          title: p.title as string | null,
          company: p.company as string | null,
          companyId: p.companyId as string | null,
        }));
      if (unlinked.length > 0 && prospectSearch.length < 2) {
        setProspectResults(unlinked);
      }
    } catch { toast("Failed to load suggestions", "error"); } finally {
      setSearchingProspects(false);
    }
  };

  const handleLinkProspect = async (prospectId: string) => {
    setLinkingId(prospectId);
    try {
      await fetch(`/api/prospects/${prospectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: id, company: company?.name }),
      });
      setProspectSearch("");
      setProspectResults([]);
      fetchCompany();
    } catch { toast("Failed to link prospect", "error"); } finally {
      setLinkingId(null);
    }
  };

  const handleUnlinkProspect = async (prospectId: string) => {
    setLinkingId(prospectId);
    try {
      await fetch(`/api/prospects/${prospectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: null }),
      });
      fetchCompany();
    } catch { toast("Failed to unlink prospect", "error"); } finally {
      setLinkingId(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 animate-fade-in">
        <Skeleton className="h-5 w-64" />
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="h-12 w-12 text-muted-foreground/40" />
        <p className="mt-4 text-sm text-muted-foreground">Company not found.</p>
      </div>
    );
  }

  let battlecardSections: Record<string, unknown> = {};
  if (company.battlecard) {
    try { battlecardSections = JSON.parse(company.battlecard); } catch { battlecardSections = { summary: company.battlecard }; }
  }

  /** AI may return keyContacts as array of objects {name, title, role} — convert to string for display. */
  function battlecardValueToStr(v: unknown): string {
    if (v == null) return "";
    if (typeof v === "string") return v;
    if (Array.isArray(v)) {
      return v
        .map((x) => {
          if (typeof x === "string") return x;
          if (x && typeof x === "object" && "name" in x) {
            const o = x as { name?: string; title?: string; role?: string };
            const parts = [o.name || o.role || ""];
            if (o.title) parts.push(`(${o.title})`);
            return parts.filter(Boolean).join(" ").trim() || String(x);
          }
          return String(x);
        })
        .filter(Boolean)
        .join("\n");
    }
    return String(v);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Breadcrumbs items={[{ label: "Companies", href: "/companies" }, { label: company.name }]} />

      {/* Metadata Card */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-primary shadow-soft">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div>
              {editing ? (
                <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="text-xl font-bold" />
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold">{company.name}</h1>
                  <div className={`h-2.5 w-2.5 rounded-full ${freshnessColor(company.lastSynthesizedAt)}`} title={company.lastSynthesizedAt ? `Last synthesized: ${new Date(company.lastSynthesizedAt).toLocaleDateString()}` : "Not yet synthesized"} />
                </div>
              )}
              <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {company.prospects.length} prospects</span>
                <span>{company.intel.length} intel entries</span>
                <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> {company.documents.length} docs</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <Button size="sm" variant="outline" onClick={() => setEditing(false)}><X className="h-4 w-4" /></Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={handleEdit}><Pencil className="h-4 w-4" /></Button>
            )}
          </div>
        </div>

        {editing ? (
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Industry</label>
              <Input value={editForm.industry} onChange={(e) => setEditForm({ ...editForm, industry: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Website</label>
              <Input value={editForm.website} onChange={(e) => setEditForm({ ...editForm, website: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Size</label>
              <Input value={editForm.size} onChange={(e) => setEditForm({ ...editForm, size: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">HQ Location</label>
              <Input value={editForm.hqLocation} onChange={(e) => setEditForm({ ...editForm, hqLocation: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Notes</label>
              <textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} className="w-full rounded-lg border border-border bg-background p-2 text-sm" rows={3} />
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            {company.industry && <span className="rounded-lg bg-muted px-3 py-1">{company.industry}</span>}
            {company.website && (
              <a href={company.website.startsWith("http") ? company.website : `https://${company.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                <ExternalLink className="h-3.5 w-3.5" /> {company.website}
              </a>
            )}
            {company.size && <span className="text-muted-foreground">{company.size}</span>}
            {company.hqLocation && <span className="text-muted-foreground">{company.hqLocation}</span>}
          </div>
        )}
      </div>

      {/* Battlecard */}
      <div className="rounded-xl border border-border bg-card shadow-soft">
        <button
          onClick={() => setBattlecardOpen(!battlecardOpen)}
          className="flex w-full items-center justify-between p-5 text-left"
        >
          <h2 className="text-lg font-semibold">Account Battlecard</h2>
          <div className="flex items-center gap-3">
            {company.synthStatus === "pending" && (
              <span className="flex items-center gap-1.5 text-xs text-yellow-600"><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Synthesizing...</span>
            )}
            {company.synthStatus === "failed" && (
              <span className="flex items-center gap-1.5 text-xs text-red-600"><AlertCircle className="h-3.5 w-3.5" /> Failed</span>
            )}
            {company.lastSynthesizedAt && (
              <span className="text-xs text-muted-foreground">
                Updated {new Date(company.lastSynthesizedAt).toLocaleDateString()}
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => { e.stopPropagation(); handleSynthesize(); }}
              disabled={synthesizing || company.synthStatus === "pending"}
              className="gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${synthesizing ? "animate-spin" : ""}`} />
              {company.battlecard ? "Refresh" : "Generate"}
            </Button>
            {battlecardOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </div>
        </button>

        {battlecardOpen && (
          <div className="border-t border-border p-5">
            {company.synthError && (
              <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-600">
                {company.synthError}
              </div>
            )}
            {Object.keys(battlecardSections).length > 0 ? (
              <div className="space-y-4">
                {["keyContacts", "painPoints", "competitiveSituation", "recentIntel", "nextSteps", "companySnapshot", "strategicPriorities", "risksAndChallenges", "recommendedAngles", "openQuestions"].filter((k) => battlecardSections[k]).map((key) => (
                  <div key={key}>
                    <h3 className="mb-1 text-sm font-semibold capitalize text-foreground">
                      {key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim()}
                    </h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{battlecardValueToStr(battlecardSections[key])}</p>
                  </div>
                ))}
                {Object.entries(battlecardSections).filter(([k]) => !["keyContacts", "painPoints", "competitiveSituation", "recentIntel", "nextSteps", "companySnapshot", "strategicPriorities", "risksAndChallenges", "recommendedAngles", "openQuestions"].includes(k)).map(([key, value]) => (
                  <div key={key}>
                    <h3 className="mb-1 text-sm font-semibold capitalize text-foreground">
                      {key.replace(/([A-Z])/g, " $1").trim()}
                    </h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{battlecardValueToStr(value)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No battlecard yet. Click &quot;Generate&quot; to synthesize company intelligence from all available data.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Competitor Intel (when available) */}
      {company.intel.some((i) => i.type === "competitor") && (
        <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-5 shadow-soft">
          <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
            <span className="inline-flex rounded-md px-2 py-0.5 text-xs font-medium bg-orange-500/10 text-orange-600 dark:text-orange-400">Competitor</span>
            Competitor Intel
          </h2>
          <div className="space-y-3">
            {company.intel.filter((i) => i.type === "competitor").map((entry) => (
              <div key={entry.id} className="rounded-lg border border-orange-500/10 bg-background p-4">
                <p className="text-sm text-foreground">{entry.summary}</p>
                {entry.actionContext && (
                  <div className="mt-2 rounded-md bg-orange-500/5 border border-orange-500/10 px-3 py-2">
                    <p className="text-xs font-medium text-orange-600 dark:text-orange-400">Displacement angle</p>
                    <p className="text-xs text-muted-foreground">{entry.actionContext}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fit Analysis */}
      <FitAnalysisSection companyId={id} />

      {/* Documents */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Documents</h2>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleFindReport} disabled={findingReport} className="gap-1.5">
              {findingReport ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SearchIcon className="h-3.5 w-3.5" />}
              Find Annual Report
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowUpload(!showUpload)} className="gap-1.5">
              <Upload className="h-3.5 w-3.5" />
              Upload
            </Button>
          </div>
        </div>

        {findReportMsg && (
          <div className="mb-4 rounded-lg border border-border bg-muted/30 px-4 py-2.5 text-sm text-foreground whitespace-pre-wrap">
            {findReportMsg}
          </div>
        )}

        {showUpload && (
          <div className="mb-4 rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <div className="flex gap-2">
              <Button size="sm" variant={uploadMode === "file" ? "default" : "outline"} onClick={() => setUploadMode("file")} className="gap-1.5">
                <Upload className="h-3 w-3" /> File
              </Button>
              <Button size="sm" variant={uploadMode === "url" ? "default" : "outline"} onClick={() => setUploadMode("url")} className="gap-1.5">
                <LinkIcon className="h-3 w-3" /> URL
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Select value={docType} onChange={(e) => setDocType(e.target.value)} className="rounded-lg h-9 w-auto min-w-[140px] px-3 py-2 text-sm">
                <option value="annual_report">Annual Report</option>
                <option value="earnings">Earnings</option>
                <option value="press_release">Press Release</option>
                <option value="filing">Filing</option>
                <option value="other">Other</option>
              </Select>
              {uploadMode === "file" ? (
                <>
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".pdf" className="hidden" />
                  <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Choose PDF"}
                  </Button>
                </>
              ) : (
                <>
                  <Input placeholder="Document URL..." value={docUrl} onChange={(e) => setDocUrl(e.target.value)} className="flex-1" />
                  <Input placeholder="Title (optional)" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} className="w-48" />
                  <Button size="sm" onClick={handleUrlUpload} disabled={uploading || !docUrl.trim()}>
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {company.documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents yet.</p>
        ) : (
          <div className="space-y-2">
            {company.documents.map((doc) => {
              const isActive = doc.status === "processing" || doc.status === "pending";
              const stageLabels: Record<string, string> = {
                downloading: "Downloading document...",
                parsing: "Extracting text from PDF...",
                extracting: "AI analyzing content...",
                saving: "Saving intelligence...",
                done: "Complete",
              };
              const stageLabel = doc.processingStage ? stageLabels[doc.processingStage] || doc.processingStage : "Queued";
              const pct = doc.processingPct || 0;

              return (
                <div key={doc.id} className="rounded-lg border border-border/50 bg-background p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <span className="text-sm font-medium">{doc.title}</span>
                        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase font-medium text-muted-foreground">
                          {doc.type.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {doc.status === "completed" && (
                        <Link href={`/companies/${id}/documents/${doc.id}`} className="text-primary hover:underline text-xs flex items-center gap-1">
                          <FileText className="h-3 w-3" /> Open viewer
                        </Link>
                      )}
                      {doc.sourceUrl && (
                        <a href={doc.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground text-xs flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" /> Source
                        </a>
                      )}
                      {doc.status === "completed" && (
                        <span className="flex items-center gap-1 text-xs text-green-600">
                          <CheckCircle2 className="h-3 w-3" /> Done
                        </span>
                      )}
                      {doc.status === "failed" && (
                        <div className="flex items-center gap-2">
                          <button
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 transition-colors"
                            onClick={() => {
                              fetch(`/api/companies/${id}/documents/process`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ documentId: doc.id }),
                              }).catch(() => {});
                              setTimeout(fetchCompany, 1000);
                            }}
                            title="Retry processing with same URL"
                          >
                            <RefreshCw className="h-3 w-3" /> Retry
                          </button>
                          <button
                            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 transition-colors"
                            onClick={() => setConfirmDeleteDocId(doc.id)}
                            title="Delete this document"
                          >
                            <Trash2 className="h-3 w-3" /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Progress bar for active processing */}
                  {isActive && (
                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-xs text-blue-600">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {stageLabel}
                        </span>
                        <span className="text-xs text-muted-foreground font-medium">{pct}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all duration-500 ease-out"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Error message for failed processing */}
                  {doc.status === "failed" && doc.processingError && (
                    <div className="mt-2 rounded-md bg-red-500/5 border border-red-500/15 px-3 py-2">
                      <p className="text-xs text-red-600">{doc.processingError}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Intel Feed */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Intelligence Feed</h2>
          <Button size="sm" variant="outline" onClick={() => setShowAddIntel(!showAddIntel)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add Intel
          </Button>
        </div>

        {showAddIntel && (
          <div className="mb-4 rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <div className="flex gap-3">
              <Select value={intelForm.type} onChange={(e) => setIntelForm({ ...intelForm, type: e.target.value })} className="rounded-lg h-9 w-auto min-w-[120px] px-3 py-2 text-sm">
                {Object.entries(INTEL_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
              <Select value={String(intelForm.urgencyScore)} onChange={(e) => setIntelForm({ ...intelForm, urgencyScore: Number(e.target.value) })} className="rounded-lg h-9 w-auto min-w-[100px] px-3 py-2 text-sm">
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>Urgency {n}</option>
                ))}
              </Select>
            </div>
            <textarea
              placeholder="What happened? Be specific..."
              value={intelForm.summary}
              onChange={(e) => setIntelForm({ ...intelForm, summary: e.target.value })}
              className="w-full rounded-lg border border-border bg-background p-3 text-sm"
              rows={3}
            />
            <div className="flex gap-2">
              <Input placeholder="Source URL (optional)" value={intelForm.sourceUrl} onChange={(e) => setIntelForm({ ...intelForm, sourceUrl: e.target.value })} className="flex-1" />
              <Button size="sm" onClick={handleAddIntel} disabled={addingIntel || !intelForm.summary.trim()}>
                {addingIntel ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </div>
        )}

        {company.intel.length === 0 ? (
          <p className="text-sm text-muted-foreground">No intelligence entries yet.</p>
        ) : (
          <div className="space-y-3">
            {company.intel.map((entry) => (
              <div key={entry.id} className="rounded-lg border border-border/50 bg-background p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ${INTEL_TYPE_COLORS[entry.type] || INTEL_TYPE_COLORS.other}`}>
                      {INTEL_TYPE_LABELS[entry.type] || entry.type}
                    </span>
                    {entry.date && (
                      <span className="text-xs text-muted-foreground">{new Date(entry.date).toLocaleDateString()}</span>
                    )}
                    {entry.urgencyScore >= 4 && (
                      <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-600">High priority</span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="mt-2 text-sm text-foreground">{entry.summary}</p>
                {entry.actionContext && (
                  <div className="mt-2 rounded-md bg-primary/5 border border-primary/10 px-3 py-2">
                    <p className="text-xs font-medium text-primary">So what?</p>
                    <p className="text-xs text-muted-foreground">{entry.actionContext}</p>
                  </div>
                )}
                {(() => {
                  // Document-sourced intel: link to the in-app viewer with highlight
                  if (entry.documentId) {
                    const pageMatch = entry.sourceRef?.match(/(?:p(?:age)?\.?\s*)(\d+)/i);
                    const pageNum = pageMatch ? pageMatch[1] : null;
                    const params = new URLSearchParams();
                    if (pageNum) params.set("page", pageNum);
                    if (entry.sourceQuote) params.set("highlight", entry.sourceQuote);
                    const viewerUrl = `/companies/${id}/documents/${entry.documentId}${params.toString() ? `?${params}` : ""}`;
                    return (
                      <Link href={viewerUrl} className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                        <FileText className="h-3 w-3 shrink-0" /> {entry.sourceRef || "View in document"}
                      </Link>
                    );
                  }
                  // External URL intel
                  const linkUrl = entry.sourceUrl || entry.document?.viewUrl || null;
                  if (entry.sourceRef && linkUrl) {
                    return (
                      <a href={linkUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                        <ExternalLink className="h-3 w-3 shrink-0" /> {entry.sourceRef}
                      </a>
                    );
                  }
                  if (entry.sourceRef) {
                    return <p className="mt-1 text-xs text-muted-foreground">Source: {entry.sourceRef}</p>;
                  }
                  if (linkUrl) {
                    return (
                      <a href={linkUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                        <ExternalLink className="h-3 w-3 shrink-0" /> View source
                      </a>
                    );
                  }
                  return null;
                })()}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Linked Prospects */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Linked Prospects</h2>
          <Button size="sm" variant="outline" onClick={() => { const next = !showLinkProspect; setShowLinkProspect(next); if (next) loadSuggestions(); }} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Link Prospect
          </Button>
        </div>

        {showLinkProspect && (
          <div className="mb-4 rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search prospects by name, email, or company..."
                value={prospectSearch}
                onChange={(e) => handleProspectSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {searchingProspects && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Searching...
              </div>
            )}
            {prospectResults.length > 0 && (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {prospectResults.map((p) => {
                  const alreadyLinked = p.companyId === id;
                  return (
                    <div key={p.id} className="flex items-center justify-between rounded-lg border border-border/50 bg-background p-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                          <User className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div>
                          <span className="text-sm font-medium">{p.firstName} {p.lastName}</span>
                          {p.title && <span className="ml-1.5 text-xs text-muted-foreground">{p.title}</span>}
                          {p.company && !alreadyLinked && <span className="ml-1.5 text-xs text-muted-foreground/60">({p.company})</span>}
                        </div>
                      </div>
                      {alreadyLinked ? (
                        <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Linked
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleLinkProspect(p.id)}
                          disabled={linkingId === p.id}
                          className="h-7 px-2.5 text-xs"
                        >
                          {linkingId === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Link"}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {prospectSearch.length >= 2 && !searchingProspects && prospectResults.length === 0 && (
              <p className="text-xs text-muted-foreground">No matching prospects found. Try a different name or email.</p>
            )}
            {prospectSearch.length < 2 && !searchingProspects && prospectResults.length > 0 && (
              <p className="text-xs text-muted-foreground mb-1">Suggested matches based on company name:</p>
            )}
          </div>
        )}

        {company.prospects.length === 0 ? (
          <p className="text-sm text-muted-foreground">No prospects linked to this company.</p>
        ) : (
          <div className="space-y-2">
            {company.prospects.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-border/50 bg-background p-3 hover:bg-muted/30 transition-colors">
                <Link href={`/prospects/${p.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm font-medium">{p.firstName} {p.lastName}</span>
                    {p.title && <span className="ml-2 text-xs text-muted-foreground">{p.title}</span>}
                  </div>
                </Link>
                <div className="flex items-center gap-3 shrink-0">
                  {p.roleArchetype && (
                    <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium capitalize">{p.roleArchetype}</span>
                  )}
                  {p.lastContactedAt && (
                    <span className="text-xs text-muted-foreground">
                      Contacted {new Date(p.lastContactedAt).toLocaleDateString()}
                    </span>
                  )}
                  <button
                    onClick={() => setConfirmUnlinkId(p.id)}
                    disabled={linkingId === p.id}
                    className="text-muted-foreground/40 hover:text-red-500 transition-colors p-1"
                    title="Unlink prospect"
                  >
                    {linkingId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Document Confirmation */}
      <Dialog open={!!confirmDeleteDocId} onOpenChange={(open) => !open && setConfirmDeleteDocId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this document? All extracted intelligence from this document will also be removed. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteDocId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirmDeleteDocId) {
                  handleDeleteDoc(confirmDeleteDocId);
                  setConfirmDeleteDocId(null);
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unlink Prospect Confirmation */}
      <Dialog open={!!confirmUnlinkId} onOpenChange={(open) => !open && setConfirmUnlinkId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unlink Prospect</DialogTitle>
            <DialogDescription>
              Are you sure you want to unlink this prospect from {company.name}? The prospect will remain in your database but won&apos;t be associated with this company.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmUnlinkId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirmUnlinkId) {
                  handleUnlinkProspect(confirmUnlinkId);
                  setConfirmUnlinkId(null);
                }
              }}
            >
              Unlink
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

