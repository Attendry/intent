"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import Breadcrumbs from "@/components/breadcrumbs";
import { BrainNudgeCard } from "@/components/brain-nudge-card";
import { useToast } from "@/components/ui/toast";
import RelationshipTimeline from "@/components/relationship-timeline";
import { cn } from "@/lib/utils";
import { DRAFT_TEMPLATE_USE_CASES } from "@/lib/constants";
import {
  ArrowLeft,
  Star,
  Edit3,
  Save,
  X,
  Phone as PhoneIcon,
  Smartphone,
  Mail,
  Linkedin,
  Building2,
  Briefcase,
  Globe,
  Calendar,
  MessageSquare,
  Zap,
  Loader2,
  AlertCircle,
  Plus,
  Lock,
  RefreshCw,
  Copy,
  Send,
  Languages,
  CheckCircle2,
  Video,
  Share2,
} from "lucide-react";

interface CompanyContext {
  id: string;
  name: string;
  industry: string | null;
  roleBriefingCache: string | null;
  lastSynthesizedAt: string | null;
  synthStatus: string;
  intel: { id: string; type: string; summary: string; actionContext: string | null; createdAt: string }[];
}

interface ProspectDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  mobilePhone: string | null;
  title: string | null;
  company: string | null;
  companyId: string | null;
  roleArchetype: string | null;
  industry: string | null;
  linkedinUrl: string | null;
  personaSummary: string | null;
  personaTags: string | null;
  backgroundNotes: string | null;
  priorityTier: string;
  starred: boolean;
  preferredLang: string;
  lastContactedAt: string | null;
  nextFollowUpAt: string | null;
  pipelineStage: string | null;
  createdAt: string;
  updatedAt: string;
  signals: SignalData[];
  outreach: OutreachData[];
  meetingLogs?: MeetingData[];
}

interface SignalData {
  id: string;
  type: string;
  summary: string | null;
  sourceUrl: string | null;
  urgencyScore: number;
  createdAt: string;
  private?: boolean;
  actedOn?: boolean;
}

interface OutreachData {
  id: string;
  channel: string;
  messageSent: string | null;
  subjectLine: string | null;
  outcome: string;
  createdAt: string;
}

