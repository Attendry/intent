import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
      <Loader2 className="mb-4 h-8 w-8 animate-spin" />
      <p className="text-sm font-medium">Loading...</p>
    </div>
  );
}
