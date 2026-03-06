"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, Check, X } from "lucide-react";
import { useToast } from "@/components/ui/toast";

interface Invite {
  id: string;
  companyId: string;
  companyName: string;
  invitedBy: string | null;
  role: string;
  invitedAt: string;
}

export default function InvitesPage() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchInvites = useCallback(async () => {
    try {
      const res = await fetch("/api/collaborator-invites");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setInvites(data);
    } catch {
      setInvites([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

  const handleAccept = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/collaborator-invites/${id}/accept`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Failed to accept", "error");
        return;
      }
      toast("Invite accepted", "success");
      fetchInvites();
      if (data.companyId) {
        window.location.href = `/companies/${data.companyId}/account`;
      }
    } catch {
      toast("Failed to accept invite", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/collaborator-invites/${id}/decline`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        toast(data.error || "Failed to decline", "error");
        return;
      }
      toast("Invite declined", "success");
      fetchInvites();
    } catch {
      toast("Failed to decline invite", "error");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mb-4 h-8 w-8 animate-spin" />
        <p className="text-sm font-medium">Loading invites...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl animate-fade-in">
      <div className="mb-6">
        <Link
          href="/settings"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to Settings
        </Link>
      </div>

      <h1 className="text-xl font-semibold mb-2">Collaborator invites</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Accept or decline invitations to collaborate on accounts.
      </p>

      {invites.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Mail className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-sm text-muted-foreground">
            No pending invites.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {invites.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center justify-between rounded-xl border border-border bg-card p-4"
            >
              <div>
                <p className="font-medium">{inv.companyName}</p>
                <p className="text-sm text-muted-foreground">
                  {inv.invitedBy
                    ? `Invited by ${inv.invitedBy}`
                    : "Collaboration invite"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDecline(inv.id)}
                  disabled={actionLoading === inv.id}
                >
                  {actionLoading === inv.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleAccept(inv.id)}
                  disabled={actionLoading === inv.id}
                >
                  {actionLoading === inv.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      Accept
                    </>
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
