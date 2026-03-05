"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { CONTENT_TYPE_LABELS, CONTENT_STAGE_LABELS } from "@/lib/constants";
import { parseJsonArray } from "@/lib/json";
import { cn } from "@/lib/utils";
import {
  Search,
  Plus,
  Loader2,
  Trash2,
  Pencil,
  Sparkles,
  ExternalLink,
  FileText,
  AlertCircle,
} from "lucide-react";

interface ContentItem {
  id: string;
  title: string;
  type: string;
  stage: string | null;
  url: string | null;
  body: string | null;
  summary: string | null;
  tags: string | null;
  personaFit: string | null;
  useCaseFit: string | null;
  timesUsed: number;
  createdAt: string;
  updatedAt: string;
}

const FILTER_TYPES = [
  { value: "all", label: "All" },
  { value: "case_study", label: "Case Study" },
  { value: "blog", label: "Blog" },
  { value: "whitepaper", label: "Whitepaper" },
  { value: "video", label: "Video" },
  { value: "competitive", label: "Competitive" },
  { value: "other", label: "Other" },
] as const;

type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "signal"
  | "urgent"
  | "warm"
  | "success";

const TYPE_BADGE_VARIANT: Record<string, BadgeVariant> = {
  case_study: "default",
  blog: "secondary",
  whitepaper: "warm",
  video: "signal",
  competitive: "urgent",
  other: "outline",
};

