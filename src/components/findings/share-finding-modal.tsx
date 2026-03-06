"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Plus, X } from "lucide-react";
import { useToast } from "@/components/ui/toast";

interface ShareFindingModalProps {
  findingId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ShareFindingModal({
  findingId,
  open,
  onClose,
  onSuccess,
}: ShareFindingModalProps) {
  const [emails, setEmails] = useState<string[]>([]);
  const [currentEmail, setCurrentEmail] = useState("");
  const [shareType, setShareType] = useState<"actionable" | "fyi" | "handoff">("fyi");
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<{ id: string; email: string | null }[]>([]);
  const [searching, setSearching] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) {
      setEmails([]);
      setCurrentEmail("");
      setSearchResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (!open || currentEmail.length < 3) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(currentEmail)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.filter((u: { email: string | null }) => u.email && !emails.includes(u.email)));
        }
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [currentEmail, open, emails]);

  const addEmail = (email: string) => {
    const e = email.trim().toLowerCase();
    if (e && !emails.includes(e)) {
      setEmails([...emails, e]);
      setCurrentEmail("");
      setSearchResults([]);
    }
  };

  const removeEmail = (email: string) => {
    setEmails(emails.filter((e) => e !== email));
  };

  const handleShare = async () => {
    if (emails.length === 0) {
      toast("Add at least one email", "error");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/findings/${findingId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails, shareType }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Failed to share", "error");
        return;
      }
      if (data.notFound?.length > 0) {
        toast(`Shared with ${data.shared.length}. Not found: ${data.notFound.join(", ")}`, "info");
      } else {
        toast(`Shared with ${data.shared.length} user(s)`, "success");
      }
      onSuccess();
      onClose();
    } catch {
      toast("Failed to share finding", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share finding</DialogTitle>
          <DialogDescription>
            Share this finding with teammates. They must have an account.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Share with</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type="email"
                  placeholder="Search by email..."
                  value={currentEmail}
                  onChange={(e) => setCurrentEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (currentEmail.includes("@")) addEmail(currentEmail);
                    }
                  }}
                />
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border border-border bg-card shadow-lg z-10 max-h-32 overflow-y-auto">
                    {searchResults.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => u.email && addEmail(u.email)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                      >
                        {u.email}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => currentEmail.includes("@") && addEmail(currentEmail)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {searching && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Searching...
              </p>
            )}
            {emails.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {emails.map((e) => (
                  <span
                    key={e}
                    className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs"
                  >
                    {e}
                    <button
                      type="button"
                      onClick={() => removeEmail(e)}
                      className="hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Share type</label>
            <select
              value={shareType}
              onChange={(e) => setShareType(e.target.value as "actionable" | "fyi" | "handoff")}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="fyi">FYI</option>
              <option value="actionable">Actionable</option>
              <option value="handoff">Handoff</option>
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleShare} disabled={emails.length === 0 || loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Share"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
