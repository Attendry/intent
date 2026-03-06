"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  UserPlus,
  Loader2,
  Trash2,
  Mail,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

interface Collaborator {
  id: string;
  userId: string;
  email: string | null;
  role: string;
  invitedBy: string | null;
  invitedAt: string;
  acceptedAt: string | null;
  status: string;
}

interface CollaboratorsSectionProps {
  companyId: string;
  companyName: string;
  access: "owner" | "collaborator";
  collaborators: Collaborator[];
  onUpdate: () => void;
}

export function CollaboratorsSection({
  companyId,
  companyName,
  access,
  collaborators,
  onUpdate,
}: CollaboratorsSectionProps) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [removeLoading, setRemoveLoading] = useState<string | null>(null);
  const { toast } = useToast();

  const handleInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    setInviteLoading(true);
    try {
      const res = await fetch(`/api/companies/${companyId}/collaborators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Failed to invite", "error");
        return;
      }
      toast(`Invite sent to ${email}`, "success");
      setInviteEmail("");
      setInviteOpen(false);
      onUpdate();
    } catch {
      toast("Failed to send invite", "error");
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRemove = async (userId: string) => {
    setRemoveLoading(userId);
    try {
      const res = await fetch(
        `/api/companies/${companyId}/collaborators/${userId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json();
        toast(data.error || "Failed to remove", "error");
        return;
      }
      toast("Collaborator removed", "success");
      onUpdate();
    } catch {
      toast("Failed to remove collaborator", "error");
    } finally {
      setRemoveLoading(null);
    }
  };

  return (
    <div className="mb-6 rounded-xl border border-border bg-card overflow-hidden">
      <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <UserPlus className="h-4 w-4" />
          Collaborators
        </h2>
        {access === "owner" && (
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            Invite
          </Button>
        )}
      </div>
      <div className="p-4">
        {collaborators.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {access === "owner"
              ? "Invite teammates to collaborate on this account."
              : "No other collaborators on this account."}
          </p>
        ) : (
          <div className="space-y-2">
            {collaborators.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 p-3 text-sm"
              >
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{c.email || "Unknown"}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {c.status === "pending" ? "Pending" : c.role}
                  </Badge>
                  {c.status === "pending" && (
                    <span className="text-xs text-muted-foreground">
                      invited by {c.invitedBy}
                    </span>
                  )}
                </div>
                {access === "owner" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleRemove(c.userId)}
                    disabled={removeLoading === c.userId}
                  >
                    {removeLoading === c.userId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite collaborator</DialogTitle>
            <DialogDescription>
              Invite a teammate to collaborate on {companyName}. They must already
              have an account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Email</label>
              <Input
                type="email"
                placeholder="teammate@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInvite()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleInvite}
              disabled={!inviteEmail.trim() || inviteLoading}
            >
              {inviteLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Send invite"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
