"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  FileText,
  Plus,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Highlighter,
  X,
  Save,
  Copy,
} from "lucide-react";
import "pdfjs-dist/web/pdf_viewer.css";

interface IntelEntry {
  id: string;
  type: string;
  summary: string;
  sourceRef: string | null;
  sourceQuote: string | null;
  sourceUrl: string | null;
  urgencyScore: number;
  actionContext: string | null;
  date: string | null;
  createdAt: string;
  documentId?: string | null;
}

interface DocumentMeta {
  id: string;
  title: string;
  type: string;
  sourceUrl: string | null;
  status: string;
  fullSummary: string | null;
}

const INTEL_TYPE_LABELS: Record<string, string> = {
  company_news: "News",
  conference: "Conference",
  funding: "Funding",
  partnership: "Partnership",
  hiring: "Hiring",
  leadership_change: "Leadership",
  earnings: "Earnings",
  strategy: "Strategy",
  risk: "Risk",
  other: "Other",
};

const INTEL_TYPE_COLORS: Record<string, string> = {
  company_news: "bg-blue-500/10 text-blue-600",
  conference: "bg-purple-500/10 text-purple-600",
  funding: "bg-green-500/10 text-green-600",
  partnership: "bg-cyan-500/10 text-cyan-600",
  hiring: "bg-orange-500/10 text-orange-600",
  leadership_change: "bg-red-500/10 text-red-600",
  earnings: "bg-emerald-500/10 text-emerald-600",
  strategy: "bg-indigo-500/10 text-indigo-600",
  risk: "bg-amber-500/10 text-amber-600",
  other: "bg-gray-500/10 text-gray-600",
};

const INTEL_TYPES = Object.entries(INTEL_TYPE_LABELS);