interface MeetingData {
  id: string;
  notes: string | null;
  summary: string | null;
  outcome: string | null;
  meetingDate: string | null;
  suggestedStage: string | null;
  createdAt: string;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getInitials(first: string, last: string) {
  return `${first[0] || ""}${last[0] || ""}`.toUpperCase();
}

export default function ProspectDetailPage() {
  const params = useParams<{ id: string }>();
  const { toast } = useToast();

  const [prospect, setProspect] = useState<ProspectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [editingPersona, setEditingPersona] = useState(false);
  const [personaDraft, setPersonaDraft] = useState("");
  const [prepLoading, setPrepLoading] = useState(false);
  const [prepBriefing, setPrepBriefing] = useState<string | null>(null);
  const [showPrepPanel, setShowPrepPanel] = useState(false);
  const [prepPanelTitle, setPrepPanelTitle] = useState("Call Prep");
  const [draftSubject, setDraftSubject] = useState<string | null>(null);
  const [companyCtx, setCompanyCtx] = useState<CompanyContext | null>(null);
  const [draftChannel, setDraftChannel] = useState<"email" | "linkedin" | "call" | null>(null);
  const [draftLang, setDraftLang] = useState<string>("en");
  const [draftTemplate, setDraftTemplate] = useState<string>("auto");
  const [showAddSignal, setShowAddSignal] = useState(false);
  const [signalForm, setSignalForm] = useState({ type: "other", summary: "", sourceUrl: "", urgencyScore: 3, private: false });
  const [addingSignal, setAddingSignal] = useState(false);
  const [showLogOutreach, setShowLogOutreach] = useState(false);
  const [outreachForm, setOutreachForm] = useState({ channel: "email", outcome: "sent", subjectLine: "", messageSent: "", notes: "" });
  const [loggingOutreach, setLoggingOutreach] = useState(false);
  const [showLogMeeting, setShowLogMeeting] = useState(false);
  const [meetingForm, setMeetingForm] = useState({ notes: "", meetingDate: "", outcome: "positive" });
  const [loggingMeeting, setLoggingMeeting] = useState(false);
  const [meetingResult, setMeetingResult] = useState<{ suggestedStage: string | null } | null>(null);
  const [updatingStage, setUpdatingStage] = useState(false);
  const [showLogMeetingPrompt, setShowLogMeetingPrompt] = useState(false);

  const PIPELINE_STAGES = ["new", "meeting_booked", "qualified", "proposal", "negotiation", "closed_won", "closed_lost"] as const;
  const STAGE_LABELS: Record<string, string> = {
    new: "New",
    meeting_booked: "Meeting Booked",
    qualified: "Qualified",
    proposal: "Proposal",
    negotiation: "Negotiation",
    closed_won: "Won",
    closed_lost: "Lost",
  };

  const fetchProspect = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/prospects/${params.id}`);
      if (!res.ok) throw new Error("Prospect not found");
      const data: ProspectDetail = await res.json();
      setProspect(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load prospect"
      );
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchProspect();
  }, [fetchProspect]);

  useEffect(() => {
    if (!prospect?.companyId) { setCompanyCtx(null); return; }
    fetch(`/api/companies/${prospect.companyId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setCompanyCtx({
            id: data.id,
            name: data.name,
            industry: data.industry,
            roleBriefingCache: data.roleBriefingCache,
            lastSynthesizedAt: data.lastSynthesizedAt,
            synthStatus: data.synthStatus,
            intel: (data.intel || []).slice(0, 3).map((i: Record<string, unknown>) => ({
              id: i.id as string,
              type: i.type as string,
              summary: i.summary as string,
              actionContext: i.actionContext as string | null,
              createdAt: i.createdAt as string,
            })),
          });
        }
      })
      .catch(() => {});
  }, [prospect?.companyId]);

  useEffect(() => {
    const hasUnsavedChanges = editing || editingPersona;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [editing, editingPersona]);

  const startEditing = () => {
    if (!prospect) return;
    setEditForm({
      firstName: prospect.firstName,
      lastName: prospect.lastName,
      title: prospect.title || "",
      company: prospect.company || "",
      email: prospect.email || "",
      phone: prospect.phone || "",
      mobilePhone: prospect.mobilePhone || "",
      linkedinUrl: prospect.linkedinUrl || "",
      industry: prospect.industry || "",
      backgroundNotes: prospect.backgroundNotes || "",
      preferredLang: prospect.preferredLang,
    });
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setEditForm({});
  };

  const saveEdits = async () => {
    if (!prospect) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/prospects/${prospect.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error("Failed to save");
      const updated = await res.json();
      setProspect((prev) => (prev ? { ...prev, ...updated } : prev));
      setEditing(false);
      toast("Prospect updated", "success");
    } catch {
      toast("Failed to save changes", "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleStar = async () => {
    if (!prospect) return;
    const prevStarred = prospect.starred;
    setProspect((prev) => (prev ? { ...prev, starred: !prev.starred } : prev));
    try {
      const res = await fetch(`/api/prospects/${prospect.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starred: !prevStarred }),
      });
      if (!res.ok) throw new Error("Failed to update");
    } catch {
      setProspect((prev) => (prev ? { ...prev, starred: prevStarred } : prev));
      toast("Failed to update star", "error");
    }
  };

  const savePersona = async () => {
    if (!prospect) return;
    try {
      const res = await fetch(`/api/prospects/${prospect.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personaSummary: personaDraft }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setProspect((prev) =>
        prev ? { ...prev, personaSummary: personaDraft } : prev
      );
      setEditingPersona(false);
      toast("Persona summary updated", "success");
    } catch {
      toast("Failed to save persona summary", "error");
    }
  };

  const openPrepPanel = (title: string, channel: "email" | "linkedin" | "call" | null = null) => {
    setPrepPanelTitle(title);
    setPrepLoading(true);
    setShowPrepPanel(true);
    setPrepBriefing(null);
    setDraftSubject(null);
    setDraftChannel(channel);
  };

  const handlePipelineStageChange = async (newStage: string) => {
    if (!prospect) return;
    setUpdatingStage(true);
    try {
      const res = await fetch(`/api/prospects/${prospect.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipelineStage: newStage || null }),
      });
      if (!res.ok) throw new Error("Failed to update");
      const updated = await res.json();
      setProspect((prev) => (prev ? { ...prev, pipelineStage: updated.pipelineStage } : prev));
      toast("Stage updated", "success");
    } catch {
      toast("Failed to update stage", "error");
    } finally {
      setUpdatingStage(false);
    }
  };

  const handleLogOutreach = async () => {
    if (!prospect) return;
    setLoggingOutreach(true);
    try {
      const res = await fetch("/api/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospectId: prospect.id,
          channel: outreachForm.channel,
          outcome: outreachForm.outcome,
          subjectLine: outreachForm.subjectLine || null,
          messageSent: outreachForm.messageSent || null,
          notes: outreachForm.notes || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to log outreach");
      setOutreachForm({ channel: "email", outcome: "sent", subjectLine: "", messageSent: "", notes: "" });
      setShowLogOutreach(false);
      fetchProspect();
      toast("Outreach logged", "success");
      if (outreachForm.outcome === "meeting_booked") {
        setShowLogMeetingPrompt(true);
      }
    } catch {
      toast("Failed to log outreach", "error");
    } finally {
      setLoggingOutreach(false);
    }
  };

  const handleLogMeeting = async () => {
    if (!prospect) return;
    setLoggingMeeting(true);
    setMeetingResult(null);
    try {
      const res = await fetch("/api/meeting-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospectId: prospect.id,
          notes: meetingForm.notes || null,
          meetingDate: meetingForm.meetingDate || null,
          outcome: meetingForm.outcome,
          runAi: true,
        }),
      });
      if (!res.ok) throw new Error("Failed to log meeting");
      const data = await res.json();
      setMeetingForm({ notes: "", meetingDate: "", outcome: "positive" });
      setMeetingResult({ suggestedStage: data.suggestedStage });
      fetchProspect();
      toast("Meeting logged", "success");
      if (!data.suggestedStage) {
        setShowLogMeeting(false);
        setShowLogMeetingPrompt(false);
      }
    } catch {
      toast("Failed to log meeting", "error");
    } finally {
      setLoggingMeeting(false);
    }
  };

  const handleApplySuggestedStage = async () => {
    if (!prospect || !meetingResult?.suggestedStage) return;
    setUpdatingStage(true);
    try {
      const res = await fetch(`/api/prospects/${prospect.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipelineStage: meetingResult.suggestedStage }),
      });
      if (!res.ok) throw new Error("Failed to update");
      const updated = await res.json();
      setProspect((prev) => (prev ? { ...prev, pipelineStage: updated.pipelineStage } : prev));
      setMeetingResult(null);
      setShowLogMeeting(false);
      setShowLogMeetingPrompt(false);
      toast("Stage updated", "success");
    } catch {
      toast("Failed to update stage", "error");
    } finally {
      setUpdatingStage(false);
    }
  };

  const handleAddSignal = async () => {
    if (!prospect || !signalForm.summary.trim()) return;
    setAddingSignal(true);
    try {
      await fetch("/api/signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospectId: prospect.id,
          type: signalForm.type,
          summary: signalForm.summary,
          sourceUrl: signalForm.sourceUrl || null,
          urgencyScore: signalForm.urgencyScore,
          private: signalForm.private,
        }),
      });
      setSignalForm({ type: "other", summary: "", sourceUrl: "", urgencyScore: 3, private: false });
      setShowAddSignal(false);
      fetchProspect();
      toast("Intel added", "success");
    } catch {
      toast("Failed to add intel", "error");
    } finally {
      setAddingSignal(false);
    }
  };

  const handleTogglePrivate = async (signalId: string, isPrivate: boolean) => {
    try {
      await fetch(`/api/signals/${signalId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ private: isPrivate }),
      });
      fetchProspect();
    } catch {
      toast("Failed to update signal", "error");
    }
  };

  const handlePrepForCall = () => {
    window.dispatchEvent(
      new CustomEvent("intent:open-chat", { detail: { message: "Prep me for a call" } })
    );
  };

  const handleDraftTemplate = async (channel: "email" | "linkedin", lang?: string) => {
    if (!prospect) return;
    const language = lang || draftLang || prospect.preferredLang || "en";
    setDraftLang(language);
    const label = channel === "email" ? "Email Draft" : "LinkedIn Message";
    openPrepPanel(`${label} — ${prospect.firstName} ${prospect.lastName}`, channel);
    const topSignal = prospect.signals.find((s) => !s.actedOn) || prospect.signals[0];
    try {
      const res = await fetch("/api/intelligence/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospectId: prospect.id,
          signalId: topSignal?.id,
          channel,
          language,
          templateUseCase: draftTemplate !== "auto" ? draftTemplate : undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to generate draft");
      const data = await res.json();
      if (channel === "email" && data.subject) {
        setDraftSubject(data.subject);
      }
      setPrepBriefing(data.body || "No draft generated.");
    } catch {
      setPrepBriefing(`Failed to generate ${label.toLowerCase()}. Please try again.`);
    } finally {
      setPrepLoading(false);
    }
  };

  const handleRegenerate = () => {
    if (!draftChannel || draftChannel === "call") {
      handlePrepForCall();
    } else {
      handleDraftTemplate(draftChannel, draftLang);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl animate-fade-in space-y-6">
        <Skeleton className="h-5 w-48" />
        <Card className="overflow-hidden">
          <div className="h-1.5 w-full bg-muted/60" />
          <div className="p-6">
            <div className="flex items-center gap-4">
              <Skeleton className="h-14 w-14 rounded-2xl shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-4 w-64" />
              </div>
            </div>
          </div>
        </Card>
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !prospect) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <AlertCircle className="mb-3 h-8 w-8 text-destructive" />
        <p className="mb-4 text-sm font-medium text-destructive">
          {error || "Prospect not found"}
        </p>
        <Link href="/prospects">
          <Button variant="outline" size="sm">
            Back to Prospects
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl animate-fade-in">
      {/* Prep slide-over */}
      {showPrepPanel && (
        <div className="fixed inset-0 z-50 flex justify-end animate-fade-in">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowPrepPanel(false)}
          />
          <div className="relative z-10 flex h-full w-full max-w-lg flex-col overflow-y-auto bg-card shadow-float animate-slide-in-right">
            <div className="flex items-center justify-between border-b border-border/60 p-5">
              <h2 className="text-lg font-semibold text-foreground truncate pr-2">
                {prepPanelTitle}
              </h2>
              <div className="flex items-center gap-2">
                {draftChannel && draftChannel !== "call" && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Template:</span>
                      <Select
                        value={draftTemplate}
                        onChange={(e) => setDraftTemplate(e.target.value)}
                        className="h-8 w-auto min-w-[120px] rounded-lg px-2 text-xs font-medium"
                      >
                        {DRAFT_TEMPLATE_USE_CASES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </Select>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Languages className="h-3.5 w-3.5 text-muted-foreground" />
                      <Select
                        value={draftLang}
                        onChange={(e) => setDraftLang(e.target.value)}
                        className="h-8 w-auto min-w-[100px] rounded-lg px-2 text-xs font-medium"
                      >
                        <option value="en">English</option>
                        <option value="de">German</option>
                        <option value="fr">French</option>
                      </Select>
                    </div>
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowPrepPanel(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
            <div className="flex-1 p-6">
              {prepLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <Loader2 className="mb-4 h-8 w-8 animate-spin" />
                  <p className="text-sm font-medium">Generating...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {draftSubject && (
                    <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70 mb-1">Subject</p>
                      <input
                        type="text"
                        value={draftSubject}
                        onChange={(e) => setDraftSubject(e.target.value)}
                        className="w-full bg-transparent text-sm font-semibold text-foreground focus:outline-none"
                      />
                    </div>
                  )}
                  {draftChannel && draftChannel !== "call" ? (
                    <textarea
                      value={prepBriefing || ""}
                      onChange={(e) => setPrepBriefing(e.target.value)}
                      className="w-full min-h-[300px] rounded-xl border border-border/60 bg-background p-4 text-sm leading-relaxed text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
                    />
                  ) : (
                    <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                      {prepBriefing}
                    </div>
                  )}
                  {!prepLoading && prepBriefing && (
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => {
                          const text = draftSubject
                            ? `Subject: ${draftSubject}\n\n${prepBriefing}`
                            : prepBriefing || "";
                          navigator.clipboard.writeText(text);
                          toast("Copied to clipboard", "success");
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copy
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={handleRegenerate}
                        disabled={prepLoading}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Regenerate
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Breadcrumbs */}
      <div className="mb-6">
        <Breadcrumbs
          items={[
            { label: "Prospects", href: "/prospects" },
            { label: `${prospect.firstName} ${prospect.lastName}` },
          ]}
        />
      </div>

      <BrainNudgeCard prospectId={prospect.id} companyId={prospect.companyId ?? undefined} />

      {/* Profile header card */}
      <Card className="mb-6 overflow-hidden">
        <div className="h-1.5 w-full gradient-primary" />
        <div className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            {/* Left: identity */}
            <div className="flex-1">
              {editing ? (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      value={editForm.firstName}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, firstName: e.target.value }))
                      }
                      placeholder="First name"
                    />
                    <Input
                      value={editForm.lastName}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, lastName: e.target.value }))
                      }
                      placeholder="Last name"
                    />
                  </div>
                  <Input
                    value={editForm.title}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, title: e.target.value }))
                    }
                    placeholder="Job title"
                  />
                  <Input
                    value={editForm.company}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, company: e.target.value }))
                    }
                    placeholder="Company"
                  />
                  <Input
                    value={editForm.email}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, email: e.target.value }))
                    }
                    placeholder="Email"
                  />
                  <div className="flex gap-2">
                    <Input
                      value={editForm.phone}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, phone: e.target.value }))
                      }
                      placeholder="Phone"
                    />
                    <Input
                      value={editForm.mobilePhone}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, mobilePhone: e.target.value }))
                      }
                      placeholder="Mobile phone"
                    />
                  </div>
                  <Input
                    value={editForm.linkedinUrl}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, linkedinUrl: e.target.value }))
                    }
                    placeholder="LinkedIn URL"
                  />
                  <Input
                    value={editForm.industry}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, industry: e.target.value }))
                    }
                    placeholder="Industry"
                  />
                  <Textarea
                    value={editForm.backgroundNotes}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        backgroundNotes: e.target.value,
                      }))
                    }
                    placeholder="Background notes..."
                    rows={3}
                  />
                  <Select
                    value={editForm.preferredLang}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        preferredLang: e.target.value,
                      }))
                    }
                  >
                    <option value="en">English</option>
                    <option value="de">German</option>
                    <option value="fr">French</option>
                  </Select>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" onClick={saveEdits} disabled={saving} className="gap-1.5">
                      {saving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      Save
                    </Button>
                    <Button variant="ghost" size="sm" onClick={cancelEditing}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl gradient-primary text-lg font-bold text-white shadow-soft">
                      {getInitials(prospect.firstName, prospect.lastName)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">
                          {prospect.firstName} {prospect.lastName}
                        </h1>
                        <button
                          onClick={toggleStar}
                          className="transition-all duration-200 hover:scale-110 active:scale-95"
                          title={prospect.starred ? "Unstar" : "Star"}
                        >
                          <Star
                            className={cn(
                              "h-5 w-5",
                              prospect.starred
                                ? "fill-amber-400 text-amber-400"
                                : "text-muted-foreground/40 hover:text-muted-foreground"
                            )}
                          />
                        </button>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        {prospect.title && (
                          <span className="inline-flex items-center gap-1.5">
                            <Briefcase className="h-3.5 w-3.5" />
                            {prospect.title}
                          </span>
                        )}
                        {prospect.company && (
                          prospect.companyId ? (
                            <Link href={`/companies/${prospect.companyId}`} className="inline-flex items-center gap-1.5 hover:text-primary transition-colors">
                              <Building2 className="h-3.5 w-3.5" />
                              {prospect.company}
                            </Link>
                          ) : (
                            <span className="inline-flex items-center gap-1.5">
                              <Building2 className="h-3.5 w-3.5" />
                              {prospect.company}
                            </span>
                          )
                        )}
                        {prospect.industry && (
                          <span className="inline-flex items-center gap-1.5">
                            <Globe className="h-3.5 w-3.5" />
                            {prospect.industry}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 ml-[72px] flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {prospect.email && (
                      <a
                        href={`mailto:${prospect.email}`}
                        className="inline-flex items-center gap-1.5 hover:text-primary transition-colors"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        {prospect.email}
                      </a>
                    )}
                    {prospect.linkedinUrl && (
                      <a
                        href={prospect.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 hover:text-primary transition-colors"
                      >
                        <Linkedin className="h-3.5 w-3.5" />
                        LinkedIn
                      </a>
                    )}
                    {prospect.phone && (
                      <a
                        href={`tel:${prospect.phone}`}
                        className="inline-flex items-center gap-1.5 hover:text-primary transition-colors"
                      >
                        <PhoneIcon className="h-3.5 w-3.5" />
                        {prospect.phone}
                      </a>
                    )}
                    {prospect.mobilePhone && (
                      <a
                        href={`tel:${prospect.mobilePhone}`}
                        className="inline-flex items-center gap-1.5 hover:text-primary transition-colors"
                      >
                        <Smartphone className="h-3.5 w-3.5" />
                        {prospect.mobilePhone}
                      </a>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Right: stats + actions */}
            <div className="flex flex-col items-end gap-4">
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-right">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70 mb-1">Pipeline stage</p>
                  <Select
                    value={prospect.pipelineStage || "new"}
                    onChange={(e) => handlePipelineStageChange(e.target.value)}
                    disabled={updatingStage}
                    className="h-8 w-full min-w-[140px] text-xs font-medium"
                  >
                    {PIPELINE_STAGES.map((s) => (
                      <option key={s} value={s}>{STAGE_LABELS[s] || s}</option>
                    ))}
                  </Select>
                </div>
                {[
                  { label: "Last contacted", value: formatDate(prospect.lastContactedAt) },
                  { label: "Next follow-up", value: formatDate(prospect.nextFollowUpAt) },
                  { label: "Outreach", value: String(prospect.outreach.length) },
                  { label: "Signals", value: String(prospect.signals.length) },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">{label}</p>
                    <p className="text-sm font-semibold text-foreground">{value}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 justify-end">
                <Button onClick={handlePrepForCall} className="gap-1.5" size="sm" title="Get a one-pager for your next conversation">
                  <PhoneIcon className="h-3.5 w-3.5" />
                  Prep for call
                </Button>
                <Button onClick={() => handleDraftTemplate("email", prospect.preferredLang || "en")} variant="outline" size="sm" className="gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  Email Draft
                </Button>
                <Button onClick={() => handleDraftTemplate("linkedin", prospect.preferredLang || "en")} variant="outline" size="sm" className="gap-1.5">
                  <Linkedin className="h-3.5 w-3.5" />
                  LinkedIn Draft
                </Button>
                <Link href={`/social-posts?prospectId=${prospect.id}`}>
                  <Button variant="outline" size="sm" className="gap-1.5" title="Create LinkedIn post for this persona">
                    <Share2 className="h-3.5 w-3.5" />
                    Create post
                  </Button>
                </Link>
                <Button onClick={() => setShowLogOutreach(!showLogOutreach)} variant="outline" size="sm" className="gap-1.5">
                  <Send className="h-3.5 w-3.5" />
                  Log Outreach
                </Button>
                <Button onClick={() => { setShowLogMeeting(true); setShowLogMeetingPrompt(false); }} variant="outline" size="sm" className="gap-1.5">
                  <Video className="h-3.5 w-3.5" />
                  Log Meeting
                </Button>
                {!editing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={startEditing}
                    className="gap-1.5"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Company context card */}
      {companyCtx && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <Link href={`/companies/${companyCtx.id}`} className="flex items-center gap-2 hover:text-primary transition-colors">
                <Building2 className="h-4 w-4 text-primary" />
                {companyCtx.name}
                <div className={`h-2 w-2 rounded-full ${(() => {
                  if (!companyCtx.lastSynthesizedAt) return "bg-red-500";
                  const days = Math.floor((Date.now() - new Date(companyCtx.lastSynthesizedAt).getTime()) / 86400000);
                  if (days < 7) return "bg-green-500";
                  if (days <= 30) return "bg-yellow-500";
                  return "bg-red-500";
                })()}`} />
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              if (companyCtx.roleBriefingCache) {
                try {
                  const cache = JSON.parse(companyCtx.roleBriefingCache);
                  const archetype = prospect.roleArchetype || "general";
                  const briefing = cache[archetype] || cache["general"] || Object.values(cache)[0];
                  if (briefing) return <p className="text-sm leading-relaxed text-foreground">{briefing as string}</p>;
                } catch {
                  /* malformed roleBriefingCache JSON */
                }
              }
              return <p className="text-sm text-muted-foreground italic">Company context will appear after synthesis runs.</p>;
            })()}
            {companyCtx.intel.length > 0 && (
              <div className="mt-3 space-y-2">
                {companyCtx.intel
                  .filter((i) => !i.actionContext || i.actionContext)
                  .map((i) => (
                    <div key={i.id} className="rounded-md bg-muted/40 px-3 py-2">
                      <p className="text-xs font-medium text-foreground">{i.summary}</p>
                      {i.actionContext && (
                        <p className="mt-0.5 text-xs text-primary">{i.actionContext}</p>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Persona summary */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              Persona Summary
            </span>
            {!editingPersona && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPersonaDraft(prospect.personaSummary || "");
                  setEditingPersona(true);
                }}
                className="text-xs"
              >
                <Edit3 className="mr-1.5 h-3 w-3" />
                Edit
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {editingPersona ? (
            <div className="space-y-3">
              <Textarea
                value={personaDraft}
                onChange={(e) => setPersonaDraft(e.target.value)}
                rows={4}
                placeholder="Describe this prospect's persona, pain points, and communication style..."
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={savePersona} className="gap-1.5">
                  <Save className="h-3.5 w-3.5" />
                  Save
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingPersona(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : prospect.personaSummary ? (
            <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
              {prospect.personaSummary}
            </p>
          ) : (
            <p className="text-sm italic text-muted-foreground/70">
              No persona summary yet. Click Edit to add one.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Log Outreach Form */}
      {showLogOutreach && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Send className="h-4 w-4 text-primary" />
              Log Outreach
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Channel</label>
                  <Select
                    value={outreachForm.channel}
                    onChange={(e) => setOutreachForm({ ...outreachForm, channel: e.target.value })}
                    className="w-full rounded-lg h-9 px-3 py-2 text-sm"
                  >
                    <option value="email">Email</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="call">Call</option>
                    <option value="meeting">Meeting</option>
                    <option value="other">Other</option>
                  </Select>
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Outcome</label>
                  <Select
                    value={outreachForm.outcome}
                    onChange={(e) => setOutreachForm({ ...outreachForm, outcome: e.target.value })}
                    className="w-full rounded-lg h-9 px-3 py-2 text-sm"
                  >
                    <option value="sent">Sent</option>
                    <option value="replied">Replied</option>
                    <option value="meeting_booked">Meeting Booked</option>
                    <option value="interested">Interested</option>
                    <option value="not_interested">Not Interested</option>
                    <option value="no_response">No Response</option>
                    <option value="bounced">Bounced</option>
                  </Select>
                </div>
              </div>
              {outreachForm.channel === "email" && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Subject Line</label>
                  <Input
                    value={outreachForm.subjectLine}
                    onChange={(e) => setOutreachForm({ ...outreachForm, subjectLine: e.target.value })}
                    placeholder="Email subject line..."
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Message (optional)</label>
                <Textarea
                  value={outreachForm.messageSent}
                  onChange={(e) => setOutreachForm({ ...outreachForm, messageSent: e.target.value })}
                  placeholder="Paste or type the message you sent..."
                  rows={3}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Notes (optional)</label>
                <Input
                  value={outreachForm.notes}
                  onChange={(e) => setOutreachForm({ ...outreachForm, notes: e.target.value })}
                  placeholder="Any additional context..."
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={handleLogOutreach} disabled={loggingOutreach} className="gap-1.5">
                  {loggingOutreach ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  Save Outreach
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowLogOutreach(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Log meeting now? prompt (after meeting_booked) */}
      {showLogMeetingPrompt && !showLogMeeting && (
        <div className="mb-6 rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-center justify-between gap-4">
          <p className="text-sm font-medium text-foreground">
            Log meeting notes now while context is fresh?
          </p>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" onClick={() => { setShowLogMeeting(true); setShowLogMeetingPrompt(false); }}>
              Yes
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowLogMeetingPrompt(false)}>
              Later
            </Button>
          </div>
        </div>
      )}

      {/* Log Meeting Form */}
      {showLogMeeting && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Video className="h-4 w-4 text-primary" />
              Log Meeting
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Notes (paste or type)</label>
                <Textarea
                  value={meetingForm.notes}
                  onChange={(e) => setMeetingForm({ ...meetingForm, notes: e.target.value })}
                  placeholder="Paste meeting notes, key points, outcomes..."
                  rows={4}
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Meeting date (optional)</label>
                  <Input
                    type="date"
                    value={meetingForm.meetingDate}
                    onChange={(e) => setMeetingForm({ ...meetingForm, meetingDate: e.target.value })}
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Outcome</label>
                  <Select
                    value={meetingForm.outcome}
                    onChange={(e) => setMeetingForm({ ...meetingForm, outcome: e.target.value })}
                    className="w-full rounded-lg h-9 px-3 py-2 text-sm"
                  >
                    <option value="positive">Positive</option>
                    <option value="negative">Needs follow-up</option>
                    <option value="next_steps">No progress</option>
                  </Select>
                </div>
              </div>
              {meetingResult?.suggestedStage && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">
                    Suggested: move to <span className="font-bold">{STAGE_LABELS[meetingResult.suggestedStage] || meetingResult.suggestedStage}</span>
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleApplySuggestedStage} disabled={updatingStage}>
                      {updatingStage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Apply"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setMeetingResult(null); setShowLogMeeting(false); setShowLogMeetingPrompt(false); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
              {!meetingResult && (
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={handleLogMeeting} disabled={loggingMeeting} className="gap-1.5">
                    {loggingMeeting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    Log & Summarize
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setShowLogMeeting(false); setShowLogMeetingPrompt(false); setMeetingResult(null); }}>
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      <div className="mb-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="flex items-center gap-2.5 text-lg font-semibold text-foreground">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl gradient-primary text-white">
              <Calendar className="h-4 w-4" />
            </div>
            Relationship Timeline
          </h2>
          <Button size="sm" variant="outline" onClick={() => setShowAddSignal(!showAddSignal)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add Intel
          </Button>
        </div>

        {showAddSignal && (
          <div className="mb-4 rounded-xl border border-border bg-card p-4 shadow-soft space-y-3">
            <div className="flex gap-3">
              <Select
                value={signalForm.type}
                onChange={(e) => setSignalForm({ ...signalForm, type: e.target.value })}
                className="rounded-lg h-9 w-auto min-w-[140px] px-3 py-2 text-sm"
              >
                <option value="company_news">Company News</option>
                <option value="conference">Conference</option>
                <option value="job_change">Job Change</option>
                <option value="linkedin_post">LinkedIn Post</option>
                <option value="hiring">Hiring</option>
                <option value="re_engagement">Re-engagement</option>
                <option value="other">Other</option>
              </Select>
              <Select
                value={String(signalForm.urgencyScore)}
                onChange={(e) => setSignalForm({ ...signalForm, urgencyScore: Number(e.target.value) })}
                className="rounded-lg h-9 w-auto min-w-[100px] px-3 py-2 text-sm"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>Urgency {n}</option>
                ))}
              </Select>
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={signalForm.private}
                  onChange={(e) => setSignalForm({ ...signalForm, private: e.target.checked })}
                  className="rounded"
                />
                <Lock className="h-3.5 w-3.5" />
                Private
              </label>
            </div>
            <textarea
              placeholder="What happened? Be specific..."
              value={signalForm.summary}
              onChange={(e) => setSignalForm({ ...signalForm, summary: e.target.value })}
              className="w-full rounded-lg border border-border bg-background p-3 text-sm"
              rows={3}
            />
            <div className="flex gap-2">
              <Input
                placeholder="Source URL (optional)"
                value={signalForm.sourceUrl}
                onChange={(e) => setSignalForm({ ...signalForm, sourceUrl: e.target.value })}
                className="flex-1"
              />
              <Button size="sm" onClick={handleAddSignal} disabled={addingSignal || !signalForm.summary.trim()}>
                {addingSignal ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </div>
        )}

        <RelationshipTimeline
          signals={prospect.signals.map((s) => ({
            id: s.id,
            type: s.type,
            summary: s.summary,
            urgencyScore: s.urgencyScore,
            sourceUrl: s.sourceUrl,
            createdAt: s.createdAt,
            private: s.private,
          }))}
          outreach={prospect.outreach.map((o) => ({
            id: o.id,
            channel: o.channel,
            messageSent: o.messageSent,
            subjectLine: o.subjectLine,
            outcome: o.outcome,
            createdAt: o.createdAt,
          }))}
          meetings={prospect.meetingLogs?.map((m) => ({
            id: m.id,
            notes: m.notes,
            summary: m.summary,
            outcome: m.outcome,
            meetingDate: m.meetingDate,
            suggestedStage: m.suggestedStage,
            createdAt: m.createdAt,
          }))}
          onTogglePrivate={handleTogglePrivate}
        />
      </div>
    </div>
  );
}
