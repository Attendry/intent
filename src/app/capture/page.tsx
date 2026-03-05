"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Loader2, Search, X, Sparkles, UserPlus, ExternalLink, Wand2 } from "lucide-react";
import { cleanScrapedContent } from "@/lib/content-cleanup";

interface Prospect {
  id: string;
  firstName: string;
  lastName: string;
  company: string | null;
  title: string | null;
}

interface Company {
  id: string;
  name: string;
}

const SIGNAL_TYPES = [
  { value: "linkedin_post", label: "LinkedIn Post" },
  { value: "job_change", label: "Job Change" },
  { value: "company_news", label: "Company News" },
  { value: "conference", label: "Conference / Event" },
  { value: "hiring", label: "Hiring" },
  { value: "funding", label: "Funding" },
  { value: "partnership", label: "Partnership" },
  { value: "leadership_change", label: "Leadership Change" },
  { value: "re_engagement", label: "Re-engagement" },
  { value: "new_prospect", label: "New Prospect" },
  { value: "other", label: "Other" },
];

function isLinkedInUrl(url: string): boolean {
  return /linkedin\.com/i.test(url);
}

export default function CapturePage() {
  const router = useRouter();
  const [sourceUrl, setSourceUrl] = useState("");
  const [pageTitle, setPageTitle] = useState("");
  const [prospectSearch, setProspectSearch] = useState("");
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [signalType, setSignalType] = useState("linkedin_post");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [searching, setSearching] = useState(false);
  const [lastProspectId, setLastProspectId] = useState<string | null>(null);

  // Lead form (for new prospects)
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [title, setTitle] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [email, setEmail] = useState("");
  const [companySearching, setCompanySearching] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [hasContentFromUrl, setHasContentFromUrl] = useState(false);
  const [captureToken, setCaptureToken] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const url = decodeURIComponent(params.get("url") || "");
    const titleParam = decodeURIComponent(params.get("title") || "");
    const contentParam = decodeURIComponent(params.get("content") || "");
    const token = params.get("token");
    setCaptureToken(token);
    setSourceUrl(url);
    setPageTitle(titleParam);
    if (contentParam) {
      setHasContentFromUrl(true);
      const cleaned = cleanScrapedContent(contentParam);
      setNote((prev) => prev || cleaned.slice(0, 800));
    }
    if (isLinkedInUrl(url)) {
      setLinkedinUrl(url);
      setSignalType("linkedin_post");
    }
  }, []);

  const authHeaders = (): Record<string, string> => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (captureToken) h["X-Capture-Token"] = captureToken;
    return h;
  };

  const searchProspects = useCallback(async (q: string) => {
    if (q.length < 2) {
      setProspects([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/prospects?q=${encodeURIComponent(q)}&limit=5`, {
        headers: captureToken ? { "X-Capture-Token": captureToken } : undefined,
        credentials: "include",
      });
      const data = await res.json();
      setProspects(data.data || []);
    } catch {
      setProspects([]);
    } finally {
      setSearching(false);
    }
  }, [captureToken]);

  const searchCompanies = useCallback(async (q: string) => {
    if (q.length < 2) {
      setCompanies([]);
      return;
    }
    setCompanySearching(true);
    try {
      const res = await fetch(`/api/companies?search=${encodeURIComponent(q)}&limit=5`, {
        headers: captureToken ? { "X-Capture-Token": captureToken } : undefined,
        credentials: "include",
      });
      const data = await res.json();
      setCompanies(data.data || []);
    } catch {
      setCompanies([]);
    } finally {
      setCompanySearching(false);
    }
  }, [captureToken]);

  useEffect(() => {
    const timer = setTimeout(() => searchProspects(prospectSearch), 300);
    return () => clearTimeout(timer);
  }, [prospectSearch, searchProspects]);

  useEffect(() => {
    const timer = setTimeout(() => searchCompanies(companySearch), 300);
    return () => clearTimeout(timer);
  }, [companySearch, searchCompanies]);

  const isNewLead = !selectedProspect && (firstName || lastName || prospectSearch.trim());
  const canSubmit =
    selectedProspect ||
    (prospectSearch.trim().length >= 2) ||
    (firstName.trim() && lastName.trim());

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);

    try {
      const params = new URLSearchParams(window.location.search);
      const rawContent = params.get("content") ? decodeURIComponent(params.get("content")!) : null;
      const content = rawContent ? rawContent.slice(0, 2000) : undefined;

      const payload: Record<string, unknown> = {
        signalType,
        note: note || undefined,
        content,
        sourceUrl: sourceUrl || undefined,
        title: pageTitle || undefined,
        createSignal: true,
      };

      if (selectedProspect) {
        payload.prospectId = selectedProspect.id;
      } else if (firstName.trim() || lastName.trim()) {
        payload.firstName = firstName.trim() || prospectSearch.trim().split(/\s+/)[0] || "Unknown";
        payload.lastName = lastName.trim() || prospectSearch.trim().split(/\s+/).slice(1).join(" ") || "Capture";
        payload.company = selectedCompany?.name || companySearch.trim() || undefined;
        payload.companyId = selectedCompany?.id || undefined;
        payload.jobTitle = title.trim() || undefined;
        payload.linkedinUrl = linkedinUrl.trim() || undefined;
        payload.email = email.trim() || undefined;
      } else {
        payload.prospectName = prospectSearch.trim();
      }

      const res = await fetch("/api/capture", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        setLastProspectId(data.prospect?.id || null);
        setSubmitted(true);
      }
    } catch {
      // silently fail
    } finally {
      setSubmitting(false);
    }
  };

  const handleEnrich = async () => {
    const params = new URLSearchParams(window.location.search);
    const rawContent = params.get("content") ? decodeURIComponent(params.get("content")!) : "";
    const contentToEnrich = rawContent || note;
    if (!contentToEnrich.trim()) return;
    setEnriching(true);
    try {
      const res = await fetch("/api/capture/enrich", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ content: contentToEnrich }),
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.summary) setNote(data.summary);
        if (data.firstName) setFirstName(data.firstName);
        if (data.lastName) setLastName(data.lastName);
        if (data.company) {
          setCompanySearch(data.company);
          setSelectedCompany(null);
        }
        if (data.title) setTitle(data.title);
      }
    } catch {
      // silently fail
    } finally {
      setEnriching(false);
    }
  };

  const handleAddAnother = () => {
    setSubmitted(false);
    setLastProspectId(null);
    setSelectedProspect(null);
    setProspectSearch("");
    setFirstName("");
    setLastName("");
    setCompanySearch("");
    setSelectedCompany(null);
    setTitle("");
    setLinkedinUrl(sourceUrl && isLinkedInUrl(sourceUrl) ? sourceUrl : "");
    setEmail("");
    setNote("");
    setSignalType(isLinkedInUrl(sourceUrl) ? "linkedin_post" : "other");
  };

  if (submitted) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/60 bg-sidebar px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary shadow-soft">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="text-base font-bold tracking-tight text-sidebar-foreground">
              Intent
            </span>
          </Link>
        </header>
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="text-center animate-scale-in space-y-6">
            <div>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl gradient-success shadow-soft">
                <Check className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">
                Signal captured
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Saved to your prospects.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              {lastProspectId && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    router.push(`/prospects/${lastProspectId}`);
                    window.close();
                  }}
                  className="gap-2"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View prospect
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={handleAddAnother}
                className="gap-2"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Add another
              </Button>
              <Button variant="ghost" size="sm" onClick={() => window.close()}>
                Close
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/60 bg-sidebar px-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary shadow-soft">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="text-base font-bold tracking-tight text-sidebar-foreground">
            Intent
          </span>
        </Link>
        <button
          onClick={() => window.close()}
          className="rounded-lg p-1.5 text-sidebar-foreground/70 hover:bg-white/10 hover:text-sidebar-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto max-w-sm space-y-4 animate-fade-in">
          {sourceUrl && (
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
              <p className="truncate font-semibold text-foreground">{pageTitle || "No title"}</p>
              <p className="mt-0.5 truncate">{sourceUrl}</p>
            </div>
          )}

          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-foreground">
                  Prospect
                </label>
                {selectedProspect ? (
                  <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        {selectedProspect.firstName} {selectedProspect.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedProspect.title}
                        {selectedProspect.company ? `, ${selectedProspect.company}` : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedProspect(null);
                        setProspectSearch("");
                      }}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by name..."
                        value={prospectSearch}
                        onChange={(e) => setProspectSearch(e.target.value)}
                        className="pl-9"
                      />
                      {searching && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                      {prospects.length > 0 && (
                        <div className="absolute left-0 right-0 top-full z-10 mt-1.5 rounded-xl border border-border/60 bg-card shadow-float animate-scale-in">
                          {prospects.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => {
                                setSelectedProspect(p);
                                setProspectSearch(`${p.firstName} ${p.lastName}`);
                                setProspects([]);
                              }}
                              className="w-full px-3.5 py-2.5 text-left hover:bg-muted first:rounded-t-xl last:rounded-b-xl transition-colors"
                            >
                              <p className="text-sm font-semibold text-foreground">
                                {p.firstName} {p.lastName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {p.title}
                                {p.company ? `, ${p.company}` : ""}
                              </p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">— or add new lead —</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="First name"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                      />
                      <Input
                        placeholder="Last name"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                      />
                    </div>
                    <div className="relative">
                      {selectedCompany ? (
                        <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
                          <span className="flex-1 text-sm font-medium text-foreground">
                            {selectedCompany.name}
                          </span>
                          <button
                            onClick={() => {
                              setSelectedCompany(null);
                              setCompanySearch("");
                            }}
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <Input
                            placeholder="Company (search or type new)"
                            value={companySearch}
                            onChange={(e) => setCompanySearch(e.target.value)}
                          />
                          {companySearching && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                          )}
                          {companies.length > 0 && companySearch.length >= 2 && (
                            <div className="absolute left-0 right-0 top-full z-10 mt-1.5 rounded-xl border border-border/60 bg-card shadow-float animate-scale-in">
                              {companies.map((c) => (
                                <button
                                  key={c.id}
                                  onClick={() => {
                                    setSelectedCompany(c);
                                    setCompanySearch(c.name);
                                    setCompanies([]);
                                  }}
                                  className="w-full px-3.5 py-2.5 text-left hover:bg-muted first:rounded-t-xl last:rounded-b-xl transition-colors"
                                >
                                  <p className="text-sm font-medium text-foreground">{c.name}</p>
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    <Input
                      placeholder="Title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                    <Input
                      placeholder="LinkedIn URL"
                      value={linkedinUrl}
                      onChange={(e) => setLinkedinUrl(e.target.value)}
                    />
                    <Input
                      placeholder="Email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-foreground">
                  Signal Type
                </label>
                <Select
                  value={signalType}
                  onChange={(e) => setSignalType(e.target.value)}
                >
                  {SIGNAL_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-foreground">
                    Quick Note
                  </label>
                  {(note?.trim() || hasContentFromUrl) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleEnrich}
                      disabled={enriching || (!note?.trim() && !hasContentFromUrl)}
                      className="h-7 gap-1.5 text-xs"
                    >
                      {enriching ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Wand2 className="h-3 w-3" />
                      )}
                      {enriching ? "Enriching…" : "Enrich with AI"}
                    </Button>
                  )}
                </div>
                <Textarea
                  placeholder="What did you notice? e.g., 'Posted about AI in manufacturing'"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !canSubmit}
                  className="flex-1"
                >
                  {submitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Save Signal
                </Button>
                <Button variant="ghost" onClick={() => window.close()}>
                  Cancel
                </Button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {SIGNAL_TYPES.map((t) => (
                  <Badge
                    key={t.value}
                    variant={signalType === t.value ? "default" : "outline"}
                    className="cursor-pointer text-xs"
                    onClick={() => setSignalType(t.value)}
                  >
                    {t.label}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