export default function ContentPage() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContentItem | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const [form, setForm] = useState({
    title: "",
    type: "case_study",
    stage: "",
    url: "",
    body: "",
  });

  const fetchContent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = filterType !== "all" ? `?type=${filterType}` : "";
      const res = await fetch(`/api/content${params}`);
      if (!res.ok) throw new Error("Failed to fetch content");
      const data = await res.json();
      setItems(data.data || data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load content");
    } finally {
      setLoading(false);
    }
  }, [filterType]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  const filtered = useMemo(() => items.filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.summary?.toLowerCase().includes(q) ||
      item.body?.toLowerCase().includes(q) ||
      parseJsonArray(item.tags).some((t) => t.toLowerCase().includes(q))
    );
  }), [items, search]);

  const resetForm = () => setForm({ title: "", type: "case_study", stage: "", url: "", body: "" });

  const notifyProfileStaleness = async (action: string) => {
    try {
      const res = await fetch("/api/company-profile");
      if (res.ok) {
        const data = await res.json();
        if (data.profile) {
          toast(
            `Content ${action}. Your company profile may benefit from a refresh.`,
            "info"
          );
        }
      }
    } catch {}
  };

  const handleAdd = async () => {
    if (!form.title.trim()) {
      toast("Title is required", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create content");
      }
      toast("Content added successfully", "success");
      setAddOpen(false);
      resetForm();
      fetchContent();
      notifyProfileStaleness("added");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to add content", "error");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (item: ContentItem) => {
    setEditingItem(item);
    setForm({
      title: item.title,
      type: item.type,
      stage: item.stage || "",
      url: item.url || "",
      body: item.body || "",
    });
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!editingItem || !form.title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/content/${editingItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed to update content");
      toast("Content updated", "success");
      setEditOpen(false);
      setEditingItem(null);
      resetForm();
      fetchContent();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to update", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/content/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete content");
      toast("Content deleted", "success");
      setDeleteTarget(null);
      fetchContent();
      notifyProfileStaleness("deleted");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to delete", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl animate-fade-in">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Content Library</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage reusable content for personalized outreach.
          </p>
        </div>
        <Button className="gap-2" onClick={() => { resetForm(); setAddOpen(true); }}>
          <Plus className="h-4 w-4" />
          Add Content
        </Button>
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search content..."
            className="h-10 pl-10 text-sm"
          />
        </div>

        <div className="flex gap-1 rounded-xl bg-muted/60 p-1">
          {FILTER_TYPES.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilterType(tab.value)}
              className={cn(
                "inline-flex items-center rounded-lg px-3.5 py-2 text-xs font-semibold transition-all duration-200",
                filterType === tab.value
                  ? "bg-card text-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="mb-4 h-8 w-8 animate-spin" />
          <p className="text-sm font-medium">Loading content...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-24">
          <AlertCircle className="mb-3 h-8 w-8 text-destructive" />
          <p className="mb-4 text-sm font-medium text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchContent}>
            Retry
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-muted/20 py-24">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60">
            <FileText className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            {search
              ? "No content matches your search."
              : "No content yet. Add your first piece of content to get started."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item, i) => (
            <div key={item.id} className="animate-slide-up" style={{ animationDelay: `${i * 40}ms`, animationFillMode: "both" }}>
              <ContentCard
                item={item}
                onEdit={() => openEdit(item)}
                onDelete={() => setDeleteTarget(item)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Add Content Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Content</DialogTitle>
            <DialogDescription>
              Add a new piece of content to your library.
            </DialogDescription>
          </DialogHeader>
          <ContentForm form={form} setForm={setForm} />
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Tags and persona fit will be auto-generated if an OpenAI API key is configured.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Content
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Content Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Content</DialogTitle>
            <DialogDescription>
              Update this content item.
            </DialogDescription>
          </DialogHeader>
          <ContentForm form={form} setForm={setForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Content</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{deleteTarget?.title}&rdquo;?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ContentForm({
  form,
  setForm,
}: {
  form: { title: string; type: string; stage: string; url: string; body: string };
  setForm: React.Dispatch<
    React.SetStateAction<{ title: string; type: string; stage: string; url: string; body: string }>
  >;
}) {
  return (
    <div className="flex flex-col gap-4 py-2">
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-foreground">
          Title
        </label>
        <Input
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder="e.g. Q4 ROI Case Study"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-foreground">
          Type
        </label>
        <Select
          value={form.type}
          onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
        >
          <option value="case_study">Case Study</option>
          <option value="blog">Blog</option>
          <option value="whitepaper">Whitepaper</option>
          <option value="video">Video</option>
          <option value="competitive">Competitive</option>
          <option value="other">Other</option>
        </Select>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-foreground">
          Best for stage
        </label>
        <Select
          value={form.stage || ""}
          onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value }))}
        >
          <option value="">— Any —</option>
          <option value="intro">Intro</option>
          <option value="nurture">Nurture</option>
          <option value="closing">Closing</option>
        </Select>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-foreground">
          URL
        </label>
        <Input
          value={form.url}
          onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
          placeholder="https://..."
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-foreground">
          Body / Description
        </label>
        <Textarea
          value={form.body}
          onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
          placeholder="Paste the content body or a summary..."
          rows={4}
        />
      </div>
    </div>
  );
}

function ContentCard({
  item,
  onEdit,
  onDelete,
}: {
  item: ContentItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const personaTags = parseJsonArray(item.personaFit);
  const variant = TYPE_BADGE_VARIANT[item.type] || "outline";

  return (
    <Card className="group flex flex-col hover:shadow-elevated hover:border-border transition-all duration-300">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <Badge variant={variant} className="shrink-0">
            {CONTENT_TYPE_LABELS[item.type] || item.type}
          </Badge>
          <div className="flex gap-1 opacity-0 transition-all duration-200 group-hover:opacity-100">
            <button
              onClick={onEdit}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onDelete}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <CardTitle
          className="cursor-pointer text-sm leading-snug hover:text-primary transition-colors"
          onClick={onEdit}
        >
          {item.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pb-2">
        {item.summary && (
          <p className="mb-2 line-clamp-2 text-xs text-muted-foreground leading-relaxed">
            {item.summary}
          </p>
        )}
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            View source
          </a>
        )}
        {personaTags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {personaTags.slice(0, 4).map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
                {tag}
              </Badge>
            ))}
            {personaTags.length > 4 && (
              <span className="text-[10px] text-muted-foreground">
                +{personaTags.length - 4}
              </span>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="pt-0">
        <span className="text-[11px] font-medium text-muted-foreground/70">
          Used {item.timesUsed}x total
        </span>
      </CardFooter>
    </Card>
  );
}
