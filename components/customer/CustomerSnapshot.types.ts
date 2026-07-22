export type SnapshotFactKind =
  | "confirmed"
  | "customer-stated"
  | "estimated"
  | "derived";

export interface SnapshotFact {
  id: string;
  label: string;
  value: string;
  detail?: string;
  kind?: SnapshotFactKind;
  sourceLabel?: string;
  freshnessLabel?: string;
}

export interface SnapshotIntelligenceItem extends SnapshotFact {
  explanation: string;
  evidence: string;
  evaluationPeriod?: string;
  uncertainty?: string;
}

export interface SnapshotImportantNote {
  id: string;
  text: string;
  sourceLabel?: string;
  verifiedLabel?: string;
}

export interface CustomerSnapshotData {
  id: string;
  identity?: SnapshotFact[];
  vehicleInterest?: SnapshotFact[];
  buyingJourney?: SnapshotFact[];
  communication?: SnapshotFact[];
  customerIntelligence?: SnapshotIntelligenceItem[];
  importantNotes?: SnapshotImportantNote[];
}

interface CustomerSnapshotBaseProps {
  className?: string;
}

export interface CustomerSnapshotReadyProps extends CustomerSnapshotBaseProps {
  state?: "ready";
  snapshot: CustomerSnapshotData;
}

export interface CustomerSnapshotLoadingProps extends CustomerSnapshotBaseProps {
  state: "loading";
}

export interface CustomerSnapshotEmptyProps extends CustomerSnapshotBaseProps {
  state: "empty";
  title?: string;
  description?: string;
}

export interface CustomerSnapshotErrorProps extends CustomerSnapshotBaseProps {
  state: "error";
  title?: string;
  description?: string;
  lastSnapshot?: CustomerSnapshotData;
  unavailableSections?: string[];
  onRetry?: () => void;
}

export interface CustomerSnapshotOfflineProps extends CustomerSnapshotBaseProps {
  state: "offline";
  snapshot: CustomerSnapshotData;
  lastUpdatedLabel: string;
  staleSections?: string[];
}

export interface CustomerSnapshotRestrictedProps extends CustomerSnapshotBaseProps {
  state: "permission-restricted";
  title?: string;
  description?: string;
}

export type CustomerSnapshotProps =
  | CustomerSnapshotReadyProps
  | CustomerSnapshotLoadingProps
  | CustomerSnapshotEmptyProps
  | CustomerSnapshotErrorProps
  | CustomerSnapshotOfflineProps
  | CustomerSnapshotRestrictedProps;
