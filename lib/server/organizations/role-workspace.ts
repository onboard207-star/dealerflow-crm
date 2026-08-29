import type { Capability, OrganizationMembership } from "@/lib/platform/auth";

export type WorkspaceProfileKey = "my-work" | "team-management" | "executive" | "bdc" | "finance" | "inventory" | "controller" | "service-management" | "service-advisor" | "reception";
export type WorkspaceAudience = "individual" | "team" | "executive" | "finance" | "inventory" | "service" | "reception";

export interface WorkspaceProfile {
  key: WorkspaceProfileKey;
  label: string;
  eyebrow: string;
  question: string;
  audience: WorkspaceAudience;
  roleKeys: readonly string[];
  requiredCapability: Capability;
  moduleAvailable: boolean;
}

const profiles: readonly WorkspaceProfile[] = [
  {key:"my-work",label:"My Work",eyebrow:"Sales workspace",question:"Who do I need to contact or help next?",audience:"individual",roleKeys:["salesperson"],requiredCapability:"lead.read",moduleAvailable:true},
  {key:"team-management",label:"Team Management",eyebrow:"Sales management",question:"Where does my team need intervention?",audience:"team",roleKeys:["sales-manager"],requiredCapability:"lead.read",moduleAvailable:true},
  {key:"executive",label:"Dealership Operations",eyebrow:"Executive workspace",question:"Is the dealership operating correctly, and where is the risk or opportunity?",audience:"executive",roleKeys:["owner","general-manager"],requiredCapability:"reports.view",moduleAvailable:true},
  {key:"bdc",label:"Engagement Queue",eyebrow:"BDC workspace",question:"Which leads and customers require engagement now?",audience:"team",roleKeys:["bdc"],requiredCapability:"lead.read",moduleAvailable:true},
  {key:"finance",label:"Finance Queue",eyebrow:"Finance workspace",question:"Which deals require finance action?",audience:"finance",roleKeys:["finance-manager"],requiredCapability:"deal.read",moduleAvailable:true},
  {key:"inventory",label:"Inventory Operations",eyebrow:"Inventory workspace",question:"Which vehicles require inventory action?",audience:"inventory",roleKeys:["inventory-manager"],requiredCapability:"inventory.read",moduleAvailable:true},
  {key:"controller",label:"Deal Review",eyebrow:"Controller workspace",question:"Which deals and exceptions require review?",audience:"finance",roleKeys:["controller"],requiredCapability:"deal.read",moduleAvailable:true},
  {key:"service-management",label:"Service Management",eyebrow:"Service workspace",question:"Where does the service team need attention?",audience:"service",roleKeys:["service-manager"],requiredCapability:"appointment.read",moduleAvailable:false},
  {key:"service-advisor",label:"Service Customers",eyebrow:"Advisor workspace",question:"Which assigned customers need help next?",audience:"service",roleKeys:["service-advisor"],requiredCapability:"appointment.read",moduleAvailable:false},
  {key:"reception",label:"Front Desk",eyebrow:"Reception workspace",question:"Who is arriving or needs assistance now?",audience:"reception",roleKeys:["receptionist"],requiredCapability:"customer.read",moduleAvailable:true},
];

export function resolveWorkspaceProfiles(membership: OrganizationMembership, requested?: string) {
  const roles = new Set(membership.roleKeys ?? []);
  const available = profiles.filter((profile) => profile.roleKeys.some((role) => roles.has(role)) && membership.capabilities.includes(profile.requiredCapability));
  const fallback = inferCapabilityProfile(membership);
  const resolved = available.length ? available : fallback ? [fallback] : [];
  return { available: resolved, active: resolved.find((profile) => profile.key === requested) ?? resolved[0] };
}

function inferCapabilityProfile(membership: OrganizationMembership): WorkspaceProfile | undefined {
  if (membership.capabilities.includes("organization.configure") && membership.capabilities.includes("reports.view")) return profiles.find((item) => item.key === "executive");
  if (membership.capabilities.includes("deal.read")) return profiles.find((item) => item.key === "finance");
  if (membership.capabilities.includes("inventory.read")) return profiles.find((item) => item.key === "inventory");
  if (membership.capabilities.includes("lead.read")) return profiles.find((item) => item.key === "my-work");
  return undefined;
}
