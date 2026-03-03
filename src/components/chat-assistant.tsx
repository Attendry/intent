"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import {
  MessageCircle,
  X,
  Send,
  Trash2,
  Loader2,
  Sparkles,
  Minus,
  Maximize2,
  Minimize2,
  Bookmark,
} from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant" | "divider";
  content: string;
  id?: string; // for save button key
}

interface MentionItem {
  type: "prospect" | "company" | "content";
  id: string;
  label: string;
  sub?: string;
}

interface ChatContext {
  type: "prospect" | "company" | "general";
  id?: string;
  label?: string;
}

const PROSPECT_STARTERS = [
  "What do I need to know?",
  "Handle price objection",
  "Handle 'we're locked into [competitor]' objection",
  "Handle 'not in budget this quarter' objection",
  "Handle 'need to talk to my boss' objection",
  "Handle 'timing isn't right' objection",
  "Prep me for a call",
  "Draft a follow-up email",
  "What content should I share?",
  "Discovery questions for this persona",
  "Questions to uncover their priorities",
  "Suggest next steps",
];

const COMPANY_STARTERS = [
  "Who should I talk to next?",
  "What are their biggest risks?",
  "Competitive positioning",
  "Recent changes to know about",
  "Account strategy overview",
];

const GENERAL_STARTERS = [
  "Help me with an objection",
  "Handle price objection",
  "Handle 'we're locked into [competitor]' objection",
  "Prep me for a meeting",
  "Draft an outreach message",
  "Discovery questions for [persona type]",
];

function parseContext(pathname: string): ChatContext {
  // /prospects/[id] or /prospects/[id]/...
  const prospectMatch = pathname.match(/^\/prospects\/([^/]+)/);
  if (prospectMatch) {
    return { type: "prospect", id: prospectMatch[1] };
  }
  // /companies/[id] or /companies/[id]/documents/...
  const companyMatch = pathname.match(/^\/companies\/([^/]+)/);
  if (companyMatch) {
    return { type: "company", id: companyMatch[1] };
  }
  return { type: "general" };
}

function getStarters(ctx: ChatContext) {
  if (ctx.type === "prospect") return PROSPECT_STARTERS;
  if (ctx.type === "company") return COMPANY_STARTERS;
  return GENERAL_STARTERS;
}

function SimpleMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Headers
    if (line.startsWith("### ")) {
      elements.push(
        <h4 key={i} className="font-semibold text-xs mt-2 mb-1">
          {line.slice(4)}
        </h4>
      );
      continue;
    }
    if (line.startsWith("## ")) {
      elements.push(
        <h3 key={i} className="font-semibold text-sm mt-2 mb-1">
          {line.slice(3)}
        </h3>
      );
      continue;
    }
    if (line.startsWith("# ")) {
      elements.push(
        <h2 key={i} className="font-bold text-sm mt-2 mb-1">
          {line.slice(2)}
        </h2>
      );
      continue;
    }

    // Bullet points
    if (line.match(/^[-*]\s/)) {
      elements.push(
        <li key={i} className="ml-3 text-xs leading-relaxed">
          {renderInline(line.slice(2))}
        </li>
      );
      continue;
    }

    // Numbered lists
    if (line.match(/^\d+\.\s/)) {
      const content = line.replace(/^\d+\.\s/, "");
      elements.push(
        <li key={i} className="ml-3 text-xs leading-relaxed list-decimal">
          {renderInline(content)}
        </li>
      );
      continue;
    }

    // Empty lines
    if (line.trim() === "") {
      elements.push(<div key={i} className="h-1.5" />);
      continue;
    }

    // Regular text
    elements.push(
      <p key={i} className="text-xs leading-relaxed">
        {renderInline(line)}
      </p>
    );
  }

  return <div>{elements}</div>;
}

// Renders @[label](type:id) as bold, blue span showing only the label. Plain text stays default color.
function renderMentions(text: string, variant: "user" | "assistant" = "assistant"): React.ReactNode {
  const re = /@\[([^\]]*)\]\((?:prospect|company|content):[^)]+\)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) {
      parts.push(
        <span key={`t-${key++}`} className="text-foreground">
          {text.slice(lastIndex, m.index)}
        </span>
      );
    }
    const label = m[1];
    const mentionClass =
      variant === "user"
        ? "font-bold text-blue-300"
        : "font-bold text-blue-600";
    parts.push(
      <span key={`m-${key++}`} className={mentionClass}>
        {label}
      </span>
    );
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(
      <span key={`t-${key++}`} className="text-foreground">
        {text.slice(lastIndex)}
      </span>
    );
  }
  return parts.length > 1 ? <>{parts}</> : parts[0] ?? text;
}

