import type { AuthorizationActor } from "@/lib/platform/auth";
import { assertAuthorized } from "@/lib/platform/auth";

export type ManagedMembershipStatus = "active" | "suspended" | "revoked";
export type MembershipMutationResult = "updated" | "not_found" | "invalid_scope" | "self_change" | "last_manager";

export interface MembershipAdministrationProvider {
  updateAccess(input: { actorId: string; organizationId: string; membershipId: string; roleIds: readonly string[]; locationIds: readonly string[]; allLocations: boolean }): Promise<MembershipMutationResult>;
  updateStatus(input: { actorId: string; organizationId: string; membershipId: string; status: ManagedMembershipStatus }): Promise<MembershipMutationResult>;
}

export class MembershipAdministrationError extends Error {}

export class ManageMembershipsService {
  constructor(private readonly provider: MembershipAdministrationProvider) {}

  async updateAccess(input: { actor: AuthorizationActor; organizationId: string; membershipId: string; roleIds: readonly string[]; locationIds: readonly string[]; allLocations: boolean }) {
    assertAuthorized(input.actor, { organizationId: input.organizationId, capability: "staff.manage" });
    validateId(input.membershipId);
    if (!input.roleIds.length || new Set(input.roleIds).size !== input.roleIds.length) throw new MembershipAdministrationError("At least one unique role is required.");
    if (!input.allLocations && !input.locationIds.length) throw new MembershipAdministrationError("At least one location is required.");
    if (new Set(input.locationIds).size !== input.locationIds.length) throw new MembershipAdministrationError("Locations must be unique.");
    return resolve(await this.provider.updateAccess({ ...input, actorId: input.actor.userId }));
  }

  async updateStatus(input: { actor: AuthorizationActor; organizationId: string; membershipId: string; status: ManagedMembershipStatus }) {
    assertAuthorized(input.actor, { organizationId: input.organizationId, capability: "staff.manage" });
    validateId(input.membershipId);
    return resolve(await this.provider.updateStatus({ ...input, actorId: input.actor.userId }));
  }
}

function validateId(value: string) { if (!/^mem_[a-z0-9_-]{6,64}$/.test(value)) throw new MembershipAdministrationError("A valid membership is required."); }
function resolve(result: MembershipMutationResult) {
  if (result === "updated") return;
  const messages: Record<Exclude<MembershipMutationResult, "updated">, string> = {
    not_found: "The membership was not found.", invalid_scope: "The selected roles or locations are invalid.",
    self_change: "You cannot change your own access from this screen.", last_manager: "At least one active staff manager must remain.",
  };
  throw new MembershipAdministrationError(messages[result]);
}
