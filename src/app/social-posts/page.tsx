"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { SOCIAL_CONTENT_TYPES, SERIES_ARCS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  Copy,
  ChevronDown,
  Loader2,
  Search,
  Building2,
  User,
  Lightbulb,
  Share2,
} from "lucide-react";

interface Company {
  id: string;
  name: string;
  industry?: string | null;
}

interface Prospect {
  id: string;
  firstName: string;
  lastName: string;
  title?: string | null;
  company?: string | null;
}

interface Signal {
  id: string;
  type: string;
  summary: string | null;
  rawContent: string | null;
  outreachAngle: string | null;
}

interface Intel {
  id: string;
  type: string;
  summary: string;
  actionContext: string | null;
}

const REDRAFT_OPTIONS = [
  { label: "More casual", instruction: "Make the tone more casual and friendly" },
  { label: "More formal", instruction: "Make the tone more formal and professional" },
  { label: "Shorter", instruction: "Make it shorter and more concise" },
  { label: "Add a question", instruction: "Add a provocative question to spark comments" },
];

export default function SocialPostsPage() {
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [targetType, setTargetType] = useState<"account" | "persona">("account");
  const [companySearch, setCompanySearch] = useState("");
  const [prospectSearch, setProspectSearch] = useState("");
  const [personaDesc, setPersonaDesc] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [companySearching, setCompanySearching] = useState(false);
  const [prospectSearching, setProspectSearching] = useState(false);

  const [signals, setSignals] = useState<Signal[]>([]);
  const [intel, setIntel] = useState<Intel[]>([]);
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(null);
  const [selectedIntelId, setSelectedIntelId] = useState<string | null>(null);

  const [contentType, setContentType] = useState("thought_leadership");
  const [voice, setVoice] = useState<"formal" | "informal">("informal");
  const [antiAI, setAntiAI] = useState(true);
  const [includeHashtags, setIncludeHashtags] = useState(true);
  const [language, setLanguage] = useState("en");

  const [series, setSeries] = useState(false);
  const [seriesCount, setSeriesCount] = useState(3);
  const [seriesArc, setSeriesArc] = useState("problem_insight_cta");

  const [generating, setGenerating] = useState(false);
  const [redrafting, setRedrafting] = useState(false);
  const [showRedraftMenu, setShowRedraftMenu] = useState(false);
  const [showCustomRedraft, setShowCustomRedraft] = useState(false);
  const [customRedraftInstruction, setCustomRedraftInstruction] = useState("");

  const [post, setPost] = useState<string | null>(null);
  const [posts, setPosts] = useState<{ body: string; theme: string; partLabel?: string }[]>([]);
  const [displayIndex, setDisplayIndex] = useState(0);

  // Pre-fill from URL params
  useEffect(() => {
    const companyId = searchParams.get("companyId");
    const prospectId = searchParams.get("prospectId");
    const signalId = searchParams.get("signalId");
    const intelId = searchParams.get("intelId");

    if (companyId) {
      setTargetType("account");
      fetch(`/api/companies/${companyId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((c) => {
          if (c && c.id) {
            setSelectedCompany({ id: c.id, name: c.name, industry: c.industry });
            setCompanySearch(c.name);
          }
        })
        .catch(() => {});
      if (intelId) setSelectedIntelId(intelId);
    }
    if (prospectId) {
      setTargetType("persona");
      fetch(`/api/prospects/${prospectId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((p) => {
          if (p && p.id) {
            setSelectedProspect({
              id: p.id,
              firstName: p.firstName,
              lastName: p.lastName,
              title: p.title,
              company: p.company,
            });
            setProspectSearch(`${p.firstName} ${p.lastName}`);
          }
        })
        .catch(() => {});
      if (signalId) setSelectedSignalId(signalId);
    }
  }, [searchParams]);

  // Company search
  useEffect(() => {
    if (companySearch.length < 2) {
      setCompanies([]);
      return;
    }
    const t = setTimeout(() => {
      setCompanySearching(true);
      fetch(`/api/companies?search=${encodeURIComponent(companySearch)}&limit=10`)
        .then((r) => r.json())
        .then((d) => setCompanies(d.data || []))
        .catch(() => setCompanies([]))
        .finally(() => setCompanySearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [companySearch]);

  // Prospect search
  useEffect(() => {
    if (prospectSearch.length < 2) {
      setProspects([]);
      return;
    }
    const t = setTimeout(() => {
      setProspectSearching(true);
      fetch(`/api/prospects?q=${encodeURIComponent(prospectSearch)}&limit=10`)
        .then((r) => r.json())
        .then((d) => setProspects(d.data || []))
        .catch(() => setProspects([]))
        .finally(() => setProspectSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [prospectSearch]);

  // Load signals (Persona) or intel (Account)
  useEffect(() => {
    if (targetType === "persona" && selectedProspect?.id) {
      fetch(`/api/signals?prospectId=${selectedProspect.id}&limit=20`)
        .then((r) => r.json())
        .then((d) => setSignals(d.data || []))
        .catch(() => setSignals([]));
    } else {
      setSignals([]);
      setSelectedSignalId(null);
    }
    if (targetType === "account" && selectedCompany?.id) {
      fetch(`/api/companies/${selectedCompany.id}/intel`)
        .then((r) => r.json())
        .then((d) => setIntel(Array.isArray(d) ? d : []))
        .catch(() => setIntel([]));
    } else {
      setIntel([]);
      setSelectedIntelId(null);
    }
  }, [targetType, selectedProspect?.id, selectedCompany?.id]);

  const targetId = targetType === "account" ? selectedCompany?.id : selectedProspect?.id;
  const canGenerate =
    (targetType === "account" && selectedCompany) ||
    (targetType === "persona" && (selectedProspect || personaDesc.trim().length >= 10));

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) return;
    setGenerating(true);
    setPost(null);
    setPosts([]);
    try {
      const body = {
        targetType,
        targetId: targetId || undefined,
        personaDesc: targetType === "persona" && !selectedProspect ? personaDesc : undefined,
        signalId: targetType === "persona" ? selectedSignalId || undefined : undefined,
        intelId: targetType === "account" ? selectedIntelId || undefined : undefined,
        voice,
        antiAI,
        contentType,
        includeHashtags,
        series,
        seriesCount: series ? seriesCount : undefined,
        seriesArc: series ? seriesArc : undefined,
        language,
      };

      const res = await fetch("/api/social-posts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate");
      }

      const data = await res.json();
      if (data.posts && data.posts.length > 0) {
        setPosts(data.posts);
        setPost(data.posts[0].body);
        setDisplayIndex(0);
      } else if (data.body) {
        setPost(data.body);
        setPosts([]);
      } else {
        throw new Error("Invalid response");
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to generate post", "error");
    } finally {
      setGenerating(false);
    }
  }, [
    canGenerate,
    targetType,
    targetId,
    selectedProspect,
    personaDesc,
    selectedSignalId,
    selectedIntelId,
    voice,
    antiAI,
    contentType,
    includeHashtags,
    series,
    seriesCount,
    seriesArc,
    language,
    toast,
  ]);

  const currentPostBody = useMemo(() => {
    if (posts.length > 0 && displayIndex < posts.length) {
      return posts[displayIndex].body;
    }
    return post;
  }, [post, posts, displayIndex]);

  const handleRedraft = useCallback(
    async (instruction: string) => {
      if (!currentPostBody) return;
      setRedrafting(true);
      setShowRedraftMenu(false);
      setShowCustomRedraft(false);
      try {
        const res = await fetch("/api/social-posts/redraft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            originalPost: currentPostBody,
            instruction,
            targetType,
            targetId,
            personaDesc: targetType === "persona" && !selectedProspect ? personaDesc : undefined,
            voice,
            language,
          }),
        });
        if (!res.ok) throw new Error("Redraft failed");
        const data = await res.json();
        if (posts.length > 0) {
          const next = [...posts];
          next[displayIndex] = { ...next[displayIndex], body: data.body };
          setPosts(next);
          setPost(data.body);
        } else {
          setPost(data.body);
        }
      } catch {
        toast("Failed to redraft. Please try again.", "error");
      } finally {
        setRedrafting(false);
      }
    },
    [currentPostBody, posts, displayIndex, targetType, targetId, selectedProspect, personaDesc, voice, language, toast]
  );

  const handleCopy = useCallback(() => {
    if (!currentPostBody) return;
    navigator.clipboard.writeText(currentPostBody);
    toast("Copied to clipboard", "success");
  }, [currentPostBody, toast]);

  const hookLength = currentPostBody
    ? currentPostBody.split("\n")[0]?.length ?? 0
    : 0;
  const charCount = currentPostBody?.length ?? 0;
  const hookOk = hookLength <= 140;
  const charOk = charCount >= 400 && charCount <= 2000;

  return (
    <div className="mx-auto max-w-6xl animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Social Posts
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create LinkedIn posts tailored for sales motions — thought leadership, stories, questions.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: config */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Target audience</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-1 rounded-lg border border-border p-0.5">
                <button
                  onClick={() => setTargetType("account")}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    targetType === "account"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Building2 className="h-3.5 w-3.5" />
                  Account
                </button>
                <button
                  onClick={() => setTargetType("persona")}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    targetType === "persona"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <User className="h-3.5 w-3.5" />
                  Persona
                </button>
              </div>

              {targetType === "account" ? (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search companies..."
                    value={companySearch}
                    onChange={(e) => {
                      setCompanySearch(e.target.value);
                      if (!e.target.value) setSelectedCompany(null);
                    }}
                    className="pl-9"
                  />
                  {companySearching && (
                    <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                  )}
                  {selectedCompany && (
                    <div className="mt-2 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-2">
                      <span className="text-sm font-medium">{selectedCompany.name}</span>
                      <button
                        onClick={() => {
                          setSelectedCompany(null);
                          setCompanySearch("");
                        }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        ×
                      </button>
                    </div>
                  )}
                  {companies.length > 0 && !selectedCompany && (
                    <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-xl border border-border bg-card shadow-elevated">
                      {companies.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setSelectedCompany(c);
                            setCompanySearch(c.name);
                            setCompanies([]);
                          }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-muted first:rounded-t-xl last:rounded-b-xl"
                        >
                          {c.name}
                          {c.industry ? ` · ${c.industry}` : ""}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search prospects..."
                      value={prospectSearch}
                      onChange={(e) => {
                        setProspectSearch(e.target.value);
                        if (!e.target.value) setSelectedProspect(null);
                      }}
                      className="pl-9"
                    />
                    {prospectSearching && (
                      <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                    )}
                    {selectedProspect && (
                      <div className="mt-2 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-2">
                        <span className="text-sm font-medium">
                          {selectedProspect.firstName} {selectedProspect.lastName}
                          {selectedProspect.title ? ` · ${selectedProspect.title}` : ""}
                        </span>
                        <button
                          onClick={() => {
                            setSelectedProspect(null);
                            setProspectSearch("");
                          }}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          ×
                        </button>
                      </div>
                    )}
                    {prospects.length > 0 && !selectedProspect && (
                      <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-xl border border-border bg-card shadow-elevated">
                        {prospects.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => {
                              setSelectedProspect(p);
                              setProspectSearch(`${p.firstName} ${p.lastName}`);
                              setProspects([]);
                            }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-muted first:rounded-t-xl last:rounded-b-xl"
                          >
                            {p.firstName} {p.lastName}
                            {p.title ? ` · ${p.title}` : ""}
                            {p.company ? `, ${p.company}` : ""}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Or describe your target persona:</p>
                  <Textarea
                    placeholder="e.g. VP Operations at mid-market manufacturer, focused on cost reduction..."
                    value={personaDesc}
                    onChange={(e) => setPersonaDesc(e.target.value)}
                    rows={2}
                    className="text-sm"
                  />
                </div>
              )}

              {/* Trigger picker */}
              {(selectedCompany || selectedProspect || personaDesc) && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Anchor to a trigger (optional)
                  </label>
                  {targetType === "account" ? (
                    <select
                      value={selectedIntelId || ""}
                      onChange={(e) => setSelectedIntelId(e.target.value || null)}
                      className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                    >
                      <option value="">No trigger — general thought leadership</option>
                      {intel.map((i) => (
                        <option key={i.id} value={i.id}>
                          [{i.type}] {i.summary.slice(0, 60)}...
                        </option>
                      ))}
                      {intel.length === 0 && (
                        <option value="" disabled>No recent intel</option>
                      )}
                    </select>
                  ) : (
                    <select
                      value={selectedSignalId || ""}
                      onChange={(e) => setSelectedSignalId(e.target.value || null)}
                      className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                    >
                      <option value="">No trigger — general thought leadership</option>
                      {signals.map((s) => (
                        <option key={s.id} value={s.id}>
                          [{s.type}] {s.summary?.slice(0, 60) || s.rawContent?.slice(0, 60) || "..."}...
                        </option>
                      ))}
                      {signals.length === 0 && (
                        <option value="" disabled>No recent signals</option>
                      )}
                    </select>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Post type</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Post type">
                {SOCIAL_CONTENT_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setContentType(t.value)}
                    aria-pressed={contentType === t.value}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold transition-all",
                      contentType === t.value
                        ? "bg-card text-foreground shadow-soft border border-border"
                        : "bg-muted/60 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {t.label}
                    {t.promotional && (
                      <span className="text-[10px] text-muted-foreground" title="Use ~20% of the time">
                        ~20%
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <details className="rounded-lg border border-border bg-card">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
              Options
            </summary>
            <div className="border-t border-border px-4 py-3 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Voice:</span>
                <div className="flex gap-1 rounded-lg border border-border p-0.5">
                  <button
                    onClick={() => setVoice("formal")}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium",
                      voice === "formal" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Formal
                  </button>
                  <button
                    onClick={() => setVoice("informal")}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium",
                      voice === "informal" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Informal
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="antiAI"
                  checked={antiAI}
                  onChange={(e) => setAntiAI(e.target.checked)}
                  className="rounded border-border"
                />
                <label htmlFor="antiAI" className="text-sm">
                  Make it sound human (avoid AI-sounding phrases)
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="hashtags"
                  checked={includeHashtags}
                  onChange={(e) => setIncludeHashtags(e.target.checked)}
                  className="rounded border-border"
                />
                <label htmlFor="hashtags" className="text-sm">
                  Include hashtags
                </label>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Language:</span>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="h-8 rounded-lg border border-border bg-background px-2 text-sm"
                >
                  <option value="en">English</option>
                  <option value="de">German</option>
                </select>
              </div>
            </div>
          </details>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="series"
              checked={series}
              onChange={(e) => setSeries(e.target.checked)}
              className="rounded border-border"
            />
            <label htmlFor="series" className="text-sm">
              Create a series
            </label>
          </div>
          {series && (
            <div className="flex flex-wrap gap-2">
              <select
                value={seriesCount}
                onChange={(e) => setSeriesCount(Number(e.target.value))}
                className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
              >
                {[3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n} posts</option>
                ))}
              </select>
              <select
                value={seriesArc}
                onChange={(e) => setSeriesArc(e.target.value)}
                className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
              >
                {SERIES_ARCS.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>
          )}

          <Button
            onClick={handleGenerate}
            disabled={!canGenerate || generating}
            className="gap-2 w-full"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Generate post{series ? "s" : ""}
          </Button>
        </div>

        {/* Right: result */}
        <div className="space-y-4">
          {generating && (
            <Card>
              <CardContent className="py-8">
                <div className="space-y-3">
                  <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
                  <div className="h-40 w-full animate-pulse rounded-md bg-muted" />
                </div>
              </CardContent>
            </Card>
          )}

          {!generating && currentPostBody && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">LinkedIn preview</CardTitle>
                  {posts.length > 1 && (
                    <div className="flex gap-1">
                      {posts.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setDisplayIndex(i)}
                          className={cn(
                            "h-7 w-7 rounded-md text-xs font-medium",
                            displayIndex === i
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-10 w-10 rounded-full bg-muted" />
                    <div>
                      <p className="text-sm font-semibold">Your name</p>
                      <p className="text-xs text-muted-foreground">Your title · Company</p>
                    </div>
                  </div>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {currentPostBody}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className={cn(hookOk ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400")}>
                    Hook: {hookLength}/140
                  </span>
                  <span className={cn(charOk ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400")}>
                    {charCount} chars
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" onClick={handleCopy} className="gap-1.5">
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </Button>
                  <div className="relative">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowRedraftMenu(!showRedraftMenu)}
                      disabled={redrafting}
                      className="gap-1.5"
                    >
                      {redrafting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                      Revise
                    </Button>
                    {showRedraftMenu && (
                      <div className="absolute left-0 top-full z-10 mt-1 min-w-[180px] rounded-xl border border-border bg-card shadow-elevated py-1">
                        {REDRAFT_OPTIONS.map((o) => (
                          <button
                            key={o.label}
                            onClick={() => handleRedraft(o.instruction)}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-muted first:rounded-t-xl last:rounded-b-xl"
                          >
                            {o.label}
                          </button>
                        ))}
                        <button
                          onClick={() => setShowCustomRedraft(true)}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-muted border-t border-border"
                        >
                          Custom instruction...
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {showCustomRedraft && (
                  <div className="space-y-2">
                    <Textarea
                      placeholder="e.g. Add a specific number or statistic"
                      value={customRedraftInstruction}
                      onChange={(e) => setCustomRedraftInstruction(e.target.value)}
                      rows={2}
                      className="text-sm"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          if (customRedraftInstruction.trim()) {
                            handleRedraft(customRedraftInstruction);
                            setCustomRedraftInstruction("");
                          }
                          setShowCustomRedraft(false);
                        }}
                      >
                        Apply
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setShowCustomRedraft(false);
                          setCustomRedraftInstruction("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer flex items-center gap-1.5">
                    <Lightbulb className="h-3.5 w-3.5" />
                    Tips
                  </summary>
                  <p className="mt-2">
                    Post links in the first comment for ~3x more reach.
                  </p>
                </details>
              </CardContent>
            </Card>
          )}

          {!generating && !post && (
            <Card>
              <CardContent className="py-16 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60">
                  <Share2 className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">
                  Select who this post is for, pick a post type, then generate.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
