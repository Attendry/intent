"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Target,
  Loader2,
  RefreshCw,
  Building2,
  Users,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Briefcase,
  Zap,
  TrendingUp,
  Coffee,
  ParkingCircle,
} from "lucide-react";

interface FitCompany {
  id: string;
  name: string;
  industry: string | null;
  size: string | null;
  fitScore: number | null;
  fitBucket: string | null;
  summary: string;
  topExpansion: { area: string; evidence: string; confidence: string } | null;
  entryPoint: { leadPersona: string; leadOffering: string } | null;
  prospectCount: number;
  intelCount: number;
  isStale: boolean;
  lastFitAnalyzedAt: string | null;
}

interface BucketData {
  quick_win: FitCompany[];
  strategic_bet: FitCompany[];
  nurture: FitCompany[];
  park: FitCompany[];
}

const BUCKET_CONFIG = {
  quick_win: {
    label: "Quick Win",
    description: "Act this week",
    icon: Zap,
    badgeVariant: "success" as const,
    borderColor: "border-emerald-200 dark:border-emerald-800",
    headerBg: "bg-emerald-50 dark:bg-emerald-950/30",
    iconColor: "text-emerald-600",
  },
  strategic_bet: {
    label: "Strategic Bet",
    description: "Develop the account",
    icon: TrendingUp,
    badgeVariant: "warm" as const,
    borderColor: "border-amber-200 dark:border-amber-800",
    headerBg: "bg-amber-50 dark:bg-amber-950/30",
    iconColor: "text-amber-600",
  },
  nurture: {
    label: "Nurture",
    description: "Stay visible, check quarterly",
    icon: Coffee,
    badgeVariant: "signal" as const,
    borderColor: "border-blue-200 dark:border-blue-800",
    headerBg: "bg-blue-50 dark:bg-blue-950/30",
    iconColor: "text-blue-600",
  },
  park: {
    label: "Park",
    description: "Low priority",
    icon: ParkingCircle,
    badgeVariant: "outline" as const,
    borderColor: "border-border",
    headerBg: "bg-muted/30",
    iconColor: "text-muted-foreground",
  },
};

function scoreColor(score: number): string {
  if (score >= 70) return "text-emerald-600";
  if (score >= 40) return "text-amber-600";
  return "text-red-500";
}

