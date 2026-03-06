"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import Link from "next/link";
import {
  Loader2,
  Key,
  Timer,
  Radio,
  User,
  Eye,
  EyeOff,
  Play,
  AlertCircle,
  Settings2,
  MessageSquare,
  Plus,
  Trash2,
  Bookmark,
  ChevronRight,
  UserPlus,
  ArrowRightLeft,
} from "lucide-react";

interface ApiKeysConfiguredViaEnv {
  geminiApiKey?: boolean;
  rapidApiKey?: boolean;
  gnewsApiKey?: boolean;
  predictHqApiKey?: boolean;
}

interface SettingsData {
  geminiApiKey?: string;
  rapidApiKey?: string;
  gnewsApiKey?: string;
  predictHqApiKey?: string;
  apiKeysConfiguredViaEnv?: ApiKeysConfiguredViaEnv;
  defaultFollowUpDays?: number;
  coldFollowUpDays?: number;
  reEngagementDays?: number;
  escalateAfterSignals?: number;
  outcomeCadence?: {
    no_response_days?: number;
    positive_days?: number;
    negative_days?: number | null;
    meeting_booked_days?: number | null;
  };
  staleProspectDays?: number;
  linkedinPollDays?: number;
  newsPollingHours?: number;
  rssPollingHours?: number;
  userName?: string;
  userTitle?: string;
  userCompany?: string;
  signatureEn?: string;
  signatureDe?: string;
  defaultLanguage?: string;
  germanFormality?: string;
  tonePreference?: string;
  customInstructions?: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/settings");
        if (!res.ok) throw new Error("Failed to load settings");
        const data = await res.json();
        setSettings(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load settings");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const saveSection = async (section: string, data: Partial<SettingsData>) => {
    setSavingSection(section);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      const updated = await res.json();
      setSettings((prev) => ({ ...prev, ...updated }));
      setHasChanges(false);
      toast("Settings saved", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
      setSavingSection(null);
    }
  };

  const saveAll = async () => {
    setSavingSection("all");
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      const updated = await res.json();
      setSettings(updated);
      setHasChanges(false);
      toast("All settings saved", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
      setSavingSection(null);
    }
  };

  const testApiKey = (name: string, value: string | undefined) => {
    if (!value || value.includes("...")) {
      toast("Enter a new API key first", "error");
      return;
    }
    if (name === "geminiApiKey" && !value.startsWith("AI")) {
      toast("Gemini keys typically start with AI", "error");
      return;
    }
    toast(`${name === "geminiApiKey" ? "Gemini" : name === "rapidApiKey" ? "RapidAPI" : "GNews"} key format looks valid`, "info");
  };

  const runCron = async (endpoint: string, label: string) => {
    toast(`Running ${label}...`, "info");
    try {
      const res = await fetch(endpoint);
      const data = await res.json();
      toast(data.message || `${label} complete`, "success");
    } catch {
      toast(`${label} failed`, "error");
    }
  };

