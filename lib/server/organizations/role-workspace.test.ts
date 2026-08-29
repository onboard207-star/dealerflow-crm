import { describe, expect, it } from "vitest";
import type { OrganizationMembership } from "@/lib/platform/auth";
import { resolveWorkspaceProfiles } from "./role-workspace";

const membership=(roleKeys:readonly string[],capabilities:OrganizationMembership["capabilities"]):OrganizationMembership=>({organizationId:"org_one",locationIds:["loc_one"],roleKeys,capabilities});

describe("role workspace resolution",()=>{
  it("resolves a salesperson without manager-only views",()=>{const result=resolveWorkspaceProfiles(membership(["salesperson"],["lead.read","customer.read","deal.read"]));expect(result.available.map(item=>item.key)).toEqual(["my-work"]);expect(result.active?.audience).toBe("individual");});
  it("supports legitimate multi-role views without changing capabilities",()=>{const original=membership(["salesperson","sales-manager"],["lead.read","lead.update","deal.read"]);const result=resolveWorkspaceProfiles(original,"team-management");expect(result.available.map(item=>item.key)).toEqual(["my-work","team-management"]);expect(result.active?.key).toBe("team-management");expect(original.capabilities).toEqual(["lead.read","lead.update","deal.read"]);expect(original.capabilities).not.toContain("deal.approve");});
  it("does not expose a role view when its required capability was removed",()=>{const result=resolveWorkspaceProfiles(membership(["sales-manager"],["customer.read"]));expect(result.available).toEqual([]);expect(result.active).toBeUndefined();});
  it("preserves explicit service roles with a truthful unavailable module",()=>{const result=resolveWorkspaceProfiles(membership(["service-manager"],["appointment.read"]));expect(result.active).toMatchObject({key:"service-management",moduleAvailable:false});});
});
