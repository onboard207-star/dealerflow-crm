import type {
  AICommandCenterProps,
  AICommandRecommendation,
} from "@/components/ai/AICommandCenter.types";

export const salesRecommendationDemo: AICommandRecommendation = {
  id: "ai-demo-sales-10482",
  workspace: {
    kind: "customer-sales",
    label: "Customer intelligence",
    contextLabel: "Jordan Mitchell · 2026 Honda CR-V Hybrid",
  },
  nextBestAction: "Call Jordan before 3:00 PM",
  confidence: {
    kind: "numeric",
    value: 96,
    max: 100,
    description: "The available evidence strongly supports this recommendation.",
    freshnessLabel: "Updated 2 minutes ago",
  },
  outcomeImpact: {
    label: "Expected Outcome",
    statement: "Increase likelihood of appointment confirmation",
    level: "high",
    qualification: "Estimated from current verified engagement signals.",
  },
  timeHorizon: {
    label: "Today",
    deadlineLabel: "Before 3:00 PM",
  },
  freshness: {
    label: "Generated 2 minutes ago",
    exactLabel: "Updated today at 11:42 AM",
    stale: false,
  },
  evidence: [
    {
      id: "sales-evidence-email",
      statement: "Pricing email was opened twice today.",
      sourceLabel: "Communication activity",
      timeLabel: "18 minutes ago",
    },
    {
      id: "sales-evidence-appointment",
      statement: "A test drive is confirmed for tomorrow at 10:30 AM.",
      sourceLabel: "Appointment",
    },
    {
      id: "sales-evidence-stock",
      statement: "The preferred vehicle is currently in stock.",
      sourceLabel: "Inventory",
      timeLabel: "Verified 6 minutes ago",
    },
  ],
  urgency: {
    level: "high",
    label: "Time sensitive",
    reason: "A same-day confirmation reduces uncertainty before tomorrow's visit.",
  },
  buyingProbability: {
    value: 82,
    max: 100,
    context: "Purchase within 30 days",
    freshnessLabel: "Updated 2 minutes ago",
    description: "An estimate based on approved engagement and workflow signals.",
  },
  momentum: {
    direction: "increasing",
    label: "Increasing",
    period: "Past 7 days",
    explanation: "Recent engagement and appointment progress are increasing.",
  },
  risks: [
    {
      id: "sales-risk-unconfirmed",
      title: "Appointment intent has not been reconfirmed today",
      evidence: "The last direct customer reply was yesterday afternoon.",
      mitigation: "Confirm attendance and transportation needs during the call.",
    },
  ],
  opportunities: [
    {
      id: "sales-opportunity-trade",
      title: "Complete the trade appraisal before the visit",
      evidence: "The customer provided trade details but no appraisal is recorded.",
    },
  ],
  primaryAction: {
    id: "prepare-call",
    label: "Prepare call",
    description: "Review the recommendation before contacting the customer.",
  },
  recommendedActions: [
    { id: "review-timeline", label: "Review timeline", requiresConnection: false },
    { id: "schedule-follow-up", label: "Schedule follow-up" },
  ],
};

export const inventoryRecommendationDemo: AICommandRecommendation = {
  id: "ai-demo-inventory-72",
  workspace: {
    kind: "inventory",
    label: "Inventory intelligence",
    contextLabel: "2025 Ford Explorer ST · Stock F2187",
  },
  nextBestAction: "Review pricing on this vehicle",
  confidence: {
    kind: "numeric",
    value: 89,
    max: 100,
    description: "Current aging and market evidence support a pricing review.",
  },
  outcomeImpact: {
    label: "Potential Outcome",
    statement: "Improve merchandising competitiveness",
    level: "medium",
  },
  timeHorizon: { label: "This Week" },
  freshness: {
    label: "Updated 14 minutes ago",
    exactLabel: "Updated today at 9:18 AM",
    stale: false,
  },
  evidence: [
    { id: "inventory-age", statement: "The vehicle has aged 72 days." },
    {
      id: "inventory-market",
      statement: "Comparable local units are selling faster.",
      sourceLabel: "Approved market comparison",
    },
  ],
  urgency: {
    level: "medium",
    label: "Review this week",
    reason: "Inventory age is above the current review threshold.",
  },
  momentum: {
    direction: "declining",
    label: "Declining",
    period: "Past 14 days",
    explanation: "Vehicle detail engagement has declined over the review period.",
  },
  risks: [{ id: "inventory-risk-age", title: "Continued aging may increase carrying cost" }],
  opportunities: [
    { id: "inventory-opportunity-demand", title: "Local demand remains active for this trim" },
  ],
  primaryAction: { id: "review-pricing", label: "Review pricing" },
  recommendedActions: [
    { id: "compare-units", label: "Compare similar units" },
    { id: "request-photos", label: "Request updated photos" },
  ],
};

