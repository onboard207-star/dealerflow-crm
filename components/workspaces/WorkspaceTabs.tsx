import Link from "next/link";

import { cn } from "@/lib/utils";

export interface WorkspaceTab {
  href?: string;
  label: string;
}

export function WorkspaceTabs({ activeHref, label, tabs }: { activeHref: string; label: string; tabs: readonly WorkspaceTab[] }) {
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 rounded-xl border bg-card p-1" role="list">
        {tabs.map((tab) => {
          const active = Boolean(tab.href) && tab.href === activeHref;
          return (
            <li key={`${tab.label}:${tab.href ?? "planned"}`}>
              {tab.href ? <Link
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-ring inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  active && "bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground",
                )}
                href={tab.href}
              >
                {tab.label}
              </Link> : <span aria-disabled="true" className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground/60">{tab.label}<span className="sr-only"> (planned)</span></span>}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
