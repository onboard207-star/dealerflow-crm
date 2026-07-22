import Link from "next/link";
import { ChevronRight, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem { label: string; href?: string }

export function Breadcrumbs({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0", className)}>
      <ol className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
        {items.map((item, index) => {
          const current = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1">
              {index > 0 && <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />}
              {index === 0 && items.length > 2 ? <MoreHorizontal className="size-4 sm:hidden" aria-label="More levels" /> : null}
              <span className={cn(index === 0 && items.length > 2 && "hidden sm:inline", current && "truncate font-medium text-foreground")}>
                {item.href && !current ? <Link href={item.href} className="focus-ring rounded-sm transition-colors hover:text-foreground">{item.label}</Link> : item.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
