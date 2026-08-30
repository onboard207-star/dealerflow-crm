import type { LucideIcon } from "lucide-react";
import { BarChart3, BookOpen, Building2, CarFront, CircleDollarSign, Globe2, LayoutDashboard, MapPinned, MessageSquareWarning, PanelsTopLeft, Plug, Settings, Share2, ShieldAlert, ShieldCheck, Sparkles, UserCog, UserRoundSearch, Users } from "lucide-react";
import type { Capability } from "@/lib/platform/auth";
import { isCapabilityEntitled, type TenantFeatures } from "@/lib/platform/tenant";

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
  { label: "Workspace", items: [{ label: "Product entry", href: "/", icon: LayoutDashboard }, { label: "Customer workspace demo", href: "/demo/customer-workspace", icon: Users }] },
];

export function createOrganizationNavigation(organizationId: string, capabilities?: readonly Capability[], features?: TenantFeatures): NavigationGroup[] {
  const base = `/organizations/${organizationId}`;
  const allowed = (capability: Capability) => {
    return isCapabilityEntitled(capability, features) && (!capabilities || capabilities.includes(capability));
  };
  return [{
    label: "Dealership",
    items: [
      { label: "Overview", href: `${base}/workspace`, icon: LayoutDashboard },
      ...(features?.ai !== false && capabilities?.length ? [{ label: "DealerFlow AI", href: `${base}/ai`, icon: Sparkles }] : []),
      ...(capabilities?.includes("customer.read") ? [{ label: "Training Center", href: `${base}/training`, icon: BookOpen }] : []),
      ...(allowed("lead.read") ? [{ label: "Leads", href: `${base}/leads`, icon: Users }] : []),
      ...(allowed("customer.read") ? [{ label: "Customers", href: `${base}/customers`, icon: UserRoundSearch }] : []),
      ...(allowed("inventory.read") ? [{ label: "Inventory", href: `${base}/inventory`, icon: CarFront }] : []),
      ...(allowed("deal.read") ? [{ label: "Deals", href: `${base}/deals`, icon: CircleDollarSign }] : []),
      ...(allowed("deal.read") ? [{ label: "Deal Desking", href: `${base}/desking`, icon: PanelsTopLeft }] : []),
      ...(allowed("reports.view") ? [{ label: "Reports", href: `${base}/reports`, icon: BarChart3 }] : []),
      ...(allowed("reports.view") ? [{ label: "Command Center", href: `${base}/operations/command-center`, icon: ShieldAlert }] : []),
      ...(allowed("reports.view") ? [{ label: "Website Analytics", href: `${base}/analytics`, icon: Globe2 }] : []),
      ...(allowed("reports.view") ? [{ label: "Social Media", href: `${base}/social`, icon: Share2 }] : []),
      ...(allowed("staff.manage") ? [{ label: "Team", href: `${base}/settings/team`, icon: UserCog }] : []),
      ...(allowed("staff.manage") && allowed("organization.configure") ? [{ label: "Roles", href: `${base}/settings/roles`, icon: ShieldCheck }] : []),
      ...(allowed("organization.configure") ? [{ label: "Integrations", href: `${base}/settings/integrations`, icon: Plug }] : []),
      ...(allowed("organization.configure") ? [{ label: "Configuration", href: `${base}/settings/configuration`, icon: Settings }] : []),
      ...(allowed("organization.configure") ? [{ label: "Administration", href: `${base}/settings/administration`, icon: Building2 }] : []),
      ...(allowed("organization.configure") ? [{ label: "Locations", href: `${base}/settings/locations`, icon: MapPinned }] : []),
      ...(allowed("organization.configure") && allowed("communication.read") ? [{ label: "Messaging Ops", href: `${base}/operations/messages`, icon: MessageSquareWarning }] : []),
      { label: "Switch workspace", href: "/select-organization", icon: Building2 },
    ],
  }];
}
