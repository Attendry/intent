"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Breadcrumbs from "@/components/breadcrumbs";
import {
  Building2,
  Users,
  Loader2,
  ChevronRight,
  Target,
  Calendar,
  Zap,
} from "lucide-react";
import { formatLastContacted } from "@/lib/format";

const STAGE_LABELS: Record<string, string> = {
  new: "New",
  meeting_booked: "Meeting Booked",
  qualified: "Qualified",
  proposal: "Proposal",
  negotiation: "Negotiation",
  closed_won: "Won",
  closed_lost: "Lost",
};

interface AccountData {
  company: { id: string; name: string; industry: string | null; fitBucket: string | null };
  prospects: Array<{
    id: string;
    firstName: string;
    lastName: string;
    title: string | null;
    roleArchetype: string | null;
    lastContactedAt: string | null;
    pipelineStage: string;
    unactedSignalCount: number;
    hasMeeting: boolean;
    isContacted: boolean;
    nextBestAction: string;
    lastMeetingSummary: string | null;
  }>;
  priorityActions: Array<{
    id: string;
    firstName: string;
    lastName: string;
    nextBestAction: string;
  }>;
  coverage: { contacted: number; total: number } | null;
  findings: Array<{ id: string; content: string; createdAt: string }>;
}

export default function AccountPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [coverageCollapsed, setCoverageCollapsed] = useState(true);

  const fetchAccount = useCallback(async () => {
    try {
      const res = await fetch(`/api/companies/${id}/account`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAccount();
  }, [fetchAccount]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mb-4 h-8 w-8 animate-spin" />
        <p className="text-sm font-medium">Loading account...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-5xl py-24 text-center">
        <p className="text-sm text-muted-foreground">Company not found.</p>
        <Link href="/companies">
          <Button variant="outline" size="sm" className="mt-4">
            Back to Companies
          </Button>
        </Link>
      </div>
    );
  }

  const { company, prospects, priorityActions, coverage, findings } = data;

  return (
    <div className="mx-auto max-w-5xl animate-fade-in">
      <div className="mb-6 flex items-center gap-4">
        <Breadcrumbs
          items={[
            { label: "Companies", href: "/companies" },
            { label: company.name, href: `/companies/${id}` },
            { label: "Account" },
          ]}
        />
        <Link href={`/companies/${id}`}>
          <Button variant="ghost" size="sm" className="gap-1">
            Overview
            <ChevronRight className="h-3.5 w-3.5 rotate-90" />
          </Button>
        </Link>
      </div>

      {/* Priority actions */}
      {priorityActions.length > 0 && (
        <div className="mb-6 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold mb-3">
            <Target className="h-4 w-4 text-primary" />
            Priority actions
          </h2>
          <div className="space-y-2">
            {priorityActions.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-card p-3">
                <div>
                  <span className="font-medium">
                    {p.firstName} {p.lastName}
                  </span>
                  <span className="text-muted-foreground ml-2">— {p.nextBestAction}</span>
                </div>
                <Link href={`/prospects/${p.id}`}>
                  <Button size="sm" className="gap-1">
                    Prep & reach out
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Buying committee table */}
      <div className="mb-6 rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/30">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4" />
            Buying committee
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="text-left p-3 font-medium">Name</th>
                <th className="text-left p-3 font-medium">Role</th>
                <th className="text-left p-3 font-medium">Stage</th>
                <th className="text-left p-3 font-medium">Last contact</th>
                <th className="text-left p-3 font-medium">Meeting</th>
                <th className="text-left p-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {prospects.map((p) => (
                <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="p-3">
                    <Link href={`/prospects/${p.id}`} className="font-medium hover:text-primary">
                      {p.firstName} {p.lastName}
                    </Link>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {p.title || p.roleArchetype || "—"}
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className="text-[10px]">
                      {STAGE_LABELS[p.pipelineStage] || p.pipelineStage}
                    </Badge>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {formatLastContacted(p.lastContactedAt) || "—"}
                  </td>
                  <td className="p-3">
                    {p.hasMeeting ? (
                      <Badge variant="success" className="text-[10px]">Yes</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span className="text-xs text-muted-foreground">{p.nextBestAction}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Coverage gaps (collapsible) */}
      {coverage && coverage.total > 0 && (
        <div className="mb-6 rounded-xl border border-border">
          <button
            onClick={() => setCoverageCollapsed(!coverageCollapsed)}
            className="flex w-full items-center justify-between p-4 hover:bg-muted/20 transition-colors"
          >
            <div className="flex items-center gap-2">
              {coverageCollapsed ? (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground rotate-90" />
              )}
              <span className="font-medium">Coverage</span>
              <span className="text-sm text-muted-foreground">
                {coverage.contacted} of {coverage.total} roles contacted
              </span>
            </div>
            <div className="h-2 flex-1 max-w-[120px] mx-4 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${(coverage.contacted / coverage.total) * 100}%` }}
              />
            </div>
          </button>
          {!coverageCollapsed && (
            <div className="p-4 pt-0 text-sm text-muted-foreground">
              {prospects.filter((p) => !p.isContacted).length > 0 ? (
                <p>
                  Uncontacted:{" "}
                  {prospects
                    .filter((p) => !p.isContacted)
                    .map((p) => `${p.firstName} ${p.lastName} (${p.title || p.roleArchetype || "?"})`)
                    .join(", ")}
                </p>
              ) : (
                <p>All prospects have been contacted.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Findings */}
      {findings.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold mb-3">
            <Zap className="h-4 w-4" />
            Account insights
          </h2>
          <div className="space-y-2">
            {findings.slice(0, 5).map((f) => (
              <div key={f.id} className="rounded-lg border border-border/50 bg-muted/20 p-3 text-sm">
                {f.content}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
