import type { AICommandCenterProps } from "@/components/ai/AICommandCenter.types";
import type { CustomerHeaderProps } from "@/components/customer/CustomerHeader.types";
import type { CustomerSnapshotProps } from "@/components/customer/CustomerSnapshot.types";

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
  snapshotProps: CustomerSnapshotProps;
  sidebarItems?: CustomerWorkspaceSidebarItem[];
  onSidebarItemSelect?: (itemId: string) => void;
  timelineTitle?: string;
  timelineDescription?: string;
}
