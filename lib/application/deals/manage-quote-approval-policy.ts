import { generateEntityId } from "@/lib/core/identifiers";
import { assertAuthorized, type AuthorizationActor } from "@/lib/platform/auth";
import type { OrganizationScope, RequestContext } from "@/lib/platform/data";

export interface QuoteApprovalPolicy extends OrganizationScope {
  id: string;
  enabled: boolean;
  alwaysRequireApproval: boolean;
  discountThresholdCents?: number;
  version: number;
}

export interface SaveQuoteApprovalPolicyRequest extends OrganizationScope {
  actor: AuthorizationActor;
  correlationId: string;
  enabled: boolean;
  alwaysRequireApproval: boolean;
  discountThresholdCents?: number;
  expectedVersion?: number;
}

export interface QuoteApprovalPolicyProvider {
  get(scope: OrganizationScope): Promise<QuoteApprovalPolicy | null>;
  create(context: RequestContext, policy: QuoteApprovalPolicy): Promise<QuoteApprovalPolicy>;
  update(
    context: RequestContext,
    policy: QuoteApprovalPolicy,
    expectedVersion: number,
  ): Promise<QuoteApprovalPolicy>;
}

export class QuoteApprovalPolicyValidationError extends Error {
  constructor(readonly issues: readonly string[]) {
    super("Quote approval policy is invalid.");
    this.name = "QuoteApprovalPolicyValidationError";
  }
}

export class QuoteApprovalPolicyConflictError extends Error {
  constructor() {
    super("The quote approval policy changed before this update could be saved.");
    this.name = "QuoteApprovalPolicyConflictError";
  }
}

export class QuoteApprovalPolicyService {
  constructor(private readonly provider: QuoteApprovalPolicyProvider) {}

  async read(
    actor: AuthorizationActor,
    scope: OrganizationScope,
  ): Promise<QuoteApprovalPolicy | null> {
    assertAuthorized(actor, {
      capability: "organization.configure",
      organizationId: scope.organizationId,
      locationId: scope.locationId,
    });
    assertAuthorized(actor, {
      capability: "quote.configure_thresholds",
      organizationId: scope.organizationId,
      locationId: scope.locationId,
    });
    return this.provider.get(scope);
  }

  async save(request: SaveQuoteApprovalPolicyRequest): Promise<QuoteApprovalPolicy> {
    validate(request);
    authorize(request);
    const existing = await this.provider.get(request);

    if (!existing) {
      if (request.expectedVersion !== undefined) throw new QuoteApprovalPolicyConflictError();
      return this.provider.create(context(request), {
        id: generateEntityId("qpl"),
        organizationId: request.organizationId,
        ...(request.locationId ? { locationId: request.locationId } : {}),
        enabled: request.enabled,
        alwaysRequireApproval: request.alwaysRequireApproval,
        ...(request.discountThresholdCents !== undefined
          ? { discountThresholdCents: request.discountThresholdCents }
          : {}),
        version: 1,
      });
    }

    if (request.expectedVersion !== existing.version) throw new QuoteApprovalPolicyConflictError();
    return this.provider.update(
      context(request),
      {
        ...existing,
        enabled: request.enabled,
        alwaysRequireApproval: request.alwaysRequireApproval,
        ...(request.discountThresholdCents !== undefined
          ? { discountThresholdCents: request.discountThresholdCents }
          : { discountThresholdCents: undefined }),
        version: existing.version + 1,
      },
      existing.version,
    );
  }
}

export function evaluateQuoteApprovalPolicy(
  policy: QuoteApprovalPolicy | null,
  quote: { discountCents: number },
): { required: boolean; reason?: "always" | "discount-threshold" } {
  if (!policy?.enabled) return { required: false };
  if (policy.alwaysRequireApproval) return { required: true, reason: "always" };
  if (
    policy.discountThresholdCents !== undefined &&
    Math.abs(Math.min(quote.discountCents, 0)) >= policy.discountThresholdCents
  ) {
    return { required: true, reason: "discount-threshold" };
  }
  return { required: false };
}

function validate(request: SaveQuoteApprovalPolicyRequest) {
  const issues: string[] = [];
  if (
    request.discountThresholdCents !== undefined &&
    (!Number.isSafeInteger(request.discountThresholdCents) || request.discountThresholdCents <= 0)
  ) {
    issues.push("discountThresholdCents must be a positive safe integer when provided.");
  }
  if (
    request.expectedVersion !== undefined &&
    (!Number.isSafeInteger(request.expectedVersion) || request.expectedVersion <= 0)
  ) {
    issues.push("expectedVersion must be a positive safe integer when provided.");
  }
  if (issues.length) throw new QuoteApprovalPolicyValidationError(issues);
}

function authorize(request: SaveQuoteApprovalPolicyRequest) {
  assertAuthorized(request.actor, {
    capability: "organization.configure",
    organizationId: request.organizationId,
    locationId: request.locationId,
  });
  assertAuthorized(request.actor, {
    capability: "quote.configure_thresholds",
    organizationId: request.organizationId,
    locationId: request.locationId,
  });
}

function context(request: SaveQuoteApprovalPolicyRequest): RequestContext {
  return {
    actorId: request.actor.userId,
    organizationId: request.organizationId,
    correlationId: request.correlationId,
    ...(request.locationId ? { locationId: request.locationId } : {}),
  };
}
