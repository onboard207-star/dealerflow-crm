import { aiCommandCenterDemoStates } from "@/components/ai/AICommandCenter.demo";
import { customerHeaderDemoStates } from "@/components/customer/CustomerHeader.demo";
import { customerSnapshotDemo } from "@/components/customer/CustomerSnapshot.demo";
import type {
  CustomerWorkspaceProps,
  CustomerWorkspaceSidebarItem,
} from "@/components/workspaces/customer/CustomerWorkspace.types";

const customerWorkspaceSidebarItems = [
  {
    id: "tasks",
    label: "Tasks",
    description: "Open and upcoming customer tasks.",
    statusLabel: "Coming soon",
  },
  {
    id: "alerts",
    label: "Alerts",
    description: "Important changes that may require attention.",
    statusLabel: "Coming soon",
  },
  {
    id: "documents",
    label: "Documents",
    description: "Customer-facing and internal files.",
    statusLabel: "Coming soon",
  },
  {
    id: "quotes",
    label: "Quotes",
    description: "Saved and draft purchase proposals.",
    statusLabel: "Coming soon",
  },
  {
    id: "trade-appraisal",
    label: "Trade Appraisal",
    description: "Trade details and appraisal progress.",
    statusLabel: "Coming soon",
  },
] satisfies CustomerWorkspaceSidebarItem[];

export const customerWorkspaceDemo = {
  headerProps: customerHeaderDemoStates.ready,
  aiCommandProps: aiCommandCenterDemoStates.ready,
  snapshotProps: customerSnapshotDemo,
  sidebarItems: customerWorkspaceSidebarItems,
} satisfies CustomerWorkspaceProps;