export default function FitOverviewPage() {
  const [buckets, setBuckets] = useState<BucketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [staleCount, setStaleCount] = useState(0);
  const [profileExists, setProfileExists] = useState(false);
  const [profilePublished, setProfilePublished] = useState(false);
  const [profileUpdatedAt, setProfileUpdatedAt] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [parkCollapsed, setParkCollapsed] = useState(true);

  const fetchOverview = useCallback(async () => {
    try {
      const res = await fetch("/api/fit-overview");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setBuckets(data.buckets);
      setTotal(data.total);
      setStaleCount(data.staleCount);
      setProfileExists(data.profileExists);
      setProfilePublished(data.profilePublished);
      setProfileUpdatedAt(data.profileUpdatedAt);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const handleRefresh = async (staleOnly: boolean = false) => {
    setRefreshing(true);
    try {
      const url = staleOnly
        ? "/api/fit-overview/refresh?staleOnly=true"
        : "/api/fit-overview/refresh";
      await fetch(url, { method: "POST" });
      await fetchOverview();
    } catch {
      // ignore
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mb-4 h-8 w-8 animate-spin" />
        <p className="text-sm font-medium">Loading fit overview...</p>
      </div>
    );
  }

  // No profile
  if (!profileExists) {
    return (
      <div className="mx-auto max-w-2xl animate-fade-in text-center py-24">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Briefcase className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Set Up Your Company Profile First</h1>
        <p className="mt-2 text-sm text-muted-foreground mb-6">
          Fit analysis requires a published company profile with your offerings, ICP, and competitive landscape.
        </p>
        <Link href="/my-company">
          <Button className="gap-2">
            <Briefcase className="h-4 w-4" />
            Go to My Company
          </Button>
        </Link>
      </div>
    );
  }

  if (!profilePublished) {
    return (
      <div className="mx-auto max-w-2xl animate-fade-in text-center py-24">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-950/30">
          <AlertTriangle className="h-8 w-8 text-amber-600" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Profile Not Published</h1>
        <p className="mt-2 text-sm text-muted-foreground mb-6">
          Your company profile is still in draft. Review and publish it to enable fit analysis.
        </p>
        <Link href="/my-company">
          <Button className="gap-2">
            <Briefcase className="h-4 w-4" />
            Review Profile
          </Button>
        </Link>
      </div>
    );
  }

  // No companies analyzed yet
  if (total === 0) {
    return (
      <div className="mx-auto max-w-2xl animate-fade-in text-center py-24">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Target className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">No Companies Analyzed Yet</h1>
        <p className="mt-2 text-sm text-muted-foreground mb-6">
          Your profile is published. Now go to a company with intel or a battlecard and run a fit analysis, or refresh all companies here.
        </p>
        <Button onClick={() => handleRefresh(false)} disabled={refreshing} className="gap-2">
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Analyze All Companies
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Fit Overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} compan{total === 1 ? "y" : "ies"} analyzed against your profile
          </p>
        </div>
        <div className="flex gap-2">
          {staleCount > 0 && (
            <Button variant="outline" onClick={() => handleRefresh(true)} disabled={refreshing} className="gap-2">
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh Stale ({staleCount})
            </Button>
          )}
          <Button variant="outline" onClick={() => handleRefresh(false)} disabled={refreshing} className="gap-2">
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh All
          </Button>
        </div>
      </div>

      {/* Staleness Banner */}
      {staleCount > 0 && profileUpdatedAt && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <span className="text-amber-800 dark:text-amber-200">
            Your company profile was updated on {new Date(profileUpdatedAt).toLocaleDateString()}.{" "}
            {staleCount} fit score{staleCount > 1 ? "s are" : " is"} based on a previous version.
          </span>
        </div>
      )}

      {/* Bucket Columns */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-4">
        {(Object.keys(BUCKET_CONFIG) as (keyof typeof BUCKET_CONFIG)[]).map((bucketKey) => {
          const config = BUCKET_CONFIG[bucketKey];
          const companies = buckets?.[bucketKey] || [];
          const isPark = bucketKey === "park";
          const isCollapsed = isPark && parkCollapsed;

          return (
            <div key={bucketKey} className={cn("rounded-xl border", config.borderColor)}>
              <div className={cn("flex items-center justify-between rounded-t-xl p-3", config.headerBg)}>
                <div className="flex items-center gap-2">
                  <config.icon className={cn("h-4 w-4", config.iconColor)} />
                  <div>
                    <h2 className="text-sm font-semibold">{config.label}</h2>
                    <p className="text-[10px] text-muted-foreground">{config.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={config.badgeVariant}>{companies.length}</Badge>
                  {isPark && (
                    <button onClick={() => setParkCollapsed(!parkCollapsed)}>
                      {isCollapsed ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                    </button>
                  )}
                </div>
              </div>

              {!isCollapsed && (
                <div className="p-2 space-y-2">
                  {companies.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No companies</p>
                  ) : (
                    companies.map((company) => (
                      <FitCompanyCard key={company.id} company={company} bucketKey={bucketKey} />
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FitCompanyCard({ company, bucketKey }: { company: FitCompany; bucketKey: string }) {
  return (
    <Link href={`/companies/${company.id}`}>
      <div className={cn(
        "rounded-lg border border-border/50 bg-card p-3 hover:shadow-soft hover:border-border transition-all duration-200 cursor-pointer",
        company.isStale && "opacity-70"
      )}>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="text-sm font-semibold truncate">{company.name}</span>
          </div>
          {company.fitScore !== null && (
            <span className={cn("text-sm font-bold", scoreColor(company.fitScore))}>
              {company.fitScore}
            </span>
          )}
        </div>

        {company.summary && (
          <p className="text-[11px] text-muted-foreground line-clamp-2 mb-1.5">{company.summary}</p>
        )}

        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {company.industry && <span className="rounded bg-muted px-1.5 py-0.5">{company.industry}</span>}
          <span className="flex items-center gap-0.5">
            <Users className="h-2.5 w-2.5" /> {company.prospectCount}
          </span>
          {company.isStale && (
            <Badge variant="outline" className="text-[9px] px-1 py-0">Stale</Badge>
          )}
        </div>

        {/* Bucket-specific details */}
        {bucketKey === "quick_win" && company.entryPoint && (
          <div className="mt-1.5 text-[10px] text-muted-foreground">
            <span className="font-semibold text-foreground">Lead:</span> {company.entryPoint.leadOffering} → {company.entryPoint.leadPersona}
          </div>
        )}

        {bucketKey === "strategic_bet" && company.entryPoint && (
          <div className="mt-1.5 text-[10px] text-muted-foreground">
            <span className="font-semibold text-foreground">Develop:</span> {company.entryPoint.leadOffering}
          </div>
        )}

        {bucketKey === "nurture" && company.topExpansion && (
          <div className="mt-1.5 text-[10px] text-muted-foreground">
            <span className="font-semibold text-foreground">Expansion:</span> {company.topExpansion.area}
          </div>
        )}
      </div>
    </Link>
  );
}