export default function DocumentViewerPage() {
  const { id: companyId, docId } = useParams<{ id: string; docId: string }>();
  const searchParams = useSearchParams();
  const highlightQuery = searchParams.get("highlight");
  const pageQuery = searchParams.get("page");

  const [doc, setDoc] = useState<DocumentMeta | null>(null);
  const [intel, setIntel] = useState<IntelEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState("");

  // PDF state
  const pageContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.3);
  const [rendering, setRendering] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderTaskRef = useRef<any>(null);

  // Selection state
  const [selectedText, setSelectedText] = useState("");
  const [selectionPos, setSelectionPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    type: "other",
    summary: "",
    urgencyScore: 3,
  });
  const [saving, setSaving] = useState(false);

  const [activeIntelId, setActiveIntelId] = useState<string | null>(null);

  const pdfUrl = `/api/companies/${companyId}/documents/serve?docId=${docId}`;

  // Fetch document and intel data
  const fetchData = useCallback(async () => {
    try {
      const [companyRes, intelRes] = await Promise.all([
        fetch(`/api/companies/${companyId}`),
        fetch(`/api/companies/${companyId}/intel`),
      ]);
      const companyData = await companyRes.json();
      setCompanyName(companyData.name || "");

      const docData = companyData.documents?.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (d: any) => d.id === docId
      );
      if (docData) setDoc(docData);

      const allIntel: IntelEntry[] = await intelRes.json();
      const docIntel = allIntel.filter((i) => i.documentId === docId);
      setIntel(docIntel);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [companyId, docId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Load PDF document
  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

      const loadingTask = pdfjsLib.getDocument(pdfUrl);
      const pdf = await loadingTask.promise;

      if (cancelled) return;
      setPdfDoc(pdf);
      setTotalPages(pdf.numPages);

      const startPage = pageQuery ? parseInt(pageQuery) : 1;
      if (startPage >= 1 && startPage <= pdf.numPages) {
        setCurrentPage(startPage);
      }
    }

    loadPdf().catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [pdfUrl, pageQuery]);

  // Render the current page (canvas + text layer)
  useEffect(() => {
    if (!pdfDoc || !pageContainerRef.current) return;
    let cancelled = false;

    async function renderPage() {
      setRendering(true);
      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale });
      const container = pageContainerRef.current!;

      // Clear previous render
      container.innerHTML = "";

      // Wrapper div that holds both canvas and text layer
      const wrapper = document.createElement("div");
      wrapper.style.position = "relative";
      wrapper.style.width = `${viewport.width}px`;
      wrapper.style.height = `${viewport.height}px`;
      container.appendChild(wrapper);

      // Canvas
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.display = "block";
      wrapper.appendChild(canvas);

      const ctx = canvas.getContext("2d")!;

      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          /* ignore */
        }
      }

      const renderTask = page.render({ canvasContext: ctx, viewport });
      renderTaskRef.current = renderTask;

      try {
        await renderTask.promise;
      } catch {
        if (cancelled) return;
      }
      if (cancelled) return;

      // Text layer - use the pdfjs-dist TextLayer class
      const pdfjsLib = await import("pdfjs-dist");
      const textContent = await page.getTextContent();

      const textLayerDiv = document.createElement("div");
      textLayerDiv.className = "textLayer";
      textLayerDiv.style.position = "absolute";
      textLayerDiv.style.top = "0";
      textLayerDiv.style.left = "0";
      textLayerDiv.style.width = `${viewport.width}px`;
      textLayerDiv.style.height = `${viewport.height}px`;
      wrapper.appendChild(textLayerDiv);

      const textLayer = new pdfjsLib.TextLayer({
        textContentSource: textContent,
        container: textLayerDiv,
        viewport,
      });

      await textLayer.render();

      if (cancelled) return;

      // Apply highlights
      applyHighlights(textLayerDiv);
      setRendering(false);
    }

    renderPage().catch(console.error);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfDoc, currentPage, scale, intel, activeIntelId, highlightQuery]);

  // Apply text highlights by searching through text layer spans
  const applyHighlights = useCallback(
    (textLayerDiv: HTMLDivElement) => {
      const allSpans = textLayerDiv.querySelectorAll("span");
      if (allSpans.length === 0) return;

      // Build quotes to highlight on this page
      type Quote = { text: string; color: string; id: string };
      const quotes: Quote[] = [];

      if (highlightQuery) {
        quotes.push({
          text: highlightQuery,
          color: "rgba(255, 200, 0, 0.45)",
          id: "__url__",
        });
      }

      for (const entry of intel) {
        if (!entry.sourceQuote) continue;
        // Only highlight entries whose sourceRef matches current page
        const pageMatch = entry.sourceRef?.match(
          /(?:p(?:age)?\.?\s*)(\d+)/i
        );
        if (pageMatch && parseInt(pageMatch[1]) !== currentPage) continue;

        quotes.push({
          text: entry.sourceQuote,
          color:
            entry.id === activeIntelId
              ? "rgba(100, 149, 237, 0.5)"
              : "rgba(100, 149, 237, 0.2)",
          id: entry.id,
        });
      }

      if (quotes.length === 0) return;

      // Concatenate all span text to search within
      const spans = Array.from(allSpans);
      const fullText = spans.map((s) => s.textContent || "").join("");

      for (const quote of quotes) {
        const needle = quote.text
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
        const haystack = fullText.toLowerCase();

        let searchFrom = 0;
        // Find all occurrences
        while (true) {
          const matchIdx = haystack.indexOf(needle, searchFrom);
          if (matchIdx === -1) break;
          searchFrom = matchIdx + needle.length;

          // Map matchIdx..matchIdx+needle.length to spans
          let charPos = 0;
          for (const span of spans) {
            const spanText = span.textContent || "";
            const spanStart = charPos;
            const spanEnd = charPos + spanText.length;

            if (spanEnd > matchIdx && spanStart < matchIdx + needle.length) {
              // This span overlaps with the match
              const el = span as HTMLElement;
              el.style.backgroundColor = quote.color;
              el.style.borderRadius = "2px";
              el.style.mixBlendMode = "multiply";
              el.dataset.highlightId = quote.id;
            }

            charPos += spanText.length;
            if (charPos > matchIdx + needle.length) break;
          }
        }
      }
    },
    [highlightQuery, intel, activeIntelId, currentPage]
  );

  // Handle text selection for creating intel
  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      // Don't interfere with the create form
      const target = e.target as HTMLElement;
      if (target.closest("[data-create-form]")) return;

      const selection = window.getSelection();
      const text = selection?.toString().trim();

      if (text && text.length > 10 && pageContainerRef.current) {
        const range = selection!.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const containerRect =
          pageContainerRef.current.getBoundingClientRect();

        setSelectedText(text);
        setSelectionPos({
          x: rect.left - containerRect.left + rect.width / 2,
          y: rect.top - containerRect.top - 8,
        });
      } else if (!showCreateForm) {
        setSelectedText("");
        setSelectionPos(null);
      }
    };

    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, [showCreateForm]);

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedText);
    setSelectedText("");
    setSelectionPos(null);
  };

  const handleOpenCreateForm = () => {
    setShowCreateForm(true);
    setCreateForm({ type: "other", summary: selectedText, urgencyScore: 3 });
  };

  const handleSaveIntel = async () => {
    if (!createForm.summary.trim()) return;
    setSaving(true);
    try {
      await fetch(`/api/companies/${companyId}/intel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: docId,
          type: createForm.type,
          summary: createForm.summary,
          sourceRef: `Page ${currentPage}`,
          sourceQuote: selectedText,
          urgencyScore: createForm.urgencyScore,
        }),
      });
      setShowCreateForm(false);
      setSelectedText("");
      setSelectionPos(null);
      fetchData();
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  };

  const scrollToIntel = (entry: IntelEntry) => {
    setActiveIntelId(entry.id);
    if (entry.sourceRef) {
      const pageMatch = entry.sourceRef.match(/(?:p(?:age)?\.?\s*)(\d+)/i);
      if (pageMatch) {
        const pageNum = parseInt(pageMatch[1]);
        if (pageNum >= 1 && pageNum <= totalPages) {
          setCurrentPage(pageNum);
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href={`/companies/${companyId}`}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {companyName}
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium truncate max-w-64">
              {doc?.title || "Document"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setScale((s) => Math.max(0.5, +(s - 0.2).toFixed(1)))}
            disabled={scale <= 0.5}
            title="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground w-12 text-center tabular-nums">
            {Math.round(scale * 100)}%
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setScale((s) => Math.min(3, +(s + 0.2).toFixed(1)))}
            disabled={scale >= 3}
            title="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>

          <div className="mx-1.5 h-5 w-px bg-border" />

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground min-w-[56px] text-center tabular-nums">
            {currentPage} / {totalPages}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Intel sidebar */}
        <div className="w-72 shrink-0 border-r border-border bg-card flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border shrink-0">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Highlighter className="h-3.5 w-3.5" />
              Intel ({intel.length})
            </h3>
            {doc?.fullSummary && (
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed line-clamp-4">
                {doc.fullSummary}
              </p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border/50">
            {intel.length === 0 && (
              <div className="p-4 text-center">
                <p className="text-xs text-muted-foreground">
                  No intel entries yet. Select text in the PDF to create one.
                </p>
              </div>
            )}
            {intel.map((entry) => (
              <button
                key={entry.id}
                className={`w-full text-left p-3 hover:bg-muted/50 transition-colors ${
                  activeIntelId === entry.id
                    ? "bg-primary/5 border-l-2 border-l-primary"
                    : "border-l-2 border-l-transparent"
                }`}
                onClick={() => scrollToIntel(entry)}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      INTEL_TYPE_COLORS[entry.type] || INTEL_TYPE_COLORS.other
                    }`}
                  >
                    {INTEL_TYPE_LABELS[entry.type] || entry.type}
                  </span>
                  {entry.sourceRef && (
                    <span className="text-[10px] text-muted-foreground">
                      {entry.sourceRef}
                    </span>
                  )}
                </div>
                <p className="text-xs text-foreground line-clamp-3 leading-relaxed">
                  {entry.summary}
                </p>
                {entry.sourceQuote && (
                  <p className="mt-1 text-[10px] text-muted-foreground italic line-clamp-2">
                    &ldquo;{entry.sourceQuote}&rdquo;
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* PDF viewer area */}
        <div className="flex-1 overflow-auto bg-muted/30 relative">
          <div className="flex justify-center py-6 min-h-full">
            <div ref={pageContainerRef} className="relative shadow-lg bg-white">
              {rendering && !pdfDoc && (
                <div className="flex items-center justify-center p-20">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
            </div>

            {/* Selection popup */}
            {selectedText && selectionPos && !showCreateForm && (
              <div
                className="fixed z-50 flex items-center gap-1 rounded-lg border border-border bg-card shadow-lg p-1"
                style={{
                  left: `${selectionPos.x + (pageContainerRef.current?.getBoundingClientRect().left || 0)}px`,
                  top: `${selectionPos.y + (pageContainerRef.current?.getBoundingClientRect().top || 0)}px`,
                  transform: "translate(-50%, -100%)",
                }}
              >
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 text-xs"
                  onClick={handleOpenCreateForm}
                >
                  <Plus className="h-3 w-3" /> Create Intel
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 text-xs"
                  onClick={handleCopy}
                >
                  <Copy className="h-3 w-3" /> Copy
                </Button>
              </div>
            )}

            {/* Create intel form */}
            {showCreateForm && (
              <div
                data-create-form
                className="fixed z-50 w-80 rounded-xl border border-border bg-card shadow-2xl p-4 space-y-3"
                style={{
                  left: `${(selectionPos?.x || 200) + (pageContainerRef.current?.getBoundingClientRect().left || 0)}px`,
                  top: `${(selectionPos?.y || 100) + (pageContainerRef.current?.getBoundingClientRect().top || 0) + 30}px`,
                  transform: "translateX(-50%)",
                }}
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">Create Intel</h4>
                  <button
                    onClick={() => {
                      setShowCreateForm(false);
                      setSelectedText("");
                      setSelectionPos(null);
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {selectedText && (
                  <div className="rounded-md bg-yellow-500/10 border border-yellow-500/20 px-3 py-2">
                    <p className="text-[11px] text-muted-foreground italic line-clamp-3">
                      &ldquo;{selectedText}&rdquo;
                    </p>
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Type
                  </label>
                  <select
                    className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
                    value={createForm.type}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, type: e.target.value })
                    }
                  >
                    {INTEL_TYPES.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Summary
                  </label>
                  <textarea
                    className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm resize-none"
                    rows={3}
                    value={createForm.summary}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, summary: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Urgency (1-5)
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="range"
                      min={1}
                      max={5}
                      value={createForm.urgencyScore}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          urgencyScore: parseInt(e.target.value),
                        })
                      }
                      className="flex-1"
                    />
                    <span className="text-sm font-medium w-5 text-center">
                      {createForm.urgencyScore}
                    </span>
                  </div>
                </div>

                <Button
                  size="sm"
                  className="w-full gap-1.5"
                  onClick={handleSaveIntel}
                  disabled={saving || !createForm.summary.trim()}
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  Save Intel
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
