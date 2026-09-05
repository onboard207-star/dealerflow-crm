import type { Capability } from "@/lib/platform/auth";

import type { TenantFeatureKey, TenantFeatures } from "./tenant-config";

export interface FeatureEntitlementDefinition {
  key: TenantFeatureKey;
  label: string;
  description: string;
  capabilities: readonly Capability[];
}

export const featureEntitlementRegistry: readonly FeatureEntitlementDefinition[] = [
  { key: "crm", label: "CRM", description: "Customer, Lead, task, appointment, and communication workflows.", capabilities: ["customer.read", "customer.create", "customer.update", "lead.read", "lead.create", "lead.assign", "lead.update", "task.read", "task.create", "task.update", "communication.read", "communication.create", "communication.consent.manage", "communication.send", "appointment.read", "appointment.create", "appointment.update"] },
  { key: "inventory", label: "Inventory", description: "Vehicle inventory, media, and authoritative cost operations.", capabilities: ["inventory.read", "inventory.create", "inventory.update", "inventory.cost.read", "inventory.cost.manage"] },
  { key: "finance", label: "Finance", description: "Deal, approval, desking, quote, document, trade, delivery, and pack workflows.", capabilities: ["deal.read", "deal.create", "deal.update", "deal.approve", "document.read", "document.manage", "document.complete", "document.waive", "quote.pack.read", "quote.pack.configure"] },
  { key: "service", label: "Service", description: "Reserved for future authoritative service workflows.", capabilities: [] },
  { key: "reporting", label: "Reporting", description: "Management reporting and operational command surfaces.", capabilities: ["reports.view"] },
  { key: "ai", label: "DealerFlow AI", description: "Explainable AI operating briefs and governed recommendations.", capabilities: [] },
  { key: "customerPortal", label: "Customer Portal", description: "Reserved for future customer self-service experiences.", capabilities: [] },
  { key: "dealerPortal", label: "Dealer Portal", description: "Reserved for future external dealer collaboration.", capabilities: [] },
] as const;

const featureByCapability = new Map<Capability, TenantFeatureKey>(
  featureEntitlementRegistry.flatMap((feature) => feature.capabilities.map((capability) => [capability, feature.key] as const)),
);

export function featureForCapability(capability: Capability): TenantFeatureKey | undefined {
  return featureByCapability.get(capability);
}

export function isCapabilityEntitled(capability: Capability, features?: Partial<TenantFeatures>): boolean {
  const feature = featureForCapability(capability);
  return feature === undefined || features?.[feature] !== false;
}