export const serviceRecommendationDemo: AICommandRecommendation = {
  id: "ai-demo-service-441",
  workspace: {
    kind: "service",
    label: "Service intelligence",
    contextLabel: "Repair order 10441 · Morgan Lee",
  },
  nextBestAction: "Follow up on the deferred brake repair",
  confidence: {
    kind: "qualitative",
    label: "Strong evidence",
    description: "The recommendation is supported by the recorded inspection and follow-up date.",
  },
  outcomeImpact: {
    label: "Potential Outcome",
    statement: "Help the customer address a documented safety concern",
    qualification: "Customer approval is still required.",
  },
  timeHorizon: { label: "Today" },
  freshness: { label: "Generated 9 minutes ago", stale: false },
  evidence: [
    { id: "service-deferred", statement: "Brake repair was deferred at the last visit." },
    { id: "service-date", statement: "The requested follow-up date is today." },
  ],
  urgency: {
    level: "high",
    label: "Customer follow-up due",
    reason: "The deferred item is safety related and the agreed follow-up date has arrived.",
  },
  primaryAction: { id: "review-service-follow-up", label: "Review follow-up" },
  recommendedActions: [{ id: "review-inspection", label: "Review inspection" }],
};

export const financeRecommendationDemo: AICommandRecommendation = {
  id: "ai-demo-finance-208",
  workspace: {
    kind: "finance",
    label: "Finance intelligence",
    contextLabel: "Deal 20814 · Taylor Brooks",
  },
  nextBestAction: "Request the missing proof of income",
  confidence: {
    kind: "numeric",
    value: 94,
    max: 100,
    description: "The recorded lender stipulations directly support this request.",
  },
  outcomeImpact: {
    label: "Potential Outcome",
    statement: "Complete the lender review package",
    level: "high",
  },
  timeHorizon: { label: "Before Delivery", deadlineLabel: "Today by 5:00 PM" },
  freshness: { label: "Updated 4 minutes ago", stale: false },
  evidence: [
    { id: "finance-stip", statement: "Proof of income is an open lender stipulation." },
    { id: "finance-delivery", statement: "Delivery is scheduled for tomorrow morning." },
  ],
  urgency: {
    level: "high",
    label: "Required before delivery",
    reason: "The lender review cannot be completed without the requested document.",
  },
  risks: [{ id: "finance-risk-delay", title: "Missing documentation may delay delivery" }],
  primaryAction: { id: "review-document-request", label: "Review request" },
  recommendedActions: [{ id: "review-stipulations", label: "Review stipulations" }],
};

export const managementRecommendationDemo: AICommandRecommendation = {
  id: "ai-demo-management-12",
  workspace: {
    kind: "management",
    label: "Management intelligence",
    contextLabel: "Sales team · Today",
  },
  nextBestAction: "Review four unattended opportunities",
  confidence: {
    kind: "numeric",
    value: 91,
    max: 100,
    description: "Ownership and follow-up evidence support manager review.",
  },
  outcomeImpact: {
    label: "Expected Outcome",
    statement: "Restore clear ownership and follow-up accountability",
    level: "high",
  },
  timeHorizon: { label: "Now" },
  freshness: { label: "Generated 1 minute ago", stale: false },
  evidence: [
    { id: "management-unassigned", statement: "Four active opportunities have no next task." },
    { id: "management-age", statement: "Each opportunity has been unattended for over 24 hours." },
  ],
  urgency: {
    level: "high",
    label: "Needs attention now",
    reason: "Response delays are already outside the team's target window.",
  },
  momentum: {
    direction: "declining",
    label: "Declining",
    period: "Past 7 days",
    explanation: "Team response performance has declined during the review period.",
  },
  primaryAction: { id: "review-opportunities", label: "Review opportunities" },
  recommendedActions: [
    { id: "assign-owners", label: "Assign owners" },
    { id: "review-response-performance", label: "Review response performance" },
  ],
};

export const aiCommandCenterDemoStates = {
  ready: { state: "ready", recommendation: salesRecommendationDemo },
  loading: { state: "loading" },
  empty: {
    state: "empty",
    reason: "insufficient-evidence",
    fallbackAction: {
      id: "review-customer-timeline",
      label: "Review customer timeline",
      requiresConnection: false,
    },
  },
  error: {
    state: "error",
    title: "Recommendation could not be refreshed",
    description: "The last trustworthy recommendation is shown as stale.",
    lastRecommendation: {
      ...salesRecommendationDemo,
      freshness: {
        label: "Stale — last updated 3 hours ago",
        exactLabel: "Last successful update today at 8:44 AM",
        stale: true,
        sourceStatus: "One or more evidence sources may be delayed.",
      },
    },
    staleAreas: ["Confidence", "Outcome Impact", "Time Horizon", "Evidence"],
  },
  offline: {
    state: "offline",
    recommendation: {
      ...inventoryRecommendationDemo,
      freshness: {
        label: "Stale — last refreshed 2 hours ago",
        exactLabel: "Last successful generation today at 7:32 AM",
        stale: true,
        sourceStatus: "Live inventory and market evidence are unavailable offline.",
      },
    },
  },
  restricted: {
    state: "permission-restricted",
    title: "Intelligence access restricted",
    description: "Your role does not include access to this recommendation.",
  },
} satisfies Record<string, AICommandCenterProps>;

export const aiCommandCenterWorkspaceDemos = [
  salesRecommendationDemo,
  inventoryRecommendationDemo,
  serviceRecommendationDemo,
  financeRecommendationDemo,
  managementRecommendationDemo,
] satisfies AICommandRecommendation[];
