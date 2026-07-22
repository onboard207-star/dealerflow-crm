import type {
  CustomerSnapshotData,
  CustomerSnapshotProps,
} from "@/components/customer/CustomerSnapshot.types";

export const customerSnapshotDemoData: CustomerSnapshotData = {
  id: "snapshot-customer-10482",
  identity: [
    {
      id: "customer-type",
      label: "Customer Type",
      value: "Returning customer",
      kind: "confirmed",
      sourceLabel: "Customer record",
    },
    {
      id: "lead-source",
      label: "Lead Source",
      value: "Dealer website",
      kind: "confirmed",
      sourceLabel: "Lead record",
    },
    {
      id: "location",
      label: "Location",
      value: "Portland, Maine",
      kind: "customer-stated",
    },
  ],
  vehicleInterest: [
    {
      id: "primary-vehicle",
      label: "Primary Vehicle",
      value: "2026 Honda CR-V Hybrid Touring",
      detail: "Platinum White Pearl · Stock H26418",
      kind: "confirmed",
    },
    {
      id: "alternative-vehicles",
      label: "Alternative Vehicles",
      value: "Toyota RAV4 Hybrid, Honda CR-V Touring",
      kind: "customer-stated",
    },
    {
      id: "trade-vehicle",
      label: "Trade Vehicle",
      value: "2019 Subaru Outback Limited",
      detail: "Approximately 68,000 miles",
      kind: "customer-stated",
    },
    {
      id: "trade-equity",
      label: "Trade Equity",
      value: "Estimated positive equity",
      detail: "Estimate requires an in-person appraisal",
      kind: "estimated",
      freshnessLabel: "Estimated today at 9:20 AM",
    },
    {
      id: "vehicle-status",
      label: "Vehicle Status",
      value: "In stock",
      kind: "confirmed",
      freshnessLabel: "Verified 8 minutes ago",
    },
  ],
  buyingJourney: [
    {
      id: "current-stage",
      label: "Current Stage",
      value: "Test drive scheduled",
      kind: "confirmed",
    },
    {
      id: "purchase-intent",
      label: "Purchase Intent",
      value: "Replace current vehicle before winter",
      kind: "customer-stated",
    },
    {
      id: "estimated-timeframe",
      label: "Estimated Timeframe",
      value: "Within 30 days",
      kind: "customer-stated",
    },
    {
      id: "finance-status",
      label: "Finance Status",
      value: "Considering dealer financing",
      kind: "customer-stated",
    },
    {
      id: "appointment-status",
      label: "Appointment Status",
      value: "Confirmed for tomorrow",
      detail: "Test drive · 10:30 AM",
      kind: "confirmed",
    },
  ],
  communication: [
    {
      id: "preferred-contact",
      label: "Preferred Contact Method",
      value: "Text message",
      kind: "customer-stated",
    },
    {
      id: "best-contact-time",
      label: "Best Contact Time",
      value: "Weekdays after 2:00 PM",
      kind: "customer-stated",
    },
    {
      id: "last-contact",
      label: "Last Contact",
      value: "Text message · Yesterday at 4:18 PM",
      kind: "confirmed",
    },
    {
      id: "response-pattern",
      label: "Response Pattern",
      value: "Usually responds to text the same day",
      detail: "Based on five eligible conversations",
      kind: "derived",
      freshnessLabel: "Past 60 days",
    },
    {
      id: "communication-consent",
      label: "Communication Consent",
      value: "Text and email permitted",
      detail: "Phone outreach permitted · Marketing email not permitted",
      kind: "confirmed",
      freshnessLabel: "Verified yesterday",
    },
  ],
  customerIntelligence: [
    {
      id: "buying-style",
      label: "Buying Style",
      value: "Research-oriented",
      explanation: "Prefers specifications and written comparisons before deciding.",
      evidence: "Requested two trim comparisons and a feature sheet.",
      evaluationPeriod: "Current shopping journey",
      kind: "derived",
    },
    {
      id: "decision-speed",
      label: "Decision Speed",
      value: "Deliberate",
      explanation: "Typically reviews information before confirming the next step.",
      evidence: "Three recorded follow-ups followed document review.",
      evaluationPeriod: "Past 21 days",
      kind: "derived",
    },
    {
      id: "price-sensitivity",
      label: "Price Sensitivity",
      value: "Budget-conscious",
      explanation: "Monthly payment and trade value are important decision factors.",
      evidence: "Customer stated a preferred payment range and requested trade estimates.",
      kind: "customer-stated",
    },
    {
      id: "brand-loyalty",
      label: "Brand Loyalty",
      value: "Open to comparison",
      explanation: "Honda is preferred, but alternatives remain under consideration.",
      evidence: "Honda and Toyota models appear in confirmed vehicle interests.",
      kind: "derived",
    },
    {
      id: "competitor-shopping",
      label: "Competitor Shopping",
      value: "Comparing Toyota RAV4 Hybrid",
      explanation: "The customer is actively comparing a similar hybrid SUV.",
      evidence: "Customer mentioned a Toyota appointment during the last conversation.",
      freshnessLabel: "Confirmed yesterday",
      kind: "customer-stated",
    },
  ],
  importantNotes: [
    {
      id: "note-spouse",
      text: "Bringing spouse to the test drive.",
      sourceLabel: "Customer-stated",
      verifiedLabel: "Confirmed yesterday",
    },
    {
      id: "note-awd",
      text: "AWD is required for the replacement vehicle.",
      sourceLabel: "Customer-stated",
    },
    {
      id: "note-photos",
      text: "Requested cargo-area photos before the appointment.",
      sourceLabel: "Text conversation",
      verifiedLabel: "Yesterday at 4:18 PM",
    },
  ],
};

