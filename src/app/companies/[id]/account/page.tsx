"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Breadcrumbs from "@/components/breadcrumbs";
import {
  Users,
  Loader2,
  ChevronRight,
  Target,
  Zap,
  Download,
  ArrowRightLeft,
  Activity,
} from "lucide-react";
import { CollaboratorsSection } from "@/components/company/collaborators-section";
import { HandoffModal } from "@/components/company/handoff-modal";
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
  access?: "owner" | "collaborator";
  collaborators?: Array<{
    id: string;
    userId: string;
    email: string | null;
    role: string;
    invitedBy: string | null;
    invitedAt: string;
    acceptedAt: string | null;
    status: string;
  }>;
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
  coverage: {
    contacted: number;
    total: number;
    personaGap?: {
      missingPersonas: string[];
      source: "profile" | "fit" | "ai" | "combined";
      knownButUncontacted: Array<{ persona: string; prospectName: string; prospectId: string }>;
      hasTargetPersonas?: boolean;
    };
  } | null;
  findings: Array<{ id: string; content: string; createdAt: string }>;
}

const ACTIVITY_LABELS: Record<string, string> = {
  collaborator_added: "Added collaborator",
  finding_shared: "Shared finding",
  handoff_requested: "Requested handoff",
  handoff_accepted: "Accepted handoff",
  intel_added: "Added intel",
  meeting_logged: "Logged meeting",
};

function formatActivityTime(t: string) {
  const d = new Date(t);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  if (diff < 604800_000) return `${Math.floor(diff / 86400_000)}d ago`;
  return d.toLocaleDateString();
}

export default function AccountPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [coverageCollapsed, setCoverageCollapsed] = useState(true);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [activity, setActivity] = useState<
    { id: string; action: string; userEmail: string | null; createdAt: string }[]
  >([]);

  const fetchAccount = useCallback(async () => {
    try {
      const res = await fetch(`/api/companies/${id}/account`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setData(json);
      const actRes = await fetch(`/api/companies/${id}/activity`);
      if (actRes.ok) {
        const actData = await actRes.json();
        setActivity(Array.isArray(actData) ? actData : []);
      }
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

  const { company, access, collaborators, prospects, priorityActions, coverage, findings } = data;

  return (
    <div className="mx-auto max-w-5xl animate-fade-in">
      <div className="mb-6 flex items-center gap-4">
        {access === "collaborator" && (
          <Badge variant="outline" className="text-xs">
            You&apos;re a collaborator
          </Badge>
        )}
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
        <div className="flex items-center gap-2">
          <a
            href={`/api/companies/${id}/export`}
            download
            className="inline-flex"
          >
            <Button variant="outline" size="sm" className="gap-1">
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
          </a>
          {access === "owner" && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => setHandoffOpen(true)}
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              Transfer
            </Button>
          )}
        </div>
      </div>

      <HandoffModal
        companyId={id!}
        companyName={company.name}
        open={handoffOpen}
        onClose={() => setHandoffOpen(false)}
        onSuccess={fetchAccount}
      />

      {/* Recent activity */}
      {activity.length > 0 && (
        <div className="mb-6 rounded-xl border border-border bg-card p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold mb-3">
            <Activity className="h-4 w-4" />
            Recent activity
          </h2>
          <div className="space-y-2">
            {activity.slice(0, 10).map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between text-sm text-muted-foreground"
              >
                <span>
                  <span className="font-medium text-foreground">
                    {a.userEmail || "Someone"}
                  </span>{" "}
                  {ACTIVITY_LABELS[a.action] || a.action}
                </span>
                <span className="text-xs">{formatActivityTime(a.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Collaborators */}
      <CollaboratorsSection
        companyId={id!}
        companyName={company.name}
        access={access ?? "owner"}
        collaborators={collaborators ?? []}
        onUpdate={fetchAccount}
      />

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
      {coverage && (coverage.total > 0 || coverage.personaGap) && (
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
                {coverage.personaGap &&
                  (coverage.personaGap.missingPersonas.length > 0 ||
                    coverage.personaGap.knownButUncontacted.length > 0) && (
                    <span className="ml-2 text-amber-600 dark:text-amber-400">
                      · {coverage.personaGap.missingPersonas.length + coverage.personaGap.knownButUncontacted.length} persona gap
                      {coverage.personaGap.missingPersonas.length + coverage.personaGap.knownButUncontacted.length !== 1 ? "s" : ""}
                    </span>
                  )}
              </span>
            </div>
            {coverage.total > 0 && (
              <div className="h-2 flex-1 max-w-[120px] mx-4 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${(coverage.contacted / coverage.total) * 100}%` }}
                />
              </div>
            )}
          </button>
          {!coverageCollapsed && (
            <div className="p-4 pt-0 space-y-4 text-sm">
              {/* Contact gap: known but uncontacted */}
              <div>
                <h4 className="font-medium text-foreground mb-1">Contact gap</h4>
                {prospects.filter((p) => !p.isContacted).length > 0 ? (
                  <p className="text-muted-foreground">
                    Uncontacted:{" "}
                    {prospects
                      .filter((p) => !p.isContacted)
                      .map((p, i, arr) => (
                        <span key={p.id}>
                          <Link href={`/prospects/${p.id}`} className="text-primary hover:underline">
                            {p.firstName} {p.lastName}
                          </Link>
                          <span className="text-muted-foreground"> ({p.title || p.roleArchetype || "?"})</span>
                          {i < arr.length - 1 ? ", " : ""}
                        </span>
                      ))}
                  </p>
                ) : (
                  <p className="text-muted-foreground">All known prospects have been contacted.</p>
                )}
              </div>

              {/* Persona gap: roles we should have but don't */}
              {coverage.personaGap && (
                <div>
                  <h4 className="font-medium text-foreground mb-1">Persona gap</h4>
                  {!coverage.personaGap.hasTargetPersonas ? (
                    <p className="text-muted-foreground">
                      Set up target personas in <Link href="/my-company" className="text-primary hover:underline">My Company</Link> to see recommended buying committee roles for this account.
                    </p>
                  ) : coverage.personaGap.missingPersonas.length > 0 || coverage.personaGap.knownButUncontacted.length > 0 ? (
                    <>
                      <p className="text-muted-foreground mb-2">
                        Key buying committee roles we should have for this account.
                      </p>
                      {coverage.personaGap.missingPersonas.length > 0 && (
                        <p className="text-muted-foreground">
                          <span className="font-medium text-amber-600 dark:text-amber-400">Missing:</span>{" "}
                          <span className="text-foreground">No contacts yet</span> —{" "}
                          {coverage.personaGap.missingPersonas.join(", ")}
                        </p>
                      )}
                      {coverage.personaGap.knownButUncontacted.length > 0 && (
                        <p className="text-muted-foreground mt-1">
                          <span className="font-medium text-amber-600 dark:text-amber-400">Known but uncontacted:</span>{" "}
                          {coverage.personaGap.knownButUncontacted.map(({ persona, prospectName, prospectId }) => (
                            <span key={prospectId}>
                              <Link href={`/prospects/${prospectId}`} className="text-primary hover:underline">
                                {prospectName}
                              </Link>
                              {" "}({persona}){" "}
                            </span>
                          ))}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Source: {coverage.personaGap.source === "combined" ? "profile + fit analysis + AI" : coverage.personaGap.source}
                      </p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">
                      All key buying committee roles covered.
                    </p>
                  )}
                </div>
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
