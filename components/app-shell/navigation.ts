import type { LucideIcon } from "lucide-react";
import { Boxes, Building2, CircleHelp, LayoutDashboard, Settings, Users } from "lucide-react";

export interface NavigationItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}

export const defaultNavigation: NavigationGroup[] = [
  { label: "Workspace", items: [{ label: "Overview", href: "#", icon: LayoutDashboard }, { label: "Organization", href: "#", icon: Building2 }, { label: "Team", href: "#", icon: Users }] },
  { label: "System", items: [{ label: "Components", href: "#", icon: Boxes }, { label: "Settings", href: "#", icon: Settings }] },
];

export const supportNavigation: NavigationItem = { label: "Help & support", href: "#", icon: CircleHelp };
