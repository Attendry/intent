"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

const SEGMENT_LABELS: Record<string, string> = {
  prospects: "Prospects",
  companies: "Companies",
  content: "Content",
  suggestions: "Suggestions",
  "my-company": "My Company",
  "fit-overview": "Fit Overview",
  review: "Weekly Review",
  settings: "Settings",
  import: "Import",
  documents: "Documents",
  capture: "Capture",
};

export default function Breadcrumbs({
  items,
  className,
}: {
  items?: BreadcrumbItem[];
  className?: string;
}) {
  const pathname = usePathname();

  const segments = items ?? (() => {
    const parts = pathname.split("/").filter(Boolean);
    const result: BreadcrumbItem[] = [];
    let href = "";
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      href += `/${part}`;
      const label = SEGMENT_LABELS[part] ?? (part.length === 24 || part.match(/^[a-f0-9-]{36}$/i) ? "Detail" : part.replace(/-/g, " "));
      result.push({ label, href: i < parts.length - 1 ? href : undefined });
    }
    return result;
  })();

  if (segments.length <= 1) return null;

  return (
    <nav className={cn("flex items-center gap-1.5 text-sm text-muted-foreground", className)}>
      {segments.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" />}
          {item.href ? (
            <Link href={item.href} className="hover:text-foreground transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="font-medium text-foreground">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
