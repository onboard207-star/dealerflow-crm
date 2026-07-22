"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Search } from "lucide-react";

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm data-[state=closed]:animate-out data-[state=open]:animate-in" />
        <Dialog.Content className="fixed left-1/2 top-[18%] z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-2xl focus:outline-none">
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <Dialog.Description className="sr-only">Search and quickly access DealerFlow commands.</Dialog.Description>
          <div className="flex items-center gap-3 border-b px-4">
            <Search className="size-4 text-muted-foreground" aria-hidden="true" />
            <input autoFocus className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" placeholder="Search commands…" aria-label="Search commands" />
            <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">ESC</kbd>
          </div>
          <div className="flex min-h-40 items-center justify-center p-6 text-sm text-muted-foreground">Command actions will appear here.</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
