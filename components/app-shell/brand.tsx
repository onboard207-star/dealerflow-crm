import Image from "next/image";
import { cn } from "@/lib/utils";

const tenantAssetLoader = ({ src }: { src: string }) => src;

export function Brand({ compact = false, className, name = "DealerFlow", logoUrl, logoDarkUrl }: { compact?: boolean; className?: string; name?: string; logoUrl?: string; logoDarkUrl?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)} aria-label={`${name} home`}>
      {logoUrl ? <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-background"><Image alt="" className={logoDarkUrl ? "size-full object-contain dark:hidden" : "size-full object-contain"} height={32} loader={tenantAssetLoader} src={logoUrl} unoptimized width={32} />{logoDarkUrl ? <Image alt="" className="hidden size-full object-contain dark:block" height={32} loader={tenantAssetLoader} src={logoDarkUrl} unoptimized width={32} /> : null}</span> : <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary shadow-sm shadow-primary/20">
        <span className="relative size-3.5" aria-hidden="true">
          <span className="absolute left-0 top-0 h-full w-1 rounded-full bg-primary-foreground" />
          <span className="absolute left-1.5 top-0 h-1 w-2 rounded-full bg-primary-foreground/90" />
          <span className="absolute left-1.5 top-1.5 h-1 w-1.5 rounded-full bg-primary-foreground/70" />
        </span>
      </span>}
      {!compact && <span className="truncate text-sm font-semibold tracking-tight">{name}</span>}
    </div>
  );
}
