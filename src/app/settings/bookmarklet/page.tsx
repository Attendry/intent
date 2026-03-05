"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bookmark, Copy, Check, ExternalLink, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/toast";

const CONTENT_MAX_LEN = 1500;
const CAPTURE_TOKEN_KEY = "twobrains_capture_token";

function getBookmarkletCode(baseUrl: string, token: string) {
  const origin = baseUrl.replace(/\/$/, "");
  const tokenParam = token ? `&token=${encodeURIComponent(token)}` : "";
  return `javascript:(function(){var u=encodeURIComponent(window.location.href);var t=encodeURIComponent(document.title);var s=window.getSelection().toString().trim();var c=(s||document.body.innerText||'').replace(/\\s+/g,' ').trim().slice(0,${CONTENT_MAX_LEN});window.open('${origin}/capture?url='+u+'&title='+t+(c?'&content='+encodeURIComponent(c):'')+'${tokenParam}','TwobrainsCapture','width=420,height=640,top=100,left=100');})();`;
}

export default function BookmarkletPage() {
  const [copied, setCopied] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const { toast } = useToast();

  const fetchOrCreateToken = useCallback(async (regenerate = false) => {
    setLoading(true);
    try {
      if (regenerate) {
        const res = await fetch("/api/capture-token", { method: "POST" });
        if (!res.ok) throw new Error("Failed to generate");
        const data = await res.json();
        const t = data.token;
        if (t) {
          localStorage.setItem(CAPTURE_TOKEN_KEY, t);
          setToken(t);
        }
      } else {
        const stored = localStorage.getItem(CAPTURE_TOKEN_KEY);
        if (stored) {
          const verify = await fetch("/api/capture-token", {
            headers: { "X-Capture-Token": stored },
          });
          if (verify.ok) {
            const data = await verify.json();
            if (data.valid) {
              setToken(stored);
              return;
            }
          }
        }
        const res = await fetch("/api/capture-token", { method: "POST" });
        if (!res.ok) throw new Error("Failed to generate");
        const data = await res.json();
        const t = data.token;
        if (t) {
          localStorage.setItem(CAPTURE_TOKEN_KEY, t);
          setToken(t);
        }
      }
    } catch {
      toast("Failed to load capture token", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    setBaseUrl(typeof window !== "undefined" ? window.location.origin : "");
  }, []);

  useEffect(() => {
    fetchOrCreateToken();
  }, [fetchOrCreateToken]);

  const bookmarkletCode = baseUrl && token ? getBookmarkletCode(baseUrl, token) : "";

  const handleCopy = () => {
    if (!bookmarkletCode) return;
    navigator.clipboard.writeText(bookmarkletCode);
    setCopied(true);
    toast("Bookmarklet code copied to clipboard", "success");
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          LinkedIn Quick-Capture Bookmarklet
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Capture signals from LinkedIn while you browse, without leaving the
          page.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bookmark className="h-4 w-4" />
            How to Install
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-inside list-decimal space-y-3 text-sm text-foreground">
            <li>
              <strong>Show your bookmarks bar</strong> — Press{" "}
              <Badge variant="outline" className="font-mono text-xs">
                Ctrl+Shift+B
              </Badge>{" "}
              in Chrome/Edge
            </li>
            <li>
              <strong>Open the install page</strong> and drag the button to your bookmarks bar:
              <div className="mt-2 flex flex-col gap-2">
                <a
                  href={token ? `/api/bookmarklet-install?token=${encodeURIComponent(token)}` : "/api/bookmarklet-install"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-fit items-center gap-2 rounded-xl gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft hover:brightness-110 transition-all disabled:opacity-50"
                  style={{ pointerEvents: loading ? "none" : undefined }}
                >
                  <Bookmark className="h-4 w-4" />
                  {loading ? "Loading…" : "Open install page"}
                </a>
                {token && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-fit gap-2 text-muted-foreground"
                    onClick={() => { setRegenerating(true); fetchOrCreateToken(true).finally(() => setRegenerating(false)); }}
                    disabled={regenerating}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${regenerating ? "animate-spin" : ""}`} />
                    Regenerate token
                  </Button>
                )}
                <span className="text-xs text-muted-foreground">
                  A new tab opens with a plain page — drag the button from there to avoid browser security blocks.
                </span>
              </div>
            </li>
            <li>
              <strong>Alternative:</strong> Copy the code and create a bookmark
              manually
              <div className="mt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCopy}
                  disabled={!bookmarkletCode || loading}
                  className="gap-2"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copied ? "Copied" : "Copy bookmarklet code"}
                </Button>
              </div>
            </li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ExternalLink className="h-4 w-4" />
            How to Use
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-foreground">
          <p>
            While browsing LinkedIn and you see a prospect post something
            interesting:
          </p>
          <ol className="list-inside list-decimal space-y-2">
            <li>Click the &quot;Capture Signal&quot; bookmark in your bar</li>
            <li>
              A small popup opens pre-filled with the LinkedIn page URL and title
            </li>
            <li>
              Select the prospect, choose the signal type, add a quick note
            </li>
            <li>Click Submit — the signal is saved in Twobrains in 10 seconds</li>
          </ol>
          <p className="text-muted-foreground">
            The signal will appear in your morning queue, scored and ready for
            action. This is a supplement to the automated LinkedIn monitoring
            via Proxycurl — use it for things you spot in real-time while
            browsing.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Important Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            • The bookmarklet opens a popup to{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground">
              {baseUrl || "..."}/capture
            </code>
            . Use the same origin where Twobrains is running.
          </p>
          <p>
            • Use the &quot;Open install page&quot; button to install — React blocks
            javascript: links on this page, so the plain install page avoids that.
          </p>
          <p>
            • LinkedIn&apos;s Content Security Policy may block inline scripts,
            which is why the bookmarklet uses a popup approach instead of
            injecting directly into the page.
          </p>
          <p>
            • The capture form auto-searches your existing prospects as you
            type, so you can quickly select the right person.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
