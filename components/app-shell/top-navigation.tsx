"use client";

import type { RefObject } from "react";
import { Menu } from "lucide-react";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/breadcrumbs";
import { GlobalSearch } from "@/components/global-search";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { UserMenu, type UserIdentity } from "@/components/app-shell/user-menu";
import { NotificationMenu } from "@/components/app-shell/notification-menu";

export function TopNavigation({ breadcrumbs, user, onMenuOpen, onSearchOpen, organizationId, menuButtonRef }: { breadcrumbs: BreadcrumbItem[]; user: UserIdentity; onMenuOpen: () => void; onSearchOpen: () => void; organizationId?: string; menuButtonRef: RefObject<HTMLButtonElement | null> }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur-xl sm:px-6">
      <Button ref={menuButtonRef} variant="ghost" size="icon" onClick={onMenuOpen} className="lg:hidden" aria-label="Open navigation"><Menu className="size-5" /></Button>
      <Breadcrumbs items={breadcrumbs} className="hidden min-w-0 flex-1 md:block" />
      <GlobalSearch onOpen={onSearchOpen} className="mx-auto max-w-md flex-1 md:mx-0 md:flex-none md:basis-72 xl:basis-96" />
      <div className="ml-auto flex items-center gap-1">
        <NotificationMenu organizationId={organizationId}/>
        <ThemeToggle />
        <div className="mx-1 hidden h-5 w-px bg-border sm:block" />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
