import Link from "next/link";
import { PanelLeftClose } from "lucide-react";
import { Brand } from "@/components/app-shell/brand";
import { defaultNavigation, type NavigationGroup } from "@/components/app-shell/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SidebarProps {
  navigation?: NavigationGroup[];
  activeHref?: string;
  onClose?: () => void;
  className?: string;
  brandName?: string;
  logoUrl?: string;
  logoDarkUrl?: string;
}

export function Sidebar({ navigation = defaultNavigation, activeHref = "#", onClose, className, brandName, logoUrl, logoDarkUrl }: SidebarProps) {
  return (
    <aside className={cn("flex h-full w-64 flex-col border-r bg-card/80 backdrop-blur-xl", className)} aria-label="Primary navigation">
      <div className="flex h-16 items-center justify-between px-4">
        <Brand name={brandName} logoUrl={logoUrl} logoDarkUrl={logoDarkUrl} />
        {onClose && <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close navigation"><PanelLeftClose className="size-4" /></Button>}
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {navigation.map((group) => (
          <div key={group.label} className="mb-6">
            <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">{group.label}</p>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const active = activeHref === item.href && item.href !== "#";
                return <li key={item.label}><Link href={item.href} aria-current={active ? "page" : undefined} className={cn("focus-ring flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground", active && "bg-accent text-accent-foreground")}><item.icon className="size-4" aria-hidden="true" /><span>{item.label}</span></Link></li>;
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
