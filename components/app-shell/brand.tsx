import { cn } from "@/lib/utils";

export function Brand({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)} aria-label="DealerFlow home">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary shadow-sm shadow-primary/20">
        <span className="relative size-3.5" aria-hidden="true">
          <span className="absolute left-0 top-0 h-full w-1 rounded-full bg-primary-foreground" />
          <span className="absolute left-1.5 top-0 h-1 w-2 rounded-full bg-primary-foreground/90" />
          <span className="absolute left-1.5 top-1.5 h-1 w-1.5 rounded-full bg-primary-foreground/70" />
        </span>
      </span>
      {!compact && <span className="text-sm font-semibold tracking-tight">DealerFlow</span>}
    </div>
  );
}
