"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  Globe,
  Loader2,
  Pencil,
  Save,
  RefreshCw,
  Plus,
  X,
  ChevronDown,
  ChevronRight,
  Building2,
  Target,
  Shield,
  Swords,
  Users,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  FileText,
} from "lucide-react";

interface StructuredOffering {
  name: string;
  problemSolved: string;
  idealBuyer: string;
  proofPoints: string[];
  linkedContentIds: string[];
  competitiveAlternatives: string[];
}

interface ICPDimensions {
  employeeRange: { min: number; max: number };
  revenueRange: { min: string; max: string };
  geographies: string[];
  industries: string[];
  techSignals: string[];
  buyingTriggers: string[];
  disqualifiers: string[];
}

interface CompetitorProfile {
  name: string;
  whereWeWin: string;
  whereTheyWin: string;
  displacementPlay: string;
}

interface Profile {
  id: string;
  name: string | null;
  website: string | null;
  valueProposition: string | null;
  offerings: string | null;
  icp: string | null;
  competitors: string | null;
  targetIndustries: string | null;
  targetPersonas: string | null;
  differentiators: string | null;
  painPointsSolved: string | null;
  fullProfile: string | null;
  status: string;
  profileVersionHash: string | null;
  lastAnalyzedAt: string | null;
}

function parseJson<T>(val: string | null, fallback: T): T {
  if (!val) return fallback;
  try {
    return JSON.parse(val) as T;
  } catch {
    return fallback;
  }
}

