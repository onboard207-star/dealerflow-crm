export const capabilities = [
  "organization.configure",
  "staff.manage",
  "customer.read",
  "customer.create",
  "customer.update",
  "lead.read",
  "lead.create",
  "lead.assign",
  "lead.update",
  "task.read",
  "task.create",
  "task.update",
  "communication.read",
  "communication.create",
  "communication.consent.manage",
  "communication.send",
  "appointment.read",
  "appointment.create",
  "appointment.update",
  "deal.read",
  "deal.create",
  "deal.update",
  "deal.approve",
  "inventory.read",
  "inventory.create",
  "inventory.update",
  "reports.view",
] as const;

export type Capability = (typeof capabilities)[number];

export interface OrganizationMembership {
  organizationId: string;
  locationIds: readonly string[] | "all";
  capabilities: readonly Capability[];
  roleKeys?: readonly string[];
  features?: Readonly<Record<string, boolean>>;
}

export interface AuthorizationActor {
  userId: string;
  memberships: readonly OrganizationMembership[];
}

export interface AuthorizationRequest {
  capability: Capability;
  organizationId: string;
  locationId?: string;
}

export type AuthorizationDecision =
  | {
      allowed: true;
      membership: OrganizationMembership;
    }
  | {
      allowed: false;
      reason:
        | "invalid-actor"
        | "organization-membership-required"
        | "capability-required"
        | "location-access-required";
    };

export class AuthorizationError extends Error {
  readonly code = "FORBIDDEN";
  readonly reason: Exclude<AuthorizationDecision, { allowed: true }>["reason"];

  constructor(reason: AuthorizationError["reason"]) {
    super("You do not have permission to perform this action.");
    this.name = "AuthorizationError";
    this.reason = reason;
  }
}

export function assertFeatureEnabled(actor:AuthorizationActor,organizationId:string,feature:string){const membership=actor.memberships.find((item)=>item.organizationId===organizationId);if(!membership||membership.features?.[feature]===false)throw new AuthorizationError("capability-required");}

export function authorize(
  actor: AuthorizationActor,
  request: AuthorizationRequest,
): AuthorizationDecision {
  if (!actor.userId.trim()) {
    return { allowed: false, reason: "invalid-actor" };
  }

  const membership = actor.memberships.find(
    (candidate) => candidate.organizationId === request.organizationId,
  );

  if (!membership) {
    return { allowed: false, reason: "organization-membership-required" };
  }

  if (!membership.capabilities.includes(request.capability)) {
    return { allowed: false, reason: "capability-required" };
  }

  if (
    request.locationId &&
    membership.locationIds !== "all" &&
    !membership.locationIds.includes(request.locationId)
  ) {
    return { allowed: false, reason: "location-access-required" };
  }

  return { allowed: true, membership };
}

export function assertAuthorized(
  actor: AuthorizationActor,
  request: AuthorizationRequest,
): OrganizationMembership {
  const decision = authorize(actor, request);

  if (!decision.allowed) {
    throw new AuthorizationError(decision.reason);
  }

  return decision.membership;
}
