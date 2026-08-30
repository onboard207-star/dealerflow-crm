import { describe, expect, it, vi } from "vitest";
import { ManageMembershipsService, MembershipAdministrationError, type MembershipAdministrationProvider } from "./manage-memberships";

const actor = { userId: "usr_manager1", memberships: [{ organizationId: "org_dealerflow", locationIds: "all" as const, capabilities: ["staff.manage" as const] }] };
const provider = (): MembershipAdministrationProvider => ({ updateAccess: vi.fn().mockResolvedValue("updated"), updateStatus: vi.fn().mockResolvedValue("updated") });

describe("ManageMembershipsService", () => {
  it("updates valid role and location access", async () => { const target=provider(); await new ManageMembershipsService(target).updateAccess({actor,organizationId:"org_dealerflow",membershipId:"mem_salesperson",roleIds:["rol_salesperson"],locationIds:["loc_rooftop1"],allLocations:false}); expect(target.updateAccess).toHaveBeenCalledWith(expect.objectContaining({actorId:"usr_manager1",confirmPrivileged:false})); });
  it("requires a role and a location for restricted access", async () => { await expect(new ManageMembershipsService(provider()).updateAccess({actor,organizationId:"org_dealerflow",membershipId:"mem_salesperson",roleIds:[],locationIds:[],allLocations:false})).rejects.toBeInstanceOf(MembershipAdministrationError); });
  it("surfaces last-manager protection", async () => { const target=provider(); vi.mocked(target.updateStatus).mockResolvedValue("last_manager"); await expect(new ManageMembershipsService(target).updateStatus({actor,organizationId:"org_dealerflow",membershipId:"mem_salesperson",status:"suspended"})).rejects.toThrow("At least one active staff manager"); });
  it("surfaces required confirmation for elevated access",async()=>{const target=provider();vi.mocked(target.updateAccess).mockResolvedValue("privileged_confirmation_required");await expect(new ManageMembershipsService(target).updateAccess({actor,organizationId:"org_dealerflow",membershipId:"mem_salesperson",roleIds:["rol_owner"],locationIds:[],allLocations:true})).rejects.toThrow("Confirm the intentional assignment")});
});
