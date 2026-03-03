"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronRight,
  Target,
  Users,
  Swords,
  Eye,
  MessageSquare,
  Radar,
} from "lucide-react";

interface FitAnalysis {
  overallScore: number;
  summary: string;
  bucket: string;
  dimensions: {
    icpFit: { score: number; weight: number; rationale: string; signals?: string[] };
    needAlignment: { score: number; weight: number; rationale: string; matchedOfferings?: { offering: string; need: string; strength: string }[]; unmatchedNeeds?: string[] };
    timingIntent: { score: number; weight: number; rationale: string; signals?: string[]; watchFor?: string[] };
    relationshipDepth: { score: number; weight: number; rationale: string; existingContacts?: string[]; missingPersonas?: string[] };
    competitivePosition: { score: number; weight: number; rationale: string; competitorMentions?: { competitor: string; context: string; threat: string; displacementPlay: string }[]; fieldStatus?: string };
  };
  entryPoint: {
    leadPersona: string;
    leadPersonaMatch: string | null;
    leadOffering: string;
    leadContent: { id: string; title: string } | null;
    discoveryQuestions: string[];
    watchSignals: string[];
  };
  gaps: { area: string; note: string }[];
  expansionOpportunities: { area: string; evidence: string; offering: string; confidence: string; timing: string }[];
}

/** Normalize AI response — it may return objects (e.g. {name, title, role}) where we expect strings. */
function normalizeFitAnalysis(raw: FitAnalysis): FitAnalysis {
  const toString = (v: unknown): string =>
    typeof v === "string" ? v : v && typeof v === "object" && "name" in v
      ? `${(v as { name?: string }).name || ""}${(v as { title?: string }).title ? ` (${(v as { title?: string }).title})` : ""}`.trim() || String(v)
      : String(v ?? "");

  const toStrArray = (arr: unknown[]): string[] =>
    arr.map((x) => (typeof x === "string" ? x : toString(x))).filter(Boolean);

  const rd = raw.dimensions?.relationshipDepth;
  const ep = raw.entryPoint;

  const ensureStr = (v: unknown): string => (typeof v === "string" ? v : toString(v));

  return {
    ...raw,
    summary: ensureStr(raw.summary),
    dimensions: raw.dimensions
      ? {
          ...raw.dimensions,
          icpFit: { ...raw.dimensions.icpFit, rationale: ensureStr(raw.dimensions.icpFit?.rationale) },
          needAlignment: { ...raw.dimensions.needAlignment, rationale: ensureStr(raw.dimensions.needAlignment?.rationale) },
          timingIntent: { ...raw.dimensions.timingIntent, rationale: ensureStr(raw.dimensions.timingIntent?.rationale) },
          relationshipDepth: {
            ...rd,
            rationale: ensureStr(rd?.rationale),
            existingContacts: rd?.existingContacts ? toStrArray(Array.isArray(rd.existingContacts) ? rd.existingContacts : []) : undefined,
            missingPersonas: rd?.missingPersonas ? toStrArray(Array.isArray(rd.missingPersonas) ? rd.missingPersonas : []) : undefined,
          },
          competitivePosition: { ...raw.dimensions.competitivePosition, rationale: ensureStr(raw.dimensions.competitivePosition?.rationale) },
        }
      : raw.dimensions,
    entryPoint: ep
      ? {
          ...ep,
          leadPersona: typeof ep.leadPersona === "string" ? ep.leadPersona : toString(ep.leadPersona),
          leadPersonaMatch: ep.leadPersonaMatch == null ? null : typeof ep.leadPersonaMatch === "string" ? ep.leadPersonaMatch : toString(ep.leadPersonaMatch),
          leadOffering: typeof ep.leadOffering === "string" ? ep.leadOffering : toString(ep.leadOffering),
          discoveryQuestions: toStrArray(Array.isArray(ep.discoveryQuestions) ? ep.discoveryQuestions : []),
          watchSignals: toStrArray(Array.isArray(ep.watchSignals) ? ep.watchSignals : []),
        }
      : raw.entryPoint,
  };
}

const BUCKET_LABELS: Record<string, { label: string; variant: "success" | "warm" | "signal" | "outline" }> = {
  quick_win: { label: "Quick Win", variant: "success" },
  strategic_bet: { label: "Strategic Bet", variant: "warm" },
  nurture: { label: "Nurture", variant: "signal" },
  park: { label: "Park", variant: "outline" },
};

function fitScoreColor(score: number): string {
  if (score >= 70) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-red-500";
}

function fitScoreBg(score: number): string {
  if (score >= 70) return "bg-emerald-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-red-500";
}

