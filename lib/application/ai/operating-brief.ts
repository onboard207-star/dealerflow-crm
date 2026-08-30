import type { Capability } from "@/lib/platform/auth";
import type { RoleWorkspaceModel, WorkspaceProfile } from "@/lib/server/organizations";

export const operatingBriefVersion = "operating-brief-v1";

export type OperatingBriefKind = "fact" | "recommendation" | "unknown";

export interface OperatingBriefItem {
  id: string;
  kind: OperatingBriefKind;
  title: string;
  detail: string;
  href?: string;
}

export interface OperatingBrief {
  version: typeof operatingBriefVersion;
  audience: WorkspaceProfile["audience"];
  title: string;
  summary: string;
  primaryRecommendation?: OperatingBriefItem;
  facts: readonly OperatingBriefItem[];
  unknowns: readonly OperatingBriefItem[];
  generatedAt: string;
}

export function buildOperatingBrief(input: {
  capabilities: readonly Capability[];
  model: RoleWorkspaceModel;
  profile: WorkspaceProfile;
}): OperatingBrief {
  const permittedMetrics = input.model.metrics.filter((metric) => capabilityForMetric(metric.label, input.capabilities));
  const facts = permittedMetrics.map((metric, index) => ({
    id: `metric-${index + 1}`,
    kind: "fact" as const,
    title: `${metric.value} ${metric.label}`,
    detail: metric.definition,
    href: metric.href,
  }));
  const priority = input.model.priorities.find((item) => capabilityForQueue(item.id, input.capabilities));
  const primaryRecommendation = priority ? {
    id: `recommendation-${priority.id}`,
    kind: "recommendation" as const,
    title: recommendationTitle(input.profile),
    detail: `${priority.label} — ${priority.detail}`,
    href: priority.href,
  } : undefined;
  const unknowns = unknownsFor(input.profile);
  return {
    version: operatingBriefVersion,
    audience: input.profile.audience,
    title: briefTitle(input.profile),
    summary: primaryRecommendation
      ? "DealerFlow found an authorized operational priority and the records that support it."
      : "DealerFlow found no role-specific priority requiring immediate attention in the available records.",
    ...(primaryRecommendation ? { primaryRecommendation } : {}),
    facts,
    unknowns,
    generatedAt: input.model.generatedAt,
  };
}

function capabilityForQueue(id: string, capabilities: readonly Capability[]) {
  const kind = id.split(":", 1)[0];
  const required: Partial<Record<string, Capability>> = {
    lead: "lead.read",
    task: "task.read",
    appointment: "appointment.read",
    deal: "deal.read",
    inventory: "inventory.read",
  };
  const capability = required[kind];
  return capability ? capabilities.includes(capability) : false;
}

function capabilityForMetric(label: string, capabilities: readonly Capability[]) {
  const required: Partial<Record<string, Capability>> = {
    "Active Leads": "lead.read",
    "Overdue Follow-Up": "task.read",
    "Appointments Today": "appointment.read",
    "Deals Awaiting Approval": "deal.read",
    "Available Inventory": "inventory.read",
    "Inventory Missing Photos": "inventory.read",
  };
  const capability = required[label];
  return capability ? capabilities.includes(capability) : false;
}

function briefTitle(profile: WorkspaceProfile) {
  if (profile.audience === "individual") return "Morning Brief";
  if (profile.audience === "executive") return "Executive Brief";
  if (profile.audience === "inventory") return "Inventory Brief";
  if (profile.audience === "finance") return "Deal and Finance Brief";
  if (profile.key === "bdc") return "BDC Brief";
  return "Manager Brief";
}

function recommendationTitle(profile: WorkspaceProfile) {
  if (profile.audience === "inventory") return "Review this inventory exception first";
  if (profile.audience === "finance") return "Review this Deal first";
  if (profile.audience === "executive") return "Investigate this operating exception first";
  return "Work this priority first";
}

function unknownsFor(profile: WorkspaceProfile): OperatingBriefItem[] {
  if (profile.audience === "service") return [{ id: "service-unavailable", kind: "unknown", title: "Service context unavailable", detail: "Authoritative service workflow data is not implemented." }];
  if (profile.audience === "inventory") return [{ id: "market-pricing", kind: "unknown", title: "Market pricing unavailable", detail: "No verified external market-data provider is connected." }];
  if (profile.audience === "finance") return [{ id: "lender-context", kind: "unknown", title: "Lender and credit context excluded", detail: "This brief does not infer approvals, APR, payments, or eligibility." }];
  return [];
}
