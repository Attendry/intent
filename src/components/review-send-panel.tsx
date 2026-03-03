"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  Mail,
  Linkedin,
  Copy,
  ExternalLink,
  Check,
  ChevronDown,
  RefreshCw,
  SkipForward,
  Loader2,
  Paperclip,
  FileText,
  X,
} from "lucide-react";
import { DRAFT_TEMPLATE_USE_CASES } from "@/lib/constants";

interface Prospect {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  linkedinUrl: string | null;
  company: string | null;
  title: string | null;
}

interface Signal {
  id: string;
  type: string;
  summary: string | null;
  rawContent: string | null;
  outreachAngle: string | null;
  urgencyScore: number;
}

interface ContentSuggestion {
  id: string;
  title: string;
  type: string;
  url?: string | null;
}

interface ReviewSendPanelProps {
  prospect: Prospect;
  signal: Signal;
  contentSuggestions: ContentSuggestion[];
  onComplete: () => void;
  onSkip: () => void;
}

type Channel = "email" | "linkedin";
type Language = "en" | "de";
type PanelState = "drafting" | "confirmation";

const REDRAFT_OPTIONS = [
  { label: "Shorter version", instruction: "Make it shorter and more concise" },
  { label: "Different angle", instruction: "Try a completely different outreach angle" },
  { label: "More casual", instruction: "Make the tone more casual and friendly" },
  { label: "More formal", instruction: "Make the tone more formal and professional" },
];

