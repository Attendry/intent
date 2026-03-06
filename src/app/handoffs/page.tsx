"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Loader2, Check, X, ArrowRightLeft } from "lucide-react";
import { useToast } from "@/components/ui/toast";

interface Handoff {
  id: string;
  companyId: string;
  companyName: string;
  fromUserEmail: string | null;
  handoffNotes: string | null;
  requestedAt: string;
}

export default function HandoffsPage() {
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchHandoffs = useCallback(async () => {
    try {
      const res = await fetch("/api/handoffs");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setHandoffs(data);
    } catch {
      setHandoffs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHandoffs();
  }, [fetchHandoffs]);

  const handleAccept = async (h: Handoff) => {
    setActionLoading(h.id);
    try {
      const res = await fetch(
        `/api/companies/${h.companyId}/handoff/${h.id}/accept`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Failed to accept", "error");
        return;
      }
      toast("Handoff accepted. You now own this account.", "success");
      fetchHandoffs();
      window.location.href = `/companies/${h.companyId}/account`;
    } catch {
      toast("Failed to accept handoff", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async (h: Handoff) => {
    setActionLoading(h.id);
    try {
      const res = await fetch(
        `/api/companies/${h.companyId}/handoff/${h.id}/decline`,
        { method: "POST" }
      );
      if (!res.ok) {
        const data = await res.json();
        toast(data.error || "Failed to decline", "error");
        return;
      }
      toast("Handoff declined", "success");
      fetchHandoffs();
    } catch {
      toast("Failed to decline handoff", "error");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mb-4 h-8 w-8 animate-spin" />
        <p className="text-sm font-medium">Loading handoffs...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl animate-fade-in">
      <div className="mb-6">
        <Link
          href="/companies"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to Companies
        </Link>
      </div>

      <h1 className="text-xl font-semibold mb-2">Account handoffs</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Accept or decline account transfer requests.
      </p>

      {handoffs.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <ArrowRightLeft className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-sm text-muted-foreground">No pending handoffs.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {handoffs.map((h) => (
            <div
              key={h.id}
              className="flex items-center justify-between rounded-xl border border-border bg-card p-4"
            >
              <div>
                <p className="font-medium">{h.companyName}</p>
                <p className="text-sm text-muted-foreground">
                  {h.fromUserEmail
                    ? `From ${h.fromUserEmail}`
                    : "Account transfer request"}
                </p>
                {h.handoffNotes && (
                  <p className="text-sm text-muted-foreground mt-1 italic">
                    {h.handoffNotes}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDecline(h)}
                  disabled={actionLoading === h.id}
                >
                  {actionLoading === h.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleAccept(h)}
                  disabled={actionLoading === h.id}
                >
                  {actionLoading === h.id ? (
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