export const serviceCustomerSnapshotDemoData: CustomerSnapshotData = {
  id: "snapshot-service-8841",
  identity: [
    { id: "type", label: "Customer Type", value: "Sales and service customer" },
    { id: "source", label: "Lead Source", value: "Service-to-sales referral" },
  ],
  vehicleInterest: [
    { id: "primary", label: "Primary Vehicle", value: "2025 Ford Explorer ST" },
    { id: "trade", label: "Trade Vehicle", value: "2018 Ford Edge Titanium" },
  ],
  buyingJourney: [
    { id: "stage", label: "Current Stage", value: "Vehicle comparison" },
    { id: "timeframe", label: "Estimated Timeframe", value: "This quarter" },
  ],
  communication: [
    { id: "method", label: "Preferred Contact Method", value: "Phone" },
    { id: "consent", label: "Communication Consent", value: "Phone permitted" },
  ],
  importantNotes: [
    {
      id: "service-note",
      text: "Interested in warranty coverage and third-row space.",
      sourceLabel: "Service advisor referral",
    },
  ],
};

export const customerSnapshotDemo = {
  state: "ready",
  snapshot: customerSnapshotDemoData,
} satisfies CustomerSnapshotProps;

export const customerSnapshotDemoStates = {
  ready: customerSnapshotDemo,
  loading: { state: "loading" },
  empty: { state: "empty" },
  error: {
    state: "error",
    title: "Some snapshot details could not be refreshed",
    description: "The last trustworthy customer context is shown below.",
    lastSnapshot: customerSnapshotDemoData,
    unavailableSections: ["Customer Intelligence", "Vehicle Interest"],
  },
  offline: {
    state: "offline",
    snapshot: customerSnapshotDemoData,
    lastUpdatedLabel: "Last updated today at 9:20 AM",
    staleSections: [
      "Vehicle Interest",
      "Buying Journey",
      "Communication Consent",
      "Customer Intelligence",
    ],
  },
  restricted: {
    state: "permission-restricted",
    description: "Your role does not include access to this customer context.",
  },
} satisfies Record<string, CustomerSnapshotProps>;
