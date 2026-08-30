import { describe, expect, it } from "vitest";

import { authorize, type AuthorizationActor, type Capability } from "@/lib/platform/auth";
import { MembershipError, resolveAuthorizationActor } from "@/lib/server/auth";

const tenantA = "org_tenant_a";
const tenantB = "org_tenant_b";
const rooftopA = "loc_tenant_a_main";
const rooftopB = "loc_tenant_a_other";
const protectedDomains: Readonly<Record<string, Capability>> = {
  customers: "customer.read", leads: "lead.read", communications: "communication.read", appointments: "appointment.read", tasks: "task.read", deals: "deal.read", inventory: "inventory.read", vehicleMedia: "inventory.read", reports: "reports.view", exports: "organization.configure", ai: "customer.read", notifications: "task.read", billing: "organization.configure", integrations: "organization.configure", administration: "organization.configure",
};

function actor(userId: string, organizationId: string, locationIds: readonly string[] | "all", grants: readonly Capability[]): AuthorizationActor {
  return { userId, memberships: [{ organizationId, locationIds, capabilities: grants }] };
}

describe("adversarial tenant isolation matrix", () => {
  const tenantAAdmin = actor("usr_tenant_a_admin", tenantA, "all", Object.values(protectedDomains));
  const tenantASalesperson = actor("usr_tenant_a_sales", tenantA, [rooftopA], ["customer.read", "lead.read", "communication.read", "appointment.read", "task.read", "inventory.read"]);
  const tenantBSalesperson = actor("usr_tenant_b_sales", tenantB, ["loc_tenant_b_main"], ["customer.read", "lead.read", "communication.read", "appointment.read", "task.read", "inventory.read"]);
  const platformAdministratorWithoutTenantGrant = actor("usr_platform_admin", "org_platform", "all", ["organization.configure"]);

  it.each(Object.entries(protectedDomains))("denies Tenant A access to Tenant B %s", (_domain, capability) => {
    expect(authorize(tenantAAdmin, { organizationId: tenantB, capability })).toEqual({ allowed: false, reason: "organization-membership-required" });
  });

  it.each(Object.entries(protectedDomains))("denies Tenant B access to Tenant A %s", (_domain, capability) => {
    expect(authorize(tenantBSalesperson, { organizationId: tenantA, capability }).allowed).toBe(false);
  });

  it("does not treat an unmodeled platform administrator as unrestricted", () => {
    expect(authorize(platformAdministratorWithoutTenantGrant, { organizationId: tenantA, capability: "organization.configure" })).toEqual({ allowed: false, reason: "organization-membership-required" });
  });

  it("enforces rooftop scope even when the user owns the domain capability", () => {
    expect(authorize(tenantASalesperson, { organizationId: tenantA, locationId: rooftopA, capability: "customer.read" }).allowed).toBe(true);
    expect(authorize(tenantASalesperson, { organizationId: tenantA, locationId: rooftopB, capability: "customer.read" })).toEqual({ allowed: false, reason: "location-access-required" });
  });

  it("combines legitimate multi-role grants but removes disabled-module capabilities", async () => {
    const resolved = await resolveAuthorizationActor("usr_multi_role", tenantA, { readActiveMembership: async () => ({ organizationId: tenantA, allLocations: false, locationIds: [rooftopA], roleKeys: ["salesperson", "finance-manager"], capabilities: ["customer.read", "deal.read", "deal.approve"], features: { crm: true, finance: false } }) });
    expect(resolved.memberships[0]).toMatchObject({ roleKeys: ["salesperson", "finance-manager"], capabilities: ["customer.read"] });
  });

  it("rejects inactive, revoked, or otherwise absent memberships", async () => {
    await expect(resolveAuthorizationActor("usr_revoked", tenantA, { readActiveMembership: async () => null })).rejects.toBeInstanceOf(MembershipError);
  });
});