export default function ReviewSendPanel({
  prospect,
  signal,
  contentSuggestions,
  onComplete,
  onSkip,
}: ReviewSendPanelProps) {
  const { toast } = useToast();

  const [channel, setChannel] = useState<Channel>(
    prospect.linkedinUrl && !prospect.email ? "linkedin" : "email"
  );
  const [language, setLanguage] = useState<Language>("en");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [redrafting, setRedrafting] = useState(false);
  const [panelState, setPanelState] = useState<PanelState>("drafting");
  const [showRedraftMenu, setShowRedraftMenu] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customInstruction, setCustomInstruction] = useState("");
  const [logging, setLogging] = useState(false);

  const [templateUseCase, setTemplateUseCase] = useState<string>("auto");

  const fetchDraft = useCallback(
    async (ch: Channel, lang: Language, template?: string) => {
      setLoading(true);
      try {
        const res = await fetch("/api/intelligence/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prospectId: prospect.id,
            signalId: signal.id,
            channel: ch,
            language: lang,
            templateUseCase: template && template !== "auto" ? template : undefined,
          }),
        });
        if (!res.ok) throw new Error("Failed to generate draft");
        const data = (await res.json()) as { subject: string; body: string };
        setSubject(data.subject || "");
        setBody(data.body || "");
      } catch {
        setBody("Failed to generate draft. Please try again or write manually.");
      } finally {
        setLoading(false);
      }
    },
    [prospect.id, signal.id]
  );

  useEffect(() => {
    fetchDraft(channel, language, templateUseCase);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChannelChange = (ch: Channel) => {
    setChannel(ch);
    fetchDraft(ch, language, templateUseCase);
  };

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    fetchDraft(channel, lang, templateUseCase);
  };

  const handleTemplateChange = (t: string) => {
    setTemplateUseCase(t);
    fetchDraft(channel, language, t);
  };

  const handleRedraft = async (instruction: string) => {
    setRedrafting(true);
    setShowRedraftMenu(false);
    setShowCustomInput(false);
    try {
      const res = await fetch("/api/intelligence/redraft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalDraft: { subject, body },
          instruction,
          prospectId: prospect.id,
          signalId: signal.id,
          channel,
          language,
        }),
      });
      if (!res.ok) throw new Error("Redraft failed");
      const data = (await res.json()) as { subject: string; body: string };
      setSubject(data.subject || "");
      setBody(data.body || "");
    } catch {
      toast("Failed to redraft. Please try again.", "error");
    } finally {
      setRedrafting(false);
    }
  };

  const handleApproveAndCopy = async () => {
    try {
      await navigator.clipboard.writeText(body);
      toast("Copied to clipboard", "success");
    } catch {
      toast("Could not copy — please select and copy manually", "error");
    }

    if (channel === "email" && prospect.email) {
      const mailto = `mailto:${encodeURIComponent(prospect.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(mailto, "_blank");
    } else if (channel === "linkedin" && prospect.linkedinUrl) {
      window.open(prospect.linkedinUrl, "_blank");
    }

    setPanelState("confirmation");
  };

  const handleConfirmSent = async () => {
    setLogging(true);
    try {
      const res = await fetch("/api/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospectId: prospect.id,
          channel,
          messageSent: body,
          subjectLine: channel === "email" ? subject : null,
          outcome: "no_response",
          language,
          signalId: signal.id,
        }),
      });
      if (!res.ok) throw new Error("Failed to log outreach");
      toast("Outreach logged successfully", "success");
      onComplete();
    } catch {
      toast("Failed to log outreach", "error");
    } finally {
      setLogging(false);
    }
  };

  const handleAttachContent = (content: ContentSuggestion) => {
    const link = content.url || `[Content: ${content.title}]`;
    setBody((prev) => `${prev}\n\n${link}`);
    toast(`Attached "${content.title}"`, "info");
  };

  if (panelState === "confirmation") {
    return (
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[oklch(0.6_0.18_145/0.15)]">
            <Check className="h-6 w-6 text-[oklch(0.6_0.18_145)]" />
          </div>
          <p className="text-sm font-medium text-foreground">
            {prospect.firstName} {prospect.lastName} — Message copied. Did you
            send it?
          </p>
          <div className="flex gap-3">
            <Button
              onClick={handleConfirmSent}
              disabled={logging}
              className="gap-2"
            >
              {logging ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Yes, sent via {channel}
            </Button>
            <Button
              variant="outline"
              onClick={() => setPanelState("drafting")}
            >
              Not yet — keep in queue
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      {/* Channel + template + language toggles */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg border border-border p-0.5">
          <button
            onClick={() => handleChannelChange("email")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              channel === "email"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Mail className="h-3.5 w-3.5" />
            Email
          </button>
          <button
            onClick={() => handleChannelChange("linkedin")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              channel === "linkedin"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Linkedin className="h-3.5 w-3.5" />
            LinkedIn
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Template:</span>
          <select
            value={templateUseCase}
            onChange={(e) => handleTemplateChange(e.target.value)}
            className="h-8 w-auto min-w-[120px] rounded-lg border border-border bg-background px-2 text-xs font-medium"
          >
            {DRAFT_TEMPLATE_USE_CASES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        </div>

        <div className="flex gap-1 rounded-lg border border-border p-0.5">
          <button
            onClick={() => handleLanguageChange("en")}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              language === "en"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            EN
          </button>
          <button
            onClick={() => handleLanguageChange("de")}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              language === "de"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            DE
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
          <div className="h-40 w-full animate-pulse rounded-md bg-muted" />
        </div>
      ) : (
        <>
          {/* To / LinkedIn URL */}
          {channel === "email" ? (
            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                To
              </label>
              <Input
                value={prospect.email || ""}
                readOnly
                className="h-9 bg-muted/50 text-sm"
              />
            </div>
          ) : (
            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                LinkedIn
              </label>
              <div className="flex h-9 items-center rounded-md border border-input bg-muted/50 px-3 text-sm text-muted-foreground">
                {prospect.linkedinUrl || "No LinkedIn URL"}
              </div>
            </div>
          )}

          {/* Subject (email only) */}
          {channel === "email" && (
            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Subject
              </label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="h-9 text-sm"
                placeholder="Email subject line..."
              />
            </div>
          )}

          {/* Body */}
          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Message
            </label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={channel === "linkedin" ? 6 : 10}
              className="text-sm"
              placeholder="Your outreach message..."
            />
          </div>

          {/* Content suggestions */}
          {contentSuggestions.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Suggested content
              </p>
              <div className="flex flex-wrap gap-2">
                {contentSuggestions.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleAttachContent(c)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-accent"
                  >
                    <FileText className="h-3 w-3 text-muted-foreground" />
                    <span className="max-w-[160px] truncate">{c.title}</span>
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1 py-0"
                    >
                      {c.type}
                    </Badge>
                    <Paperclip className="h-3 w-3 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={handleApproveAndCopy}
              className="gap-2"
              disabled={!body.trim()}
            >
              <Copy className="h-4 w-4" />
              Approve & Copy
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>

            {/* Redraft dropdown */}
            <div className="relative">
              <Button
                variant="outline"
                onClick={() => {
                  setShowRedraftMenu(!showRedraftMenu);
                  setShowCustomInput(false);
                }}
                disabled={redrafting}
                className="gap-1.5"
              >
                {redrafting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Redraft
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>

              {showRedraftMenu && (
                <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-md border border-border bg-popover p-1 shadow-md">
                  {REDRAFT_OPTIONS.map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => handleRedraft(opt.instruction)}
                      className="flex w-full items-center rounded px-3 py-1.5 text-xs text-foreground hover:bg-accent"
                    >
                      {opt.label}
                    </button>
                  ))}
                  <div className="my-1 h-px bg-border" />
                  <button
                    onClick={() => {
                      setShowCustomInput(true);
                      setShowRedraftMenu(false);
                    }}
                    className="flex w-full items-center rounded px-3 py-1.5 text-xs text-foreground hover:bg-accent"
                  >
                    Custom instruction...
                  </button>
                </div>
              )}
            </div>

            {showCustomInput && (
              <div className="flex items-center gap-2">
                <Input
                  value={customInstruction}
                  onChange={(e) => setCustomInstruction(e.target.value)}
                  placeholder="e.g. mention their podcast..."
                  className="h-9 w-56 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && customInstruction.trim()) {
                      handleRedraft(customInstruction.trim());
                      setCustomInstruction("");
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={() => {
                    if (customInstruction.trim()) {
                      handleRedraft(customInstruction.trim());
                      setCustomInstruction("");
                    }
                  }}
                  disabled={!customInstruction.trim()}
                >
                  Go
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowCustomInput(false);
                    setCustomInstruction("");
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            <Button
              variant="ghost"
              onClick={onSkip}
              className="ml-auto gap-1.5 text-muted-foreground"
            >
              <SkipForward className="h-4 w-4" />
              Skip
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
