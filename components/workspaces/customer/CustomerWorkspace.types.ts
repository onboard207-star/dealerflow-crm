import type { AICommandCenterProps } from "@/components/ai/AICommandCenter.types";
import type { CustomerHeaderProps } from "@/components/customer/CustomerHeader.types";
import type { CustomerSnapshotProps } from "@/components/customer/CustomerSnapshot.types";
import type { TimelineEntry } from "@/lib/server/customers";
import type { ReactNode } from "react";

export interface CustomerWorkspaceSidebarItem {
  id: string;
  label: string;
  description?: string;
  statusLabel?: string;
  disabled?: boolean;
}

export interface CustomerWorkspaceProps {
  className?: string;
  headerProps: CustomerHeaderProps;
  aiCommandProps: AICommandCenterProps;
  aiControls?: ReactNode;
  visitControls?: ReactNode;
  vehicleControls?: ReactNode;
  dealControls?: ReactNode;
  deliveryControls?: ReactNode;
  documentControls?: ReactNode;
  quoteControls?: ReactNode;
  appointmentControls?: ReactNode;
  communicationControls?: ReactNode;
  tradeControls?: ReactNode;
  taskControls?: ReactNode;
  leadControls?: ReactNode;
  profileControls?: ReactNode;
  snapshotProps: CustomerSnapshotProps;
  sidebarItems?: CustomerWorkspaceSidebarItem[];
  onSidebarItemSelect?: (itemId: string) => void;
  timelineTitle?: string;
  timelineDescription?: string;
  timelineEntries?: readonly TimelineEntry[];
}