function renderInline(text: string): React.ReactNode {
  // Process @ mentions and **bold** - only those get special styling; plain text stays default
  const combinedRe = /@\[[^\]]*\]\((?:prospect|company|content):[^)]+\)|\*\*[^*]+\*\*/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = combinedRe.exec(text)) !== null) {
    if (m.index > lastIndex) {
      parts.push(text.slice(lastIndex, m.index));
    }
    const match = m[0];
    if (match.startsWith("@[")) {
      const labelMatch = match.match(/@\[([^\]]*)\]/);
      const label = labelMatch ? labelMatch[1] : match;
      parts.push(
        <span key={key++} className="font-bold text-blue-600">
          {label}
        </span>
      );
    } else {
      parts.push(
        <strong key={key++} className="font-semibold">
          {match.slice(2, -2)}
        </strong>
      );
    }
    lastIndex = combinedRe.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length > 1 ? <>{parts}</> : parts[0] ?? text;
}

export default function ChatAssistant() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [context, setContext] = useState<ChatContext>({ type: "general" });
  const [contextLabel, setContextLabel] = useState("");
  const [showStarters, setShowStarters] = useState(true);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionResults, setMentionResults] = useState<MentionItem[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionCursor, setMentionCursor] = useState(0);
  const [savingId, setSavingId] = useState<string | null>(null);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevContextRef = useRef<string>("");
  const abortRef = useRef<AbortController | null>(null);
  const mentionSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect context from pathname
  useEffect(() => {
    const newCtx = parseContext(pathname);
    const ctxKey = `${newCtx.type}:${newCtx.id || ""}`;

    if (ctxKey !== prevContextRef.current && prevContextRef.current !== "") {
      // Context changed — fetch label and insert divider
      if (newCtx.id) {
        fetchContextLabel(newCtx).then((label) => {
          newCtx.label = label;
          setContext(newCtx);
          setContextLabel(label);
          if (messages.length > 0) {
            setMessages((prev) => [
              ...prev,
              { role: "divider", content: label },
            ]);
          }
          setShowStarters(true);
        });
      } else {
        setContext(newCtx);
        setContextLabel("General");
        if (
          messages.length > 0 &&
          (prevContextRef.current.startsWith("prospect:") ||
          prevContextRef.current.startsWith("company:"))
        ) {
          setMessages((prev) => [
            ...prev,
            { role: "divider", content: "General" },
          ]);
        }
        setShowStarters(true);
      }
    } else if (prevContextRef.current === "") {
      // Initial load
      if (newCtx.id) {
        fetchContextLabel(newCtx).then((label) => {
          newCtx.label = label;
          setContext(newCtx);
          setContextLabel(label);
        });
      } else {
        setContext(newCtx);
        setContextLabel("General");
      }
    }

    prevContextRef.current = ctxKey;
  }, [pathname, messages.length]);

  async function fetchContextLabel(ctx: ChatContext): Promise<string> {
    try {
      if (ctx.type === "prospect" && ctx.id) {
        const res = await fetch(`/api/prospects/${ctx.id}`);
        if (!res.ok) return "Prospect";
        const data = await res.json();
        if (data.firstName)
          return `${data.firstName} ${data.lastName}${data.company ? `, ${data.company}` : ""}`;
      } else if (ctx.type === "company" && ctx.id) {
        const res = await fetch(`/api/companies/${ctx.id}`);
        if (!res.ok) return "Company";
        const data = await res.json();
        if (data.name) return data.name;
      }
    } catch { /* */ }
    return ctx.type === "prospect" ? "Prospect" : "Company";
  }

  // Keyboard shortcut: Ctrl+/
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        setOpen((prev) => {
          const next = !prev;
          if (next) {
            setTimeout(() => inputRef.current?.focus(), 100);
          }
          return next;
        });
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // @ mention search
  useEffect(() => {
    if (!mentionOpen || mentionQuery.length < 2) {
      setMentionResults([]);
      return;
    }
    if (mentionSearchTimeout.current) clearTimeout(mentionSearchTimeout.current);
    mentionSearchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(mentionQuery)}`);
        if (!res.ok) return;
        const data = await res.json();
        const items: MentionItem[] = [];
        for (const p of data.prospects || []) {
          items.push({
            type: "prospect",
            id: p.id,
            label: `${p.firstName || ""} ${p.lastName || ""}`.trim() || "Prospect",
            sub: p.company,
          });
        }
        for (const c of data.companies || []) {
          items.push({
            type: "company",
            id: c.id,
            label: c.name,
            sub: c.industry,
          });
        }
        for (const c of data.content || []) {
          items.push({
            type: "content",
            id: c.id,
            label: c.title,
            sub: c.type,
          });
        }
        setMentionResults(items);
        setMentionCursor(0);
      } catch {
        setMentionResults([]);
      }
      mentionSearchTimeout.current = null;
    }, 200);
    return () => {
      if (mentionSearchTimeout.current) clearTimeout(mentionSearchTimeout.current);
    };
  }, [mentionQuery, mentionOpen]);

  const insertMention = (item: MentionItem) => {
    const ref = `@[${item.label}](${item.type}:${item.id})`;
    setInput((prev) => {
      const atIdx = prev.lastIndexOf("@");
      return prev.slice(0, atIdx) + ref + " ";
    });
    setMentionOpen(false);
    setMentionQuery("");
    setMentionResults([]);
    inputRef.current?.focus();
  };

  const handleInputChange = (value: string) => {
    setInput(value);
    const lastAt = value.lastIndexOf("@");
    if (
      lastAt >= 0 &&
      (lastAt === 0 || value[lastAt - 1] === " ") &&
      value[lastAt + 1] !== "[" // not already in @[label](type:id)
    ) {
      const after = value.slice(lastAt + 1);
      const spaceIdx = after.indexOf(" ");
      const query = spaceIdx >= 0 ? after.slice(0, spaceIdx) : after;
      setMentionOpen(true);
      setMentionQuery(query);
    } else {
      setMentionOpen(false);
    }
  };

  const handleSaveFinding = async (content: string, msgIndex: number) => {
    const id = `msg-${msgIndex}`;
    setSavingId(id);
    try {
      const res = await fetch("/api/findings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          prospectId: context.type === "prospect" ? context.id : undefined,
          companyId: context.type === "company" ? context.id : undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast("Finding saved. View it in Findings.", "success");
    } catch {
      toast("Failed to save finding", "error");
    } finally {
      setSavingId(null);
    }
  };

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || streaming) return;

      const userMsg: ChatMessage = { role: "user", content: text.trim() };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setStreaming(true);
      setShowStarters(false);

      // Build history (excluding the new message)
      const history = [...messages];

      try {
        abortRef.current = new AbortController();

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text.trim(),
            history,
            context: { type: context.type, id: context.id },
          }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Chat failed" }));
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `Error: ${err.error || "Something went wrong"}`,
            },
          ]);
          setStreaming(false);
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          setStreaming(false);
          return;
        }

        const decoder = new TextDecoder();
        let assistantText = "";

        // Add empty assistant message
        setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          assistantText += chunk;

          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content: assistantText,
            };
            return updated;
          });
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "Error: Failed to get response." },
          ]);
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [messages, context, streaming]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mentionOpen && mentionResults.length > 0) {
      insertMention(mentionResults[mentionCursor]);
      return;
    }
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!mentionOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMentionCursor((c) => Math.min(c + 1, mentionResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMentionCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter" && mentionResults.length > 0) {
      e.preventDefault();
      insertMention(mentionResults[mentionCursor]);
    } else if (e.key === "Escape") {
      setMentionOpen(false);
    }
  };

  const clearChat = () => {
    if (abortRef.current) abortRef.current.abort();
    setMessages([]);
    setStreaming(false);
    setShowStarters(true);
  };

  const starters = getStarters(context);
  const hasMessages = messages.filter((m) => m.role !== "divider").length > 0;

  // Don't render on document viewer pages (it has its own full-screen layout)
  if (pathname.match(/^\/companies\/[^/]+\/documents\/[^/]+$/)) {
    return null;
  }

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95"
          title="Sales Assistant (Ctrl+/)"
        >
          <MessageCircle className="h-5 w-5" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className={`fixed z-50 flex flex-col border border-border bg-card shadow-2xl overflow-hidden transition-all ${
            expanded
              ? "inset-0 rounded-none"
              : "bottom-4 right-4 left-4 sm:left-auto sm:w-96 rounded-2xl"
          }`}
          style={
            expanded
              ? { height: "100vh", maxHeight: "100vh" }
              : { height: "min(520px, calc(100vh - 32px))", maxHeight: "calc(100vh - 32px)" }
          }
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-primary/5 to-primary/10 px-4 py-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold leading-none">
                  Sales Assistant
                </h3>
                {contextLabel && contextLabel !== "General" && (
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    Talking about: {contextLabel}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {hasMessages && (
                <button
                  onClick={clearChat}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  title="Clear chat"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => setExpanded(!expanded)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title={expanded ? "Restore" : "Expand to full page"}
              >
                {expanded ? (
                  <Minimize2 className="h-3.5 w-3.5" />
                ) : (
                  <Maximize2 className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="Minimize (Ctrl+/)"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => {
                  setOpen(false);
                  clearChat();
                }}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="Close"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {!hasMessages && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 mb-3">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">
                  How can I help?
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  {context.type === "prospect"
                    ? "Ask me anything about this prospect, objections, or outreach strategy."
                    : context.type === "company"
                      ? "Ask me about this account, intel, strategy, or research."
                      : "Ask me about sales strategy, objections, or meeting prep."}
                </p>
              </div>
            )}

            {messages.map((msg, i) => {
              if (msg.role === "divider") {
                return (
                  <div
                    key={i}
                    className="flex items-center gap-2 py-1"
                  >
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      Context: {msg.content}
                    </span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                );
              }

              if (msg.role === "user") {
                return (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-xs text-white leading-relaxed">
                      {renderMentions(msg.content, "user")}
                    </div>
                  </div>
                );
              }

              // Assistant
              return (
                <div key={i} className="flex gap-2 group/msg">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5">
                    <Sparkles className="h-3 w-3 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-muted/60 px-3.5 py-2 text-foreground">
                      {msg.content ? (
                        <SimpleMarkdown text={msg.content} />
                      ) : (
                        <div className="flex items-center gap-1.5 py-0.5">
                          <Loader2 className="h-3 w-3 animate-spin text-primary" />
                          <span className="text-xs text-muted-foreground">
                            Thinking...
                          </span>
                        </div>
                      )}
                    </div>
                    {msg.content && (
                      <button
                        onClick={() => handleSaveFinding(msg.content, i)}
                        disabled={savingId === `msg-${i}`}
                        className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground opacity-0 group-hover/msg:opacity-100 transition-opacity disabled:opacity-50"
                        title="Save finding"
                      >
                        {savingId === `msg-${i}` ? (
                          <Loader2 className="h-2.5 w-2.5 animate-spin" />
                        ) : (
                          <Bookmark className="h-2.5 w-2.5" />
                        )}
                        Save finding
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick actions */}
          {showStarters && (
            <div className="border-t border-border/50 px-3 py-2 shrink-0">
              <div className="flex flex-wrap gap-1.5">
                {starters.map((starter) => (
                  <button
                    key={starter}
                    onClick={() => sendMessage(starter)}
                    disabled={streaming}
                    className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    {starter}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="border-t border-border px-3 py-2.5 shrink-0 relative"
          >
            {mentionOpen && (
              <div className="absolute bottom-full left-3 right-3 mb-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg py-1 z-10">
                <p className="px-2 py-1 text-[10px] text-muted-foreground">
                  Link to prospect, company, or content
                </p>
                {mentionResults.length === 0 ? (
                  <p className="px-2 py-2 text-xs text-muted-foreground">
                    {mentionQuery.length < 2 ? "Type 2+ chars to search" : "No results"}
                  </p>
                ) : (
                  mentionResults.map((item, j) => (
                    <button
                      key={`${item.type}-${item.id}`}
                      type="button"
                      onClick={() => insertMention(item)}
                      className={`w-full flex flex-col items-start px-2 py-1.5 text-left text-xs hover:bg-muted ${
                        j === mentionCursor ? "bg-muted" : ""
                      }`}
                    >
                      <span className="font-medium">{item.label}</span>
                      {item.sub && (
                        <span className="text-[10px] text-muted-foreground">{item.sub}</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  streaming
                    ? "Responding..."
                    : "Ask anything... Use @ to link prospects, companies, or content"
                }
                disabled={streaming}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || streaming}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white transition-all hover:bg-primary/90 disabled:opacity-30 disabled:hover:bg-primary"
              >
                {streaming ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground/50 text-center">
              Ctrl+/ to toggle &middot; Powered by Gemini + Google Search
            </p>
          </form>
        </div>
      )}
    </>
  );
}
