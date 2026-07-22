export type AIWorkspaceKind =
  | "customer-sales"
  | "inventory"
  | "service"
  | "finance"
  | "management";

export interface AIWorkspaceContext {
  kind: AIWorkspaceKind;
  label: string;
  contextLabel?: string;
}

export type AIConfidence =
  | {
      kind: "numeric";
      value: number;
      max: number;
      description: string;
      freshnessLabel?: string;
    }
  | {
      kind: "qualitative";
      label: string;
      description: string;
      freshnessLabel?: string;
    };

export interface AIOutcomeImpact {
  label: "Expected Outcome" | "Expected Impact" | "Potential Outcome";
  statement: string;
  level?: "high" | "medium" | "low";
  qualification?: string;
}

export interface AITimeHorizon {
  label: string;
  deadlineLabel?: string;
  expired?: boolean;
}

export interface AIRecommendationFreshness {
  label: string;
  exactLabel?: string;
  stale: boolean;
  sourceStatus?: string;
}

export interface AIEvidenceItem {
  id: string;
  statement: string;
  sourceLabel?: string;
  timeLabel?: string;
}

export interface AIUrgency {
  level: "none" | "low" | "medium" | "high";
  label: string;
  reason: string;
}

export interface AIBuyingProbability {
  value: number;
  max: number;
  context: string;
  freshnessLabel: string;
  description: string;
}

export interface AIMomentum {
  direction: "increasing" | "stable" | "declining" | "insufficient-evidence";
  label: string;
  period: string;
  explanation: string;
}

export interface AIInsightItem {
  id: string;
  title: string;
  evidence?: string;
  mitigation?: string;
}

export interface AICommandAction {
  id: string;
  label: string;
  description?: string;
  availability?: "available" | "disabled";
  unavailableReason?: string;
  requiresConnection?: boolean;
}

export interface AICommandRecommendation {
  id: string;
  workspace: AIWorkspaceContext;
  aiLabel?: string;
  nextBestAction: string;
  confidence: AIConfidence;
  outcomeImpact?: AIOutcomeImpact;
  timeHorizon?: AITimeHorizon;
  freshness: AIRecommendationFreshness;
  evidence: AIEvidenceItem[];
  urgency?: AIUrgency;
  buyingProbability?: AIBuyingProbability;
  momentum?: AIMomentum;
  risks?: AIInsightItem[];
  opportunities?: AIInsightItem[];
  primaryAction: AICommandAction;
  recommendedActions?: AICommandAction[];
}

export type AICommandEmptyReason =
  | "insufficient-evidence"
  | "no-relevant-recommendation"
  | "expired-awaiting-refresh"
  | "workflow-completed"
  | "unsupported-workspace";

interface AICommandCenterBaseProps {
  className?: string;
  onAction?: (actionId: string) => void;
}

export interface AICommandCenterReadyProps extends AICommandCenterBaseProps {
  state?: "ready";
  recommendation: AICommandRecommendation;
}

export interface AICommandCenterLoadingProps extends AICommandCenterBaseProps {
  state: "loading";
}

export interface AICommandCenterEmptyProps extends AICommandCenterBaseProps {
  state: "empty";
  reason: AICommandEmptyReason;
  title?: string;
  description?: string;
  fallbackAction?: AICommandAction;
}

export interface AICommandCenterErrorProps extends AICommandCenterBaseProps {
  state: "error";
  title?: string;
  description?: string;
  lastRecommendation?: AICommandRecommendation;
  staleAreas?: string[];
  onRetry?: () => void;
}

export interface AICommandCenterOfflineProps extends AICommandCenterBaseProps {
  state: "offline";
  recommendation: AICommandRecommendation;
}

export interface AICommandCenterRestrictedProps extends AICommandCenterBaseProps {
  state: "permission-restricted";
  title?: string;
  description?: string;
}

export type AICommandCenterProps =
  | AICommandCenterReadyProps
  | AICommandCenterLoadingProps
  | AICommandCenterEmptyProps
  | AICommandCenterErrorProps
  | AICommandCenterOfflineProps
  | AICommandCenterRestrictedProps;
