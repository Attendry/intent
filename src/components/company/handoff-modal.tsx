"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, ArrowRightLeft } from "lucide-react";
import { useToast } from "@/components/ui/toast";

interface HandoffModalProps {
  companyId: string;
  companyName: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function HandoffModal({
  companyId,
  companyName,
  open,
  onClose,
  onSuccess,
}: HandoffModalProps) {
  const [toUserEmail, setToUserEmail] = useState("");
  const [handoffNotes, setHandoffNotes] = useState("");
  const [checklist, setChecklist] = useState({
    keyContacts: false,
    lastTouch: false,
    openQuestions: false,
    nextSteps: false,
  });
  const [userResults, setUserResults] = useState<{ id: string; email: string | null }[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setToUserEmail("");
      setHandoffNotes("");
      setChecklist({
        keyContacts: false,
        lastTouch: false,
        openQuestions: false,
        nextSteps: false,
      });
      setUserResults([]);
      setSelectedUserId(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || toUserEmail.length < 3) {
      setUserResults([]);
      setSelectedUserId(null);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(toUserEmail)}`);
        if (res.ok) {
          const data = await res.json();
          setUserResults(data);
          if (data.length === 1) setSelectedUserId(data[0].id);
          else setSelectedUserId(null);
        } else {
          setUserResults([]);
          setSelectedUserId(null);
        }
      } catch {
        setUserResults([]);
        setSelectedUserId(null);
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [toUserEmail, open]);

  const handleTransfer = async () => {
    const userId = selectedUserId || (userResults[0]?.id);
    if (!userId) {
      toast("Select a user to transfer to", "error");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/companies/${companyId}/handoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toUserId: userId,
          checklist,
          handoffNotes: handoffNotes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Failed to request handoff", "error");
        return;
      }
      toast("Handoff requested. They'll need to accept.", "success");
      onSuccess();
      onClose();
    } catch {
      toast("Failed to request handoff", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Transfer account
          </DialogTitle>
          <DialogDescription>
            Transfer ownership of {companyName} to another user. They must accept
            the handoff.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Transfer to</label>
            <Input
              type="email"
              placeholder="Search by email..."
              value={toUserEmail}
              onChange={(e) => setToUserEmail(e.target.value)}
            />
            {searching && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Searching...
              </p>
            )}
            {userResults.length > 0 && (
              <div className="mt-2 space-y-1 max-h-24 overflow-y-auto">
                {userResults.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setSelectedUserId(u.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                      selectedUserId === u.id
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted"
                    }`}
                  >
                    {u.email}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Checklist</label>
            <div className="space-y-2">
              {[
                { key: "keyContacts", label: "Key contacts documented" },
                { key: "lastTouch", label: "Last touch / next steps captured" },
                { key: "openQuestions", label: "Open questions noted" },
                { key: "nextSteps", label: "Export attached or available" },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={checklist[key as keyof typeof checklist]}
                    onChange={(e) =>
                      setChecklist((c) => ({ ...c, [key]: e.target.checked }))
                    }
                    className="rounded"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">
              Handoff notes (optional)
            </label>
            <Textarea
              placeholder="Context for the new owner..."
              value={handoffNotes}
              onChange={(e) => setHandoffNotes(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={
              loading ||
              (!selectedUserId && userResults.length === 0) ||
              (toUserEmail.length >= 3 && userResults.length === 0)
            }
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Request handoff"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