export default function MyCompanyPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isContentStale, setIsContentStale] = useState(false);
  const [staleFitCount, setStaleFitCount] = useState(0);
  const [editing, setEditing] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const { toast } = useToast();

  const [editData, setEditData] = useState({
    name: "",
    valueProposition: "",
    offerings: [] as StructuredOffering[],
    icp: {
      employeeRange: { min: 0, max: 0 },
      revenueRange: { min: "", max: "" },
      geographies: [] as string[],
      industries: [] as string[],
      techSignals: [] as string[],
      buyingTriggers: [] as string[],
      disqualifiers: [] as string[],
    } as ICPDimensions,
    competitors: [] as CompetitorProfile[],
    targetPersonas: [] as string[],
    differentiators: [] as string[],
    painPointsSolved: [] as string[],
    fullProfile: "",
  });

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/company-profile");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setProfile(data.profile);
      setIsContentStale(data.isContentStale);
      setStaleFitCount(data.staleFitCount);
      if (data.profile) {
        populateEditData(data.profile);
      }
    } catch {
      toast("Failed to load company profile", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  function populateEditData(p: Profile) {
    setEditData({
      name: p.name || "",
      valueProposition: p.valueProposition || "",
      offerings: parseJson<StructuredOffering[]>(p.offerings, []),
      icp: parseJson<ICPDimensions>(p.icp, {
        employeeRange: { min: 0, max: 0 },
        revenueRange: { min: "", max: "" },
        geographies: [],
        industries: [],
        techSignals: [],
        buyingTriggers: [],
        disqualifiers: [],
      }),
      competitors: parseJson<CompetitorProfile[]>(p.competitors, []),
      targetPersonas: parseJson<string[]>(p.targetPersonas, []),
      differentiators: parseJson<string[]>(p.differentiators, []),
      painPointsSolved: parseJson<string[]>(p.painPointsSolved, []),
      fullProfile: p.fullProfile || "",
    });
  }

  const handleGenerate = async () => {
    if (!websiteUrl.trim()) {
      toast("Please enter a website URL", "error");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/company-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ website: websiteUrl }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate profile");
      }
      const data = await res.json();
      setProfile(data.profile);
      populateEditData(data.profile);
      setEditing(true);
      toast("Profile generated! Review and publish when ready.", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Generation failed", "error");
    } finally {
      setGenerating(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/company-profile/refresh", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Refresh failed");
      }
      const data = await res.json();
      setProfile(data.profile);
      populateEditData(data.profile);
      setEditing(true);
      toast("Profile refreshed with latest content. Review and publish.", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Refresh failed", "error");
    } finally {
      setRefreshing(false);
    }
  };

  const handlePublish = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/company-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editData, publish: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to publish");
      setProfile(data.profile);
      setEditing(false);
      toast("Profile published! Fit analysis can now use this profile.", "success");
      fetchProfile();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to publish profile", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/company-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setProfile(data.profile);
      toast("Draft saved", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save draft", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mb-4 h-8 w-8 animate-spin" />
        <p className="text-sm font-medium">Loading company profile...</p>
      </div>
    );
  }

  // Empty state
  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl animate-fade-in">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Set Up Your Company Profile</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your company website URL. We&apos;ll analyze it along with your Content Library
            to build a comprehensive sales profile with structured offerings, ICP, and competitive landscape.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold">Company Website</label>
                <Input
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://www.yourcompany.com"
                />
              </div>
              <Button onClick={handleGenerate} disabled={generating} className="gap-2">
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {generating ? "Analyzing..." : "Build Profile"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Edit mode
  if (editing || profile.status === "draft") {
    return (
      <div className="mx-auto max-w-4xl animate-fade-in">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {profile.status === "draft" ? "Review Your Profile" : "Edit Profile"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Review and adjust the AI-generated profile, then publish to activate fit mapping.
            </p>
          </div>
          <div className="flex gap-2">
            {profile.status === "published" && (
              <Button variant="outline" onClick={() => { populateEditData(profile); setEditing(false); }}>
                Cancel
              </Button>
            )}
            <Button variant="outline" onClick={handleSaveDraft} disabled={saving} className="gap-2">
              <Save className="h-4 w-4" />
              Save Draft
            </Button>
            <Button onClick={handlePublish} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Publish
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {/* Name & Value Prop */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-4 w-4" /> Company Identity</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold">Company Name</label>
                <Input value={editData.name} onChange={(e) => setEditData((d) => ({ ...d, name: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold">Value Proposition</label>
                <Textarea value={editData.valueProposition} onChange={(e) => setEditData((d) => ({ ...d, valueProposition: e.target.value }))} rows={3} />
              </div>
            </CardContent>
          </Card>

          {/* Offerings */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2"><Target className="h-4 w-4" /> Offerings</CardTitle>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => setEditData((d) => ({
                  ...d,
                  offerings: [...d.offerings, { name: "", problemSolved: "", idealBuyer: "", proofPoints: [], linkedContentIds: [], competitiveAlternatives: [] }],
                }))}>
                  <Plus className="h-3 w-3" /> Add Offering
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {editData.offerings.map((offering, i) => (
                <OfferingEditor
                  key={i}
                  offering={offering}
                  onChange={(updated) => {
                    const next = [...editData.offerings];
                    next[i] = updated;
                    setEditData((d) => ({ ...d, offerings: next }));
                  }}
                  onRemove={() => setEditData((d) => ({ ...d, offerings: d.offerings.filter((_, j) => j !== i) }))}
                />
              ))}
              {editData.offerings.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No offerings defined yet.</p>
              )}
            </CardContent>
          </Card>

          {/* ICP */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" /> Ideal Customer Profile</CardTitle></CardHeader>
            <CardContent>
              <ICPEditor icp={editData.icp} onChange={(icp) => setEditData((d) => ({ ...d, icp }))} />
            </CardContent>
          </Card>

          {/* Competitors */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2"><Swords className="h-4 w-4" /> Competitive Landscape</CardTitle>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => setEditData((d) => ({
                  ...d,
                  competitors: [...d.competitors, { name: "", whereWeWin: "", whereTheyWin: "", displacementPlay: "" }],
                }))}>
                  <Plus className="h-3 w-3" /> Add Competitor
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {editData.competitors.map((comp, i) => (
                <CompetitorEditor
                  key={i}
                  competitor={comp}
                  onChange={(updated) => {
                    const next = [...editData.competitors];
                    next[i] = updated;
                    setEditData((d) => ({ ...d, competitors: next }));
                  }}
                  onRemove={() => setEditData((d) => ({ ...d, competitors: d.competitors.filter((_, j) => j !== i) }))}
                />
              ))}
              {editData.competitors.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No competitors defined yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Target Personas - buying committee roles we sell to */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" /> Target Personas</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">Job titles or roles that typically buy from you (e.g. CTO, VP Sales, CFO). Used for account coverage insights.</p>
              <TagListEditor label="Roles" tags={editData.targetPersonas} onChange={(tags) => setEditData((d) => ({ ...d, targetPersonas: tags }))} />
            </CardContent>
          </Card>

          {/* Tags */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-4 w-4" /> Differentiators & Pain Points</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-4">
              <TagListEditor label="Differentiators" tags={editData.differentiators} onChange={(tags) => setEditData((d) => ({ ...d, differentiators: tags }))} />
              <TagListEditor label="Pain Points Solved" tags={editData.painPointsSolved} onChange={(tags) => setEditData((d) => ({ ...d, painPointsSolved: tags }))} />
            </CardContent>
          </Card>

          {/* Full Profile */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4" /> Full Profile Narrative</CardTitle></CardHeader>
            <CardContent>
              <Textarea value={editData.fullProfile} onChange={(e) => setEditData((d) => ({ ...d, fullProfile: e.target.value }))} rows={8} />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Published view
  const offerings = parseJson<StructuredOffering[]>(profile.offerings, []);
  const icp = parseJson<ICPDimensions | null>(profile.icp, null);
  const competitors = parseJson<CompetitorProfile[]>(profile.competitors, []);
  const personas = parseJson<string[]>(profile.targetPersonas, []);
  const differentiators = parseJson<string[]>(profile.differentiators, []);
  const painPoints = parseJson<string[]>(profile.painPointsSolved, []);

  return (
    <div className="mx-auto max-w-4xl animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{profile.name || "My Company"}</h1>
            <Badge variant="success">Published</Badge>
          </div>
          {profile.lastAnalyzedAt && (
            <p className="mt-1 text-sm text-muted-foreground">
              Last analyzed {new Date(profile.lastAnalyzedAt).toLocaleDateString()}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setEditing(true); populateEditData(profile); }} className="gap-2">
            <Pencil className="h-4 w-4" /> Edit
          </Button>
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing} className="gap-2">
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh from AI
          </Button>
        </div>
      </div>

      {/* Staleness banners */}
      {isContentStale && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <span className="text-amber-800 dark:text-amber-200">Content Library has changed since this profile was last analyzed.</span>
          <Button size="sm" variant="outline" onClick={handleRefresh} disabled={refreshing} className="ml-auto shrink-0">
            Refresh
          </Button>
        </div>
      )}
      {staleFitCount > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-800 dark:bg-blue-950/30">
          <AlertTriangle className="h-4 w-4 shrink-0 text-blue-600" />
          <span className="text-blue-800 dark:text-blue-200">{staleFitCount} company fit score{staleFitCount > 1 ? "s were" : " was"} calculated against a previous version of this profile.</span>
          <a href="/fit-overview" className="ml-auto shrink-0 text-xs font-medium text-blue-700 underline dark:text-blue-300">
            View Fit Overview
          </a>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {/* Value Proposition */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-4 w-4" /> Value Proposition</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{profile.valueProposition}</p>
          </CardContent>
        </Card>

        {/* Offerings */}
        {offerings.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-4 w-4" /> Offerings ({offerings.length})</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3">
              {offerings.map((o, i) => (
                <OfferingReadonly key={i} offering={o} />
              ))}
            </CardContent>
          </Card>
        )}

        {/* ICP */}
        {icp && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" /> Ideal Customer Profile</CardTitle></CardHeader>
            <CardContent>
              <ICPReadonly icp={icp} />
            </CardContent>
          </Card>
        )}

        {/* Competitors */}
        {competitors.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Swords className="h-4 w-4" /> Competitive Landscape ({competitors.length})</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3">
              {competitors.map((c, i) => (
                <CompetitorReadonly key={i} competitor={c} />
              ))}
            </CardContent>
          </Card>
        )}

        {/* Target Personas */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" /> Target Personas</CardTitle></CardHeader>
          <CardContent>
            {personas.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {personas.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No target personas defined. Edit to add roles (e.g. CTO, VP Sales) for account coverage insights.</p>
            )}
          </CardContent>
        </Card>

        {/* Tags */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-4 w-4" /> Differentiators & Pain Points</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            {differentiators.length > 0 && <TagSection label="Differentiators" tags={differentiators} />}
            {painPoints.length > 0 && <TagSection label="Pain Points Solved" tags={painPoints} />}
            {differentiators.length === 0 && painPoints.length === 0 && (
              <p className="text-sm text-muted-foreground">No differentiators or pain points defined yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Full Profile */}
        {profile.fullProfile && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4" /> Full Profile</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{profile.fullProfile}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// --- Sub-components ---

function TagSection({ label, tags }: { label: string; tags: string[] }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}
      </div>
    </div>
  );
}

function TagListEditor({ label, tags, onChange }: { label: string; tags: string[]; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState("");

  const add = () => {
    const trimmed = input.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
      setInput("");
    }
  };

  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold">{label}</label>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <Badge key={t} variant="outline" className="gap-1 pr-1">
            {t}
            <button onClick={() => onChange(tags.filter((x) => x !== t))} className="ml-0.5 rounded p-0.5 hover:bg-muted">
              <X className="h-2.5 w-2.5" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder={`Add ${label.toLowerCase()}...`}
          className="h-8 text-xs"
        />
        <Button size="sm" variant="outline" onClick={add} className="h-8 shrink-0">
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

function OfferingEditor({ offering, onChange, onRemove }: {
  offering: StructuredOffering;
  onChange: (o: StructuredOffering) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 text-sm font-semibold">
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          {offering.name || "New Offering"}
        </button>
        <button onClick={onRemove} className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {expanded && (
        <div className="flex flex-col gap-3">
          <Input value={offering.name} onChange={(e) => onChange({ ...offering, name: e.target.value })} placeholder="Offering name" className="h-8 text-xs" />
          <Textarea value={offering.problemSolved} onChange={(e) => onChange({ ...offering, problemSolved: e.target.value })} placeholder="What problem does this solve?" rows={2} className="text-xs" />
          <Input value={offering.idealBuyer} onChange={(e) => onChange({ ...offering, idealBuyer: e.target.value })} placeholder="Ideal buyer (e.g. VP Engineering)" className="h-8 text-xs" />
          <TagListEditor label="Proof Points" tags={offering.proofPoints} onChange={(proofPoints) => onChange({ ...offering, proofPoints })} />
          <TagListEditor label="Competitive Alternatives" tags={offering.competitiveAlternatives} onChange={(competitiveAlternatives) => onChange({ ...offering, competitiveAlternatives })} />
        </div>
      )}
    </div>
  );
}

function CompetitorEditor({ competitor, onChange, onRemove }: {
  competitor: CompetitorProfile;
  onChange: (c: CompetitorProfile) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 text-sm font-semibold">
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          {competitor.name || "New Competitor"}
        </button>
        <button onClick={onRemove} className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {expanded && (
        <div className="flex flex-col gap-3">
          <Input value={competitor.name} onChange={(e) => onChange({ ...competitor, name: e.target.value })} placeholder="Competitor name" className="h-8 text-xs" />
          <Textarea value={competitor.whereWeWin} onChange={(e) => onChange({ ...competitor, whereWeWin: e.target.value })} placeholder="Where we win against them..." rows={2} className="text-xs" />
          <Textarea value={competitor.whereTheyWin} onChange={(e) => onChange({ ...competitor, whereTheyWin: e.target.value })} placeholder="Where they win against us..." rows={2} className="text-xs" />
          <Textarea value={competitor.displacementPlay} onChange={(e) => onChange({ ...competitor, displacementPlay: e.target.value })} placeholder="Displacement strategy..." rows={2} className="text-xs" />
        </div>
      )}
    </div>
  );
}

function ICPEditor({ icp, onChange }: { icp: ICPDimensions; onChange: (icp: ICPDimensions) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Min Employees</label>
          <Input type="number" value={icp.employeeRange.min || ""} onChange={(e) => onChange({ ...icp, employeeRange: { ...icp.employeeRange, min: Number(e.target.value) } })} className="h-8 text-xs" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Max Employees</label>
          <Input type="number" value={icp.employeeRange.max || ""} onChange={(e) => onChange({ ...icp, employeeRange: { ...icp.employeeRange, max: Number(e.target.value) } })} className="h-8 text-xs" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Min Revenue</label>
          <Input value={icp.revenueRange.min} onChange={(e) => onChange({ ...icp, revenueRange: { ...icp.revenueRange, min: e.target.value } })} placeholder="e.g. 50M" className="h-8 text-xs" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Max Revenue</label>
          <Input value={icp.revenueRange.max} onChange={(e) => onChange({ ...icp, revenueRange: { ...icp.revenueRange, max: e.target.value } })} placeholder="e.g. 2B" className="h-8 text-xs" />
        </div>
      </div>
      <TagListEditor label="Geographies" tags={icp.geographies} onChange={(geographies) => onChange({ ...icp, geographies })} />
      <TagListEditor label="Industries" tags={icp.industries} onChange={(industries) => onChange({ ...icp, industries })} />
      <TagListEditor label="Tech Signals" tags={icp.techSignals} onChange={(techSignals) => onChange({ ...icp, techSignals })} />
      <TagListEditor label="Buying Triggers" tags={icp.buyingTriggers} onChange={(buyingTriggers) => onChange({ ...icp, buyingTriggers })} />
      <TagListEditor label="Disqualifiers" tags={icp.disqualifiers} onChange={(disqualifiers) => onChange({ ...icp, disqualifiers })} />
    </div>
  );
}

function OfferingReadonly({ offering }: { offering: StructuredOffering }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-border p-3">
      <button onClick={() => setExpanded(!expanded)} className="flex w-full items-center justify-between">
        <span className="text-sm font-semibold">{offering.name}</span>
        {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {expanded && (
        <div className="mt-3 flex flex-col gap-2 text-xs text-muted-foreground">
          <div><span className="font-semibold text-foreground">Problem:</span> {offering.problemSolved}</div>
          <div><span className="font-semibold text-foreground">Ideal Buyer:</span> {offering.idealBuyer}</div>
          {offering.proofPoints.length > 0 && (
            <div><span className="font-semibold text-foreground">Proof Points:</span> {offering.proofPoints.join("; ")}</div>
          )}
          {offering.competitiveAlternatives.length > 0 && (
            <div><span className="font-semibold text-foreground">Competes With:</span> {offering.competitiveAlternatives.join(", ")}</div>
          )}
        </div>
      )}
    </div>
  );
}

function CompetitorReadonly({ competitor }: { competitor: CompetitorProfile }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-border p-3">
      <button onClick={() => setExpanded(!expanded)} className="flex w-full items-center justify-between">
        <span className="text-sm font-semibold">{competitor.name}</span>
        {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {expanded && (
        <div className="mt-3 flex flex-col gap-2 text-xs text-muted-foreground">
          <div><span className="font-semibold text-foreground">We Win:</span> {competitor.whereWeWin}</div>
          <div><span className="font-semibold text-foreground">They Win:</span> {competitor.whereTheyWin}</div>
          <div><span className="font-semibold text-foreground">Displacement:</span> {competitor.displacementPlay}</div>
        </div>
      )}
    </div>
  );
}

function ICPReadonly({ icp }: { icp: ICPDimensions }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div>
          <span className="font-semibold">Employees:</span>{" "}
          <span className="text-muted-foreground">{icp.employeeRange.min.toLocaleString()} - {icp.employeeRange.max.toLocaleString()}</span>
        </div>
        <div>
          <span className="font-semibold">Revenue:</span>{" "}
          <span className="text-muted-foreground">{icp.revenueRange.min} - {icp.revenueRange.max}</span>
        </div>
      </div>
      {icp.geographies.length > 0 && <TagSection label="Geographies" tags={icp.geographies} />}
      {icp.industries.length > 0 && <TagSection label="Industries" tags={icp.industries} />}
      {icp.techSignals.length > 0 && <TagSection label="Tech Signals" tags={icp.techSignals} />}
      {icp.buyingTriggers.length > 0 && <TagSection label="Buying Triggers" tags={icp.buyingTriggers} />}
      {icp.disqualifiers.length > 0 && <TagSection label="Disqualifiers" tags={icp.disqualifiers} />}
    </div>
  );
}
