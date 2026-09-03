import { describe, expect, it } from "vitest";
import { AuthorizationError, type AuthorizationActor } from "@/lib/platform/auth";
import type { RequestContext } from "@/lib/platform/data";
import {
  QuoteApprovalPolicyConflictError,
  QuoteApprovalPolicyService,
  QuoteApprovalPolicyValidationError,
  evaluateQuoteApprovalPolicy,
  type QuoteApprovalPolicy,
  type QuoteApprovalPolicyProvider,
  type SaveQuoteApprovalPolicyRequest,
} from "./manage-quote-approval-policy";

class MemoryProvider implements QuoteApprovalPolicyProvider {
  policy: QuoteApprovalPolicy | null = null;
  async get() { return this.policy; }
  async create(_context: RequestContext, policy: QuoteApprovalPolicy) {
    this.policy = policy;
    return policy;
  }
  async update(_context: RequestContext, policy: QuoteApprovalPolicy, expectedVersion: number) {
    if (this.policy?.version !== expectedVersion) throw new QuoteApprovalPolicyConflictError();
    this.policy = policy;
    return policy;
  }
}

const actor = (
  capabilities: AuthorizationActor["memberships"][number]["capabilities"],
): AuthorizationActor => ({
  userId: "usr_admin",
  memberships: [
    { organizationId: "org_dealerflow", locationIds: "all", capabilities },
  ],
});

const admin = actor(["organization.configure", "quote.configure_thresholds"]);
const request = (
  overrides: Partial<SaveQuoteApprovalPolicyRequest> = {},
): SaveQuoteApprovalPolicyRequest => ({
  actor: admin,
  organizationId: "org_dealerflow",
  correlationId: "req_policy",
  enabled: true,
  alwaysRequireApproval: false,
  discountThresholdCents: 100000,
  ...overrides,
});

describe("QuoteApprovalPolicyService", () => {
  it("creates a versioned organization policy", async () => {
    const service = new QuoteApprovalPolicyService(new MemoryProvider());
    const policy = await service.save(request());
    expect(policy).toMatchObject({
      version: 1,
      enabled: true,
      discountThresholdCents: 100000,
    });
  });

  it("updates with optimistic concurrency", async () => {
    const provider = new MemoryProvider();
    const service = new QuoteApprovalPolicyService(provider);
    await service.save(request());
    const updated = await service.save(
      request({ expectedVersion: 1, discountThresholdCents: 150000 }),
    );
    expect(updated.version).toBe(2);
    await expect(
      service.save(request({ expectedVersion: 1 })),
    ).rejects.toBeInstanceOf(QuoteApprovalPolicyConflictError);
  });

  it("requires both organization configuration and threshold capability", async () => {
    const service = new QuoteApprovalPolicyService(new MemoryProvider());
    await expect(
      service.save(request({ actor: actor(["organization.configure"]) })),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      service.save(request({ actor: actor(["quote.configure_thresholds"]) })),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("rejects nonpositive discount thresholds", async () => {
    const service = new QuoteApprovalPolicyService(new MemoryProvider());
    await expect(
      service.save(request({ discountThresholdCents: 0 })),
    ).rejects.toBeInstanceOf(QuoteApprovalPolicyValidationError);
  });
});

describe("evaluateQuoteApprovalPolicy", () => {
  const policy = (
    overrides: Partial<QuoteApprovalPolicy> = {},
  ): QuoteApprovalPolicy => ({
    id: "qpl_12345678",
    organizationId: "org_dealerflow",
    enabled: true,
    alwaysRequireApproval: false,
    version: 1,
    ...overrides,
  });

  it("defaults to no mandatory approval when no policy is configured", () => {
    expect(evaluateQuoteApprovalPolicy(null, { discountCents: -500000 })).toEqual({
      required: false,
    });
  });

  it("can require approval for every quote", () => {
    expect(
      evaluateQuoteApprovalPolicy(policy({ alwaysRequireApproval: true }), {
        discountCents: 0,
      }),
    ).toEqual({ required: true, reason: "always" });
  });

  it("requires approval when the configured discount threshold is met", () => {
    expect(
      evaluateQuoteApprovalPolicy(policy({ discountThresholdCents: 100000 }), {
        discountCents: -100000,
      }),
    ).toEqual({ required: true, reason: "discount-threshold" });
  });

  it("does not require approval below the configured discount threshold", () => {
    expect(
      evaluateQuoteApprovalPolicy(policy({ discountThresholdCents: 100000 }), {
        discountCents: -99999,
      }),
    ).toEqual({ required: false });
  });
});
