import { Loader2 } from "lucide-react";

export default function SocialPostsLoading() {
  return (
    <div className="mx-auto max-w-6xl animate-fade-in">
      <div className="mb-8">
        <div className="h-9 w-48 animate-pulse rounded-md bg-muted" />
        <div className="mt-2 h-4 w-64 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mb-4 h-8 w-8 animate-spin" />
        <p className="text-sm font-medium">Loading...</p>
      </div>
    </div>
  );
}
