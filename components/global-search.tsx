"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export function GlobalSearch({ onOpen, className }: { onOpen: () => void; className?: string }) {
  return (
    <button type="button" onClick={onOpen} className={cn("focus-ring group flex h-9 w-full items-center gap-2 rounded-lg border bg-muted/40 px-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted", className)} aria-label="Open global search">
      <Search className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">Search DealerFlow</span>
      <kbd className="hidden rounded border bg-background px-1.5 py-0.5 font-sans text-[10px] font-medium text-muted-foreground shadow-sm sm:inline-flex">⌘ K</kbd>
    </button>
  );
}
