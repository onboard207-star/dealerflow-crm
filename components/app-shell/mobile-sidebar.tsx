"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Sidebar } from "@/components/app-shell/sidebar";
import type { NavigationGroup } from "@/components/app-shell/navigation";

export function MobileSidebar({ open, onOpenChange, navigation, activeHref, brandName, logoUrl, logoDarkUrl }: { open: boolean; onOpenChange: (open: boolean) => void; navigation?: NavigationGroup[]; activeHref?: string; brandName?: string; logoUrl?: string; logoDarkUrl?: string }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden" />
        <Dialog.Content className="fixed inset-y-0 left-0 z-50 w-[min(20rem,calc(100vw-2rem))] shadow-2xl outline-none lg:hidden">
          <Dialog.Title className="sr-only">Navigation</Dialog.Title>
          <Dialog.Description className="sr-only">DealerFlow primary navigation menu</Dialog.Description>
          <Sidebar navigation={navigation} activeHref={activeHref} brandName={brandName} logoUrl={logoUrl} logoDarkUrl={logoDarkUrl} onClose={() => onOpenChange(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
