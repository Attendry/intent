"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Mail, X } from "lucide-react";

export function InvitesBanner() {
  const [invites, setInvites] = useState<{ id: string; companyName: string }[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch("/api/collaborator-invites")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setInvites(Array.isArray(data) ? data : []))
      .catch(() => setInvites([]));
  }, []);

  if (invites.length === 0 || dismissed) return null;

  return (
    <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <Mail className="h-5 w-5 text-primary" />
        <span className="text-sm font-medium">
          You have {invites.length} pending collaborator invite
          {invites.length > 1 ? "s" : ""}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Link href="/settings/invites">
          <Button size="sm">View invites</Button>
        </Link>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => setDismissed(true)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
