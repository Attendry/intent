"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRightLeft, X } from "lucide-react";

export function HandoffsBanner() {
  const [handoffs, setHandoffs] = useState<
    { id: string; companyId: string; companyName: string }[]
  >([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch("/api/handoffs")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setHandoffs(Array.isArray(data) ? data : []))
      .catch(() => setHandoffs([]));
  }, []);

  if (handoffs.length === 0 || dismissed) return null;

  return (
    <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <ArrowRightLeft className="h-5 w-5 text-amber-600" />
        <span className="text-sm font-medium">
          You have {handoffs.length} pending account handoff
          {handoffs.length > 1 ? "s" : ""}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Link href="/handoffs">
          <Button size="sm" variant="outline">
            View handoffs
          </Button>
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
