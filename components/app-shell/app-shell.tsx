"use client";

import * as React from "react";
import { CommandPalette } from "@/components/command-palette";
import { MobileSidebar } from "@/components/app-shell/mobile-sidebar";
import { Sidebar } from "@/components/app-shell/sidebar";
import { TopNavigation } from "@/components/app-shell/top-navigation";
import type { NavigationGroup } from "@/components/app-shell/navigation";
import { createOrganizationNavigation } from "@/components/app-shell/navigation";
import type { BreadcrumbItem } from "@/components/breadcrumbs";
import type { UserIdentity } from "@/components/app-shell/user-menu";
import { cn } from "@/lib/utils";
import type { Capability } from "@/lib/platform/auth";
import { useTenantRuntime } from "@/components/app-shell/tenant-runtime";

export interface AppShellProps {
  children: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  user?: UserIdentity;
  navigation?: NavigationGroup[];
  activeHref?: string;
  contentClassName?: string;
  organizationId?: string;
  navigationCapabilities?: readonly Capability[];
  brandName?: string;
}

const defaultUser: UserIdentity = { name: "Account", email: "Workspace member", initials: "DF" };

export function AppShell({ children, breadcrumbs = [{ label: "DealerFlow" }, { label: "Workspace" }], user = defaultUser, navigation, activeHref, contentClassName, organizationId, navigationCapabilities, brandName }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [commandOpen, setCommandOpen] = React.useState(false);
  const tenantRuntime = useTenantRuntime();

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setCommandOpen((value) => !value); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const resolvedBrandName = brandName ?? tenantRuntime?.productName;
  const resolvedNavigation = navigation ?? (organizationId ? createOrganizationNavigation(organizationId, navigationCapabilities, tenantRuntime?.features) : undefined);

  return (
    <div className="min-h-dvh bg-background">
      <Sidebar navigation={resolvedNavigation} activeHref={activeHref} brandName={resolvedBrandName} logoUrl={tenantRuntime?.logoUrl} logoDarkUrl={tenantRuntime?.logoDarkUrl} className="fixed inset-y-0 left-0 z-40 hidden lg:flex" />
      <MobileSidebar open={mobileOpen} onOpenChange={setMobileOpen} navigation={resolvedNavigation} activeHref={activeHref} brandName={resolvedBrandName} logoUrl={tenantRuntime?.logoUrl} logoDarkUrl={tenantRuntime?.logoDarkUrl} />
      <div className="min-w-0 lg:pl-64">
        <TopNavigation breadcrumbs={breadcrumbs} user={user} onMenuOpen={() => setMobileOpen(true)} onSearchOpen={() => setCommandOpen(true)} organizationId={organizationId} />
        <main id="main-content" className={cn("min-h-[calc(100dvh-4rem)] p-4 sm:p-6 lg:p-8", contentClassName)}>{children}</main>
      </div>
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} navigation={resolvedNavigation} organizationId={organizationId} />
    </div>
  );
}