export default function FitAnalysisSection({ companyId }: { companyId: string }) {
  const [analysis, setAnalysis] = useState<FitAnalysis | null>(null);
  const [fitScore, setFitScore] = useState<number | null>(null);
  const [fitBucket, setFitBucket] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [profileExists, setProfileExists] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [companyRes, profileRes] = await Promise.all([
          fetch(`/api/companies/${companyId}`),
          fetch("/api/company-profile"),
        ]);

        if (profileRes.ok) {
          const profileData = await profileRes.json();
          setProfileExists(!!profileData.profile && profileData.profile.status === "published");
        }

        if (companyRes.ok) {
          const data = await companyRes.json();
          if (data.fitAnalysis) {
            try {
              const parsed = JSON.parse(data.fitAnalysis);
              setAnalysis(normalizeFitAnalysis(parsed as FitAnalysis));
            } catch { /* malformed JSON in DB */ }
          }
          setFitScore(data.fitScore ?? null);
          setFitBucket(data.fitBucket ?? null);
        }
      } catch { /* load failed silently */ } finally {
        setLoading(false);
      }
    }
    load();
  }, [companyId]);

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/companies/${companyId}/fit`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Fit analysis failed");
      }
      const data = await res.json();
      setAnalysis(normalizeFitAnalysis(data.fitAnalysis as FitAnalysis));
      setFitScore(data.fitScore);
      setFitBucket(data.fitBucket);
    } catch (err) {
      console.error(err);
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) return null;

  const bucketInfo = BUCKET_LABELS[fitBucket || ""] || BUCKET_LABELS.park;

  return (
    <div className="rounded-xl border border-border bg-card shadow-soft">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-5 text-left"
      >
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Fit Analysis</h2>
          {fitScore !== null && (
            <>
              <span className={`text-lg font-bold ${fitScoreColor(fitScore)}`}>{fitScore}</span>
              <Badge variant={bucketInfo.variant}>{bucketInfo.label}</Badge>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          {profileExists ? (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => { e.stopPropagation(); runAnalysis(); }}
              disabled={analyzing}
              className="gap-1.5"
            >
              {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {analysis ? "Refresh" : "Analyze"}
            </Button>
          ) : (
            <a href="/my-company" className="text-xs text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
              Set up My Company first
            </a>
          )}
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
      </button>

      {expanded && analysis && (
        <div className="border-t border-border p-5 space-y-5">
          <p className="text-sm text-muted-foreground">{analysis.summary}</p>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Radar className="h-4 w-4" /> Dimension Scores
            </h3>
            {(() => {
              const dims = analysis.dimensions;
              const items: { key: string; label: string; icon: React.ElementType; dim: FitAnalysis["dimensions"][keyof FitAnalysis["dimensions"]] }[] = [
                { key: "icpFit", label: "ICP Fit", icon: Target, dim: dims.icpFit },
                { key: "needAlignment", label: "Need Alignment", icon: Target, dim: dims.needAlignment },
                { key: "timingIntent", label: "Timing & Intent", icon: Eye, dim: dims.timingIntent },
                { key: "relationshipDepth", label: "Relationship Depth", icon: Users, dim: dims.relationshipDepth },
                { key: "competitivePosition", label: "Competitive Position", icon: Swords, dim: dims.competitivePosition },
              ];
              return items.map(({ key, label, icon: Icon, dim }) => (
                <DimensionBar key={key} label={label} icon={Icon} score={dim.score} weight={dim.weight} rationale={dim.rationale}>
                  {key === "needAlignment" && dims.needAlignment.matchedOfferings && dims.needAlignment.matchedOfferings.length > 0 && (
                    <div className="mt-1.5 space-y-1">
                      {dims.needAlignment.matchedOfferings.map((m, i) => (
                        <div key={i} className="text-[11px]">
                          <span className="font-semibold">{m.offering}</span> → {m.need} <Badge variant="outline" className="ml-1 text-[9px] px-1 py-0">{m.strength}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                  {key === "timingIntent" && dims.timingIntent.watchFor && dims.timingIntent.watchFor.length > 0 && (
                    <div className="mt-1.5 text-[11px]">
                      <span className="font-semibold">Watch for:</span> {dims.timingIntent.watchFor.join("; ")}
                    </div>
                  )}
                  {key === "relationshipDepth" &&
                    ((dims.relationshipDepth.existingContacts?.length ?? 0) > 0 || (dims.relationshipDepth.missingPersonas?.length ?? 0) > 0) && (
                    <div className="mt-1.5 space-y-1 text-[11px]">
                      {dims.relationshipDepth.existingContacts && dims.relationshipDepth.existingContacts.length > 0 && (
                        <div>
                          <span className="font-semibold">Existing:</span> {dims.relationshipDepth.existingContacts.join(", ")}
                        </div>
                      )}
                      {dims.relationshipDepth.missingPersonas && dims.relationshipDepth.missingPersonas.length > 0 && (
                        <div>
                          <span className="font-semibold">Missing:</span> {dims.relationshipDepth.missingPersonas.join(", ")}
                        </div>
                      )}
                    </div>
                  )}
                  {key === "competitivePosition" && dims.competitivePosition.competitorMentions && dims.competitivePosition.competitorMentions.length > 0 && (
                    <div className="mt-1.5 space-y-1">
                      {dims.competitivePosition.competitorMentions.map((cm, i) => (
                        <div key={i} className="text-[11px]">
                          <span className="font-semibold">{cm.competitor}</span>: {cm.context}
                          <Badge variant={cm.threat === "high" ? "destructive" : cm.threat === "medium" ? "warm" : "outline"} className="ml-1 text-[9px] px-1 py-0">
                            {cm.threat}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </DimensionBar>
              ));
            })()}
          </div>

          {analysis.entryPoint && analysis.entryPoint.leadPersona && (
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Entry Point Strategy
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="font-semibold text-foreground">Lead Persona:</span>{" "}
                  <span className="text-muted-foreground">
                    {analysis.entryPoint.leadPersona}
                    {analysis.entryPoint.leadPersonaMatch
                      ? ` (${analysis.entryPoint.leadPersonaMatch})`
                      : " — not in CRM"}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-foreground">Lead Offering:</span>{" "}
                  <span className="text-muted-foreground">{analysis.entryPoint.leadOffering}</span>
                </div>
                {analysis.entryPoint.leadContent && (
                  <div className="col-span-2">
                    <span className="font-semibold text-foreground">Lead Content:</span>{" "}
                    <span className="text-muted-foreground">{analysis.entryPoint.leadContent.title}</span>
                  </div>
                )}
              </div>

              {analysis.entryPoint.discoveryQuestions.length > 0 && (
                <div className="mt-3">
                  <span className="text-xs font-semibold text-foreground">Discovery Questions:</span>
                  <ul className="mt-1 space-y-1">
                    {analysis.entryPoint.discoveryQuestions.map((q, i) => (
                      <li key={i} className="text-xs text-muted-foreground pl-3 relative before:content-['•'] before:absolute before:left-0 before:text-primary">
                        {q}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {analysis.entryPoint.watchSignals.length > 0 && (
                <div className="mt-3">
                  <span className="text-xs font-semibold text-foreground">Watch Signals:</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {analysis.entryPoint.watchSignals.map((s, i) => (
                      <Badge key={i} variant="outline" className="text-[10px]">{s}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {analysis.expansionOpportunities.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Expansion Opportunities</h3>
              <div className="space-y-2">
                {analysis.expansionOpportunities.map((opp, i) => (
                  <div key={i} className="rounded-lg border border-border p-3 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold">{opp.area}</span>
                      <Badge variant={opp.confidence === "high" ? "success" : opp.confidence === "medium" ? "warm" : "outline"} className="text-[9px]">
                        {opp.confidence}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground">{opp.evidence}</p>
                    <div className="mt-1 flex gap-3 text-[11px]">
                      <span><span className="font-semibold">Offering:</span> {opp.offering}</span>
                      <span><span className="font-semibold">Timing:</span> {opp.timing}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {analysis.gaps.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Gaps</h3>
              <div className="space-y-1">
                {analysis.gaps.map((g, i) => (
                  <div key={i} className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{g.area}:</span> {g.note}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {expanded && !analysis && !loading && profileExists && (
        <div className="border-t border-border p-5 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            No fit analysis yet. Run an analysis to see how this company aligns with your offerings.
          </p>
          <Button onClick={runAnalysis} disabled={analyzing} className="gap-2">
            {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
            Run Fit Analysis
          </Button>
        </div>
      )}
    </div>
  );
}

function DimensionBar({
  label,
  icon: Icon,
  score,
  weight,
  rationale,
  children,
}: {
  label: string;
  icon: React.ElementType;
  score: number;
  weight: number;
  rationale: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-border/50 p-2.5">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-3">
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="text-xs font-semibold flex-1 text-left">{label}</span>
        <span className="text-[10px] text-muted-foreground">{weight}%</span>
        <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
          <div className={`h-full rounded-full ${fitScoreBg(score)}`} style={{ width: `${score}%` }} />
        </div>
        <span className={`text-xs font-bold w-8 text-right ${fitScoreColor(score)}`}>{score}</span>
        {open ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
      </button>
      {open && (
        <div className="mt-2 pl-7 text-xs text-muted-foreground">
          {rationale}
          {children}
        </div>
      )}
    </div>
  );
}
