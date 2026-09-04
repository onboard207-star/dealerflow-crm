import { generateEntityId } from "@/lib/core/identifiers";
import { assertAuthorized, type AuthorizationActor } from "@/lib/platform/auth";
import type { OrganizationScope, RequestContext } from "@/lib/platform/data";

export interface PackPolicy extends OrganizationScope {
  id: string;
  enabled: boolean;
  packAmountCents?: number;
  version: number;
  updatedAt: string;
}

export type EffectivePack =
  | { amountCents: number; source: "location-override" | "organization-default"; policyId: string }
  | { amountCents: 0; source: "no-enabled-policy" };

export class PackPolicyIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PackPolicyIntegrityError";
  }
}

export class PackPolicyValidationError extends Error {
  constructor(readonly issues: readonly string[]) {
    super("Pack policy data is invalid.");
    this.name = "PackPolicyValidationError";
  }
}

export function resolveEffectivePackPolicy(input: {
  organizationDefault: PackPolicy | null;
  locationOverride: PackPolicy | null;
}): EffectivePack {
  if (input.locationOverride && !input.locationOverride.enabled) return { amountCents: 0, source: "no-enabled-policy" };
  const candidate = input.locationOverride?.enabled
    ? { policy: input.locationOverride, source: "location-override" as const }
    : input.organizationDefault?.enabled
      ? { policy: input.organizationDefault, source: "organization-default" as const }
      : null;
  if (!candidate) return { amountCents: 0, source: "no-enabled-policy" };
  if (candidate.policy.packAmountCents === undefined) {
    throw new PackPolicyIntegrityError("The enabled pack policy has no configured amount.");
  }
  return { amountCents: candidate.policy.packAmountCents, source: candidate.source, policyId: candidate.policy.id };
}

export interface PackPolicySession {
  getScope(scope: OrganizationScope, locationId?: string): Promise<PackPolicy | null>;
  save(context: RequestContext, input: { id: string; enabled: boolean; packAmountCents?: number; expectedVersion?: number }): Promise<PackPolicy>;
}

export interface PackPolicyProvider {
  transaction<Result>(operation: (session: PackPolicySession) => Promise<Result>): Promise<Result>;
}

export class PackPolicyService {
  constructor(private readonly provider: PackPolicyProvider) {}

  async save(request: OrganizationScope & {
    actor: AuthorizationActor;
    correlationId: string;
    enabled: boolean;
    packAmountCents?: number;
    expectedVersion?: number;
  }) {
    assertAuthorized(request.actor, { capability: "quote.pack.configure", organizationId: request.organizationId, locationId: request.locationId });
    validate(request);
    return this.provider.transaction(async (session) => {
      const current = await session.getScope(request, request.locationId);
      if (current && current.version !== request.expectedVersion) throw new PackPolicyIntegrityError("The pack policy changed. Reload before saving.");
      if (!current && request.expectedVersion !== undefined) throw new PackPolicyIntegrityError("The pack policy no longer exists.");
      return session.save({ actorId: request.actor.userId, organizationId: request.organizationId, ...(request.locationId ? { locationId: request.locationId } : {}), correlationId: request.correlationId }, {
        id: current?.id ?? generateEntityId("qpk"),
        enabled: request.enabled,
        ...(request.enabled ? { packAmountCents: request.packAmountCents } : {}),
        ...(current ? { expectedVersion: current.version } : {}),
      });
    });
  }
}

function validate(request: { enabled: boolean; packAmountCents?: number; expectedVersion?: number }) {
  const issues: string[] = [];
  if (request.enabled && (!Number.isSafeInteger(request.packAmountCents) || (request.packAmountCents ?? -1) < 0)) issues.push("Enabled policies require a nonnegative pack amount.");
  if (!request.enabled && request.packAmountCents !== undefined) issues.push("Disabled policies cannot retain a pack amount.");
  if (request.expectedVersion !== undefined && (!Number.isSafeInteger(request.expectedVersion) || request.expectedVersion < 1)) issues.push("expectedVersion is invalid.");
  if (issues.length) throw new PackPolicyValidationError(issues);
}