  const update = <K extends keyof SettingsData>(key: K, value: SettingsData[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasChanges]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mb-4 h-8 w-8 animate-spin" />
        <p className="text-sm font-medium">Loading settings...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <AlertCircle className="mb-3 h-8 w-8 text-destructive" />
        <p className="mb-4 text-sm font-medium text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl animate-fade-in">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary text-white shadow-soft">
          <Settings2 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">Configure your account, integrations, and preferences.</p>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {/* Collaborator invites */}
        <Link href="/settings/invites">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <UserPlus className="h-3.5 w-3.5" />
                </div>
                Collaborator invites
              </CardTitle>
              <CardDescription>
                View and manage invitations to collaborate on accounts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <span className="text-sm text-primary font-medium flex items-center gap-1">
                View invites <ChevronRight className="h-4 w-4" />
              </span>
            </CardContent>
          </Card>
        </Link>

        {/* Account handoffs */}
        <Link href="/handoffs">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                  <ArrowRightLeft className="h-3.5 w-3.5" />
                </div>
                Account handoffs
              </CardTitle>
              <CardDescription>
                Accept or decline account transfer requests.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <span className="text-sm text-primary font-medium flex items-center gap-1">
                View handoffs <ChevronRight className="h-4 w-4" />
              </span>
            </CardContent>
          </Card>
        </Link>

        {/* API Keys */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg gradient-primary text-white">
                <Key className="h-3.5 w-3.5" />
              </div>
              API Keys
            </CardTitle>
            <CardDescription>
              Connect external services for enrichment and AI features.
              {settings.apiKeysConfiguredViaEnv &&
                Object.values(settings.apiKeysConfiguredViaEnv).some(Boolean) && (
                  <span className="mt-2 block text-green-600 dark:text-green-400">
                    {Object.entries(settings.apiKeysConfiguredViaEnv)
                      .filter(([, v]) => v)
                      .map(([k]) =>
                        k === "geminiApiKey"
                          ? "Gemini"
                          : k === "rapidApiKey"
                            ? "RapidAPI"
                            : k === "gnewsApiKey"
                              ? "GNews"
                              : "PredictHQ"
                      )
                      .join(", ")}{" "}
                    configured via environment variables (more secure).
                  </span>
                )}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {(
              [
                { key: "geminiApiKey" as const, label: "Gemini" },
                { key: "rapidApiKey" as const, label: "RapidAPI (LinkedIn)" },
                { key: "gnewsApiKey" as const, label: "GNews" },
                { key: "predictHqApiKey" as const, label: "PredictHQ (Events)" },
              ] as const
            )
              .filter(
                ({ key }) =>
                  !settings.apiKeysConfiguredViaEnv?.[key]
              )
              .map(({ key, label }) => (
              <div key={key}>
                <label className="mb-1.5 block text-sm font-semibold text-foreground">
                  {label} API Key
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showKeys[key] ? "text" : "password"}
                      value={settings[key] || ""}
                      onChange={(e) => update(key, e.target.value)}
                      placeholder={`Enter ${label} API key...`}
                      className="pr-9"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowKeys((p) => ({ ...p, [key]: !p[key] }))
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showKeys[key] ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => testApiKey(key, settings[key])}
                  >
                    Test
                  </Button>
                  <Button
                    size="sm"
                    disabled={savingSection === `api-${key}`}
                    onClick={() => saveSection(`api-${key}`, { [key]: settings[key] })}
                  >
                    {savingSection === `api-${key}` && (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    )}
                    Save
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Cadence Rules */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg gradient-warning text-white">
                <Timer className="h-3.5 w-3.5" />
              </div>
              Cadence Rules
            </CardTitle>
            <CardDescription>
              Configure follow-up timing and escalation thresholds.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField
                label="Default follow-up (days)"
                value={settings.defaultFollowUpDays ?? 5}
                onChange={(v) => update("defaultFollowUpDays", v)}
              />
              <NumberField
                label="Cold follow-up (days)"
                value={settings.coldFollowUpDays ?? 7}
                onChange={(v) => update("coldFollowUpDays", v)}
              />
              <NumberField
                label="Re-engagement (days)"
                value={settings.reEngagementDays ?? 30}
                onChange={(v) => update("reEngagementDays", v)}
              />
              <NumberField
                label="Stale prospect threshold (days)"
                value={settings.staleProspectDays ?? 30}
                onChange={(v) => update("staleProspectDays", v)}
              />
              <NumberField
                label="Escalate after (signals)"
                value={settings.escalateAfterSignals ?? 3}
                onChange={(v) => update("escalateAfterSignals", v)}
              />
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
              <p className="mb-3 text-sm font-semibold text-foreground">Outcome-based follow-up (days)</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <NumberField
                  label="No response → follow up in"
                  value={settings.outcomeCadence?.no_response_days ?? 3}
                  onChange={(v) => update("outcomeCadence", { ...settings.outcomeCadence, no_response_days: v })}
                />
                <NumberField
                  label="Positive reply → follow up in"
                  value={settings.outcomeCadence?.positive_days ?? 1}
                  onChange={(v) => update("outcomeCadence", { ...settings.outcomeCadence, positive_days: v })}
                />
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-foreground">Negative</label>
                  <Select
                    value={settings.outcomeCadence?.negative_days === null ? "none" : String(settings.outcomeCadence?.negative_days ?? 30)}
                    onChange={(e) => update("outcomeCadence", {
                      ...settings.outcomeCadence,
                      negative_days: e.target.value === "none" ? null : parseInt(e.target.value) || 30,
                    })}
                  >
                    <option value="none">No follow-up</option>
                    <option value="14">14 days</option>
                    <option value="30">30 days</option>
                    <option value="60">60 days</option>
                  </Select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-foreground">Meeting booked</label>
                  <Select
                    value={settings.outcomeCadence?.meeting_booked_days === null ? "none" : String(settings.outcomeCadence?.meeting_booked_days ?? 1)}
                    onChange={(e) => update("outcomeCadence", {
                      ...settings.outcomeCadence,
                      meeting_booked_days: e.target.value === "none" ? null : parseInt(e.target.value) || 1,
                    })}
                  >
                    <option value="none">No follow-up (handoff)</option>
                    <option value="1">1 day</option>
                    <option value="3">3 days</option>
                    <option value="7">7 days</option>
                  </Select>
                </div>
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <Button
                disabled={savingSection === "cadence"}
                onClick={() =>
                  saveSection("cadence", {
                    defaultFollowUpDays: settings.defaultFollowUpDays,
                    coldFollowUpDays: settings.coldFollowUpDays,
                    reEngagementDays: settings.reEngagementDays,
                    escalateAfterSignals: settings.escalateAfterSignals,
                    outcomeCadence: settings.outcomeCadence,
                    staleProspectDays: settings.staleProspectDays,
                  })
                }
              >
                {savingSection === "cadence" && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Cadence Rules
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Signal Polling */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg gradient-info text-white">
                <Radio className="h-3.5 w-3.5" />
              </div>
              Signal Polling
            </CardTitle>
            <CardDescription>
              Set intervals for automatic signal detection.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <NumberField
                  label="LinkedIn polling interval (days)"
                  value={settings.linkedinPollDays ?? 7}
                  onChange={(v) => update("linkedinPollDays", v)}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mb-0.5 gap-1.5"
                onClick={() => runCron("/api/cron/linkedin", "LinkedIn poll")}
              >
                <Play className="h-3.5 w-3.5" />
                Run now
              </Button>
            </div>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <NumberField
                  label="News polling interval (hours)"
                  value={settings.newsPollingHours ?? 12}
                  onChange={(v) => update("newsPollingHours", v)}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mb-0.5 gap-1.5"
                onClick={() => runCron("/api/cron/news", "News poll")}
              >
                <Play className="h-3.5 w-3.5" />
                Run now
              </Button>
            </div>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <NumberField
                  label="RSS polling interval (hours)"
                  value={settings.rssPollingHours ?? 6}
                  onChange={(v) => update("rssPollingHours", v)}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mb-0.5 gap-1.5"
                onClick={() => runCron("/api/cron/rss", "RSS poll")}
              >
                <Play className="h-3.5 w-3.5" />
                Run now
              </Button>
            </div>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <p className="mb-1.5 text-sm font-semibold text-foreground">Events / Conferences</p>
                <p className="text-xs text-muted-foreground">Scans PredictHQ for upcoming conferences matching your prospects.</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mb-0.5 gap-1.5"
                onClick={() => runCron("/api/cron/events", "Event scan")}
              >
                <Play className="h-3.5 w-3.5" />
                Run now
              </Button>
            </div>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <p className="mb-1.5 text-sm font-semibold text-foreground">Cadence Check</p>
                <p className="text-xs text-muted-foreground">Generates re-engagement signals for dormant contacts and new prospect signals.</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mb-0.5 gap-1.5"
                onClick={() => runCron("/api/cron/cadence", "Cadence check")}
              >
                <Play className="h-3.5 w-3.5" />
                Run now
              </Button>
            </div>
            <div className="flex justify-end pt-1">
              <Button
                disabled={savingSection === "polling"}
                onClick={() =>
                  saveSection("polling", {
                    linkedinPollDays: settings.linkedinPollDays,
                    newsPollingHours: settings.newsPollingHours,
                    rssPollingHours: settings.rssPollingHours,
                  })
                }
              >
                {savingSection === "polling" && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Polling Settings
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Bookmarklet */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg gradient-primary text-white">
                <Bookmark className="h-3.5 w-3.5" />
              </div>
              Capture Bookmarklet
            </CardTitle>
            <CardDescription>
              Install a bookmarklet to capture leads and signals from any webpage while you browse.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/settings/bookmarklet"
              className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
            >
              Set up bookmarklet
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </CardContent>
        </Card>

        {/* Your Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg gradient-success text-white">
                <User className="h-3.5 w-3.5" />
              </div>
              Your Info
            </CardTitle>
            <CardDescription>
              Personal details used for outreach drafting and signatures.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-foreground">
                  Name
                </label>
                <Input
                  value={settings.userName || ""}
                  onChange={(e) => update("userName", e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-foreground">
                  Title
                </label>
                <Input
                  value={settings.userTitle || ""}
                  onChange={(e) => update("userTitle", e.target.value)}
                  placeholder="Your job title"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-foreground">
                  Company
                </label>
                <Input
                  value={settings.userCompany || ""}
                  onChange={(e) => update("userCompany", e.target.value)}
                  placeholder="Your company"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground">
                Email Signature (English)
              </label>
              <Textarea
                value={settings.signatureEn || ""}
                onChange={(e) => update("signatureEn", e.target.value)}
                placeholder="Best regards,&#10;Your Name"
                rows={3}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground">
                Email Signature (German)
              </label>
              <Textarea
                value={settings.signatureDe || ""}
                onChange={(e) => update("signatureDe", e.target.value)}
                placeholder="Mit freundlichen Grüßen,&#10;Ihr Name"
                rows={3}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-foreground">
                  Default Language
                </label>
                <Select
                  value={settings.defaultLanguage || "en"}
                  onChange={(e) => update("defaultLanguage", e.target.value)}
                >
                  <option value="en">English</option>
                  <option value="de">German</option>
                  <option value="fr">French</option>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-foreground">
                  German Formality
                </label>
                <Select
                  value={settings.germanFormality || "Sie"}
                  onChange={(e) => update("germanFormality", e.target.value)}
                >
                  <option value="Sie">Sie (formal)</option>
                  <option value="Du">Du (informal)</option>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-foreground">
                  Tone Preference
                </label>
                <Select
                  value={settings.tonePreference || "Direct"}
                  onChange={(e) => update("tonePreference", e.target.value)}
                >
                  <option value="Direct">Direct</option>
                  <option value="Warm">Warm</option>
                  <option value="Formal">Formal</option>
                </Select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground">
                Custom Instructions
              </label>
              <Textarea
                value={settings.customInstructions || ""}
                onChange={(e) => update("customInstructions", e.target.value)}
                placeholder="Any special instructions for AI-generated drafts..."
                rows={4}
              />
            </div>

            <div className="flex justify-end pt-1">
              <Button
                disabled={savingSection === "info"}
                onClick={() =>
                  saveSection("info", {
                    userName: settings.userName,
                    userTitle: settings.userTitle,
                    userCompany: settings.userCompany,
                    signatureEn: settings.signatureEn,
                    signatureDe: settings.signatureDe,
                    defaultLanguage: settings.defaultLanguage,
                    germanFormality: settings.germanFormality,
                    tonePreference: settings.tonePreference,
                    customInstructions: settings.customInstructions,
                  })
                }
              >
                {savingSection === "info" && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Your Info
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Voice Examples */}
        <VoiceExamplesCard />
      </div>

      {/* Sticky Save All */}
      {hasChanges && (
        <div className="sticky bottom-0 left-0 right-0 mt-8 flex justify-end border-t border-border/60 bg-background/95 backdrop-blur-sm py-4 -mx-4 px-4 sm:-mx-0 sm:px-0">
          <Button
            onClick={saveAll}
            disabled={savingSection === "all"}
            className="gap-2"
          >
            {savingSection === "all" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Save All Changes
          </Button>
        </div>
      )}
    </div>
  );
}

function VoiceExamplesCard() {
  const [examples, setExamples] = useState<{ id: string; language: string; originalDraft: string; revisedDraft: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [originalDraft, setOriginalDraft] = useState("");
  const [revisedDraft, setRevisedDraft] = useState("");
  const [language, setLanguage] = useState("en");
  const { toast } = useToast();

  const fetchExamples = useCallback(async () => {
    try {
      const res = await fetch("/api/voice-examples");
      if (res.ok) {
        const data = await res.json();
        setExamples(data);
      }
    } catch {
      toast("Failed to load voice examples", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchExamples();
  }, [fetchExamples]);

  const handleAdd = async () => {
    if (!originalDraft.trim() || !revisedDraft.trim()) {
      toast("Both fields are required", "error");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/voice-examples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, originalDraft: originalDraft.trim(), revisedDraft: revisedDraft.trim() }),
      });
      if (res.ok) {
        setOriginalDraft("");
        setRevisedDraft("");
        fetchExamples();
        toast("Voice example added", "success");
      } else {
        toast("Failed to add", "error");
      }
    } catch {
      toast("Failed to add voice example", "error");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/voice-examples/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchExamples();
        toast("Voice example removed", "success");
      }
    } catch {
      toast("Failed to delete", "error");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
            <MessageSquare className="h-3.5 w-3.5" />
          </div>
          Voice Examples
        </CardTitle>
        <CardDescription>
          Add before/after examples so AI drafts match your writing style. Used when generating outreach.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : (
          <>
            <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Add example</p>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Original (before)</label>
                <Textarea
                  value={originalDraft}
                  onChange={(e) => setOriginalDraft(e.target.value)}
                  placeholder="Generic AI draft..."
                  rows={2}
                  className="text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Revised (your style)</label>
                <Textarea
                  value={revisedDraft}
                  onChange={(e) => setRevisedDraft(e.target.value)}
                  placeholder="Your improved version..."
                  rows={2}
                  className="text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="h-8 w-24 text-xs"
                >
                  <option value="en">English</option>
                  <option value="de">German</option>
                </Select>
                <Button size="sm" onClick={handleAdd} disabled={adding} className="gap-1.5">
                  {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Add
                </Button>
              </div>
            </div>
            {examples.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {examples.length} example{examples.length !== 1 ? "s" : ""}
                </p>
                {examples.map((ex) => (
                  <div
                    key={ex.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-border/60 p-3 text-sm"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-muted-foreground line-clamp-1">
                        <span className="font-medium">Before:</span> {ex.originalDraft.slice(0, 80)}...
                      </p>
                      <p className="line-clamp-1">
                        <span className="font-medium text-muted-foreground">After:</span> {ex.revisedDraft.slice(0, 80)}...
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">{ex.language}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(ex.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-foreground">
        {label}
      </label>
      <Input
        type="number"
        min={1}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 1)}
      />
    </div>
  );
}
