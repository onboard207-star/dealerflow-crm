"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronsUpDown, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { authClient } from "@/lib/client/auth";

export interface UserIdentity { name: string; email: string; image?: string; initials?: string }

export function UserMenu({ user }: { user: UserIdentity }) {
  const router = useRouter();

  async function signOut() {
    await authClient.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="focus-ring flex items-center gap-2 rounded-lg p-1.5 text-left transition-colors hover:bg-muted" aria-label="Open user menu">
        <Avatar><AvatarImage src={user.image} alt="" /><AvatarFallback>{user.initials ?? user.name.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
        <span className="hidden max-w-32 sm:block"><span className="block truncate text-xs font-medium">{user.name}</span><span className="block truncate text-[11px] text-muted-foreground">{user.email}</span></span>
        <ChevronsUpDown className="hidden size-3.5 text-muted-foreground sm:block" aria-hidden="true" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className="z-50 min-w-56 rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-soft">
          <div className="px-2 py-2"><p className="text-sm font-medium">{user.name}</p><p className="truncate text-xs text-muted-foreground">{user.email}</p></div>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item onSelect={() => void signOut()} className="flex cursor-default select-none items-center gap-2 rounded-lg px-2 py-2 text-sm outline-none data-[highlighted]:bg-accent"><LogOut className="size-4" aria-hidden="true" />Sign out</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
