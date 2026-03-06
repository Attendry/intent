export function getInitials(first: string, last: string): string {
  return `${first[0] || ""}${last[0] || ""}`.toUpperCase();
}

export function formatLastContacted(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const diffDays = Math.floor(
    (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatDaysAgo(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const d = new Date(dateStr);
  const diff = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return `${diff}d ago`;
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function formatUpcomingDateKey(dateKey: string): string {
  const d = new Date(dateKey + "T12:00:00");
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

export function formatScheduledAt(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (isToday) {
    return `Today ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  }
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Returns a Tailwind bg color class based on how recently something was synthesized.
 * Green (<7d), Yellow (7-30d), Red (>30d or never).
 */
export function freshnessColor(lastSynthesized: string | null): string {
  if (!lastSynthesized) return "bg-red-500";
  const days = Math.floor(
    (Date.now() - new Date(lastSynthesized).getTime()) / 86400000
  );
  if (days < 7) return "bg-green-500";
  if (days <= 30) return "bg-yellow-500";
  return "bg-red-500";
}

export function scoreColor(score: number | null): string {
  if (score === null || score === undefined) return "text-muted-foreground";
  if (score >= 70) return "text-green-600 dark:text-green-400";
  if (score >= 40) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}
