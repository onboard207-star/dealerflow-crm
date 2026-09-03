import { describe, expect, it } from "vitest";
import { AuthorizationError, type AuthorizationActor } from "@/lib/platform/auth";
import type { RequestContext } from "@/lib/platform/data";
import {
  QuoteApprovalIntegrityError,
  QuoteApprovalService,
  QuoteApprovalValidationError,
  type DecideQuoteApprovalRequest,
  type QuoteApprovalProvider,
  type QuoteApprovalRecord,
  type QuoteApprovalSession,
  type RequestQuoteApprovalRequest,
} from "./manage-quote-approval";

class MemoryProvider implements QuoteApprovalProvider, QuoteApprovalSession {
  approval: QuoteApprovalRecord | null = null;
  quoteStatus = "draft" as const;
  dealStatus = "working" as const;
  locationId = "loc_main";

  async transaction<Result>(operation: (session: QuoteApprovalSession) => Promise<Result>) {
    return operation(this);
  }
  async acquireLock() {}
  async findRequestByIdempotency(scope: { organizationId: string }, key: string) {
    return this.approval?.organizationId === scope.organizationId &&
      this.approval.requestIdempotencyKey === key
      ? this.approval
      : null;
  }
  async getQuoteForApproval() {
    return { quoteStatus: this.quoteStatus, dealStatus: this.dealStatus, locationId: this.locationId };
  }
  async getApprovalForQuote() {
    return this.approval;
  }
  async createApproval(_context: RequestContext, approval: QuoteApprovalRecord) {
    this.approval = approval;
    return approval;
  }
  async findDecisionByIdempotency(scope: { organizationId: string }, key: string) {
    return this.approval?.organizationId === scope.organizationId &&
      this.approval.decisionIdempotencyKey === key
      ? this.approval
      : null;
  }
  async getApprovalForUpdate() {
    return this.approval
      ? {
          approval: this.approval,
          quoteStatus: this.quoteStatus,
          dealStatus: this.dealStatus,
          locationId: this.locationId,
        }
      : null;
  }
  async decideApproval(_context: RequestContext, approval: QuoteApprovalRecord) {
    this.approval = approval;
    return approval;
  }
}

const actor = (
  userId: string,
  capabilities: AuthorizationActor["memberships"][number]["capabilities"],
  locationIds: readonly string[] | "all" = ["loc_main"],
): AuthorizationActor => ({
  userId,
  memberships: [{ organizationId: "org_dealerflow", locationIds, capabilities }],
});

const requester = actor("usr_sales", ["deal.read", "quote.request_approval"]);
const manager = actor("usr_manager", ["deal.read", "quote.approve"]);

const requestApproval = (
  overrides: Partial<RequestQuoteApprovalRequest> = {},
): RequestQuoteApprovalRequest => ({
  actor: requester,
  organizationId: "org_dealerflow",
  correlationId: "req_quote_approval",
  idempotencyKey: "approval:quote-1",
  quoteId: "quo_12345678",
  reason: "Discount requires manager review.",
  ...overrides,
});

const decideApproval = (
  approvalId: string,
  decision: DecideQuoteApprovalRequest["decision"],
  overrides: Partial<DecideQuoteApprovalRequest> = {},
): DecideQuoteApprovalRequest => ({
  actor: manager,
  organizationId: "org_dealerflow",
  correlationId: "req_quote_decision",
  idempotencyKey: `approval:${decision}`,
  approvalId,
  decision,
  ...overrides,
});

describe("QuoteApprovalService", () => {
  it("creates one idempotent pending approval per immutable quote version", async () => {
    const provider = new MemoryProvider();
    const service = new QuoteApprovalService(provider, () => new Date("2026-09-02T18:00:00.000Z"));
    const first = await service.request(requestApproval());
    const retry = await service.request(requestApproval());
    expect(first.created).toBe(true);
    expect(retry.created).toBe(false);
    expect(first.approval).toMatchObject({
      quoteId: "quo_12345678",
      status: "pending",
      requestedBy: "usr_sales",
      requestedAt: "2026-09-02T18:00:00.000Z",
    });
  });

  it("requires a new quote version after an approval lifecycle already exists", async () => {
    const provider = new MemoryProvider();
    const service = new QuoteApprovalService(provider);
    await service.request(requestApproval());
    await expect(
      service.request(requestApproval({ idempotencyKey: "approval:quote-1:second" })),
    ).rejects.toBeInstanceOf(QuoteApprovalIntegrityError);
  });

  it("requires dedicated request capability independent of deal update", async () => {
    const service = new QuoteApprovalService(new MemoryProvider());
    const genericDealActor = actor("usr_sales", ["deal.read", "deal.update", "deal.approve"]);
    await expect(
      service.request(requestApproval({ actor: genericDealActor })),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("allows an independent manager to approve a pending request", async () => {
    const provider = new MemoryProvider();
    const service = new QuoteApprovalService(provider, () => new Date("2026-09-02T18:15:00.000Z"));
    const { approval } = await service.request(requestApproval());
    const result = await service.decide(decideApproval(approval.id, "approved"));
    expect(result.decided).toBe(true);
    expect(result.approval).toMatchObject({
      status: "approved",
      decidedBy: "usr_manager",
      decidedAt: "2026-09-02T18:15:00.000Z",
    });
  });

  it("blocks self-approval even when the requester also holds manager capability", async () => {
    const provider = new MemoryProvider();
    const dualRole = actor("usr_dual", ["deal.read", "quote.request_approval", "quote.approve"]);
    const service = new QuoteApprovalService(provider);
    const { approval } = await service.request(requestApproval({ actor: dualRole }));
    await expect(
      service.decide(decideApproval(approval.id, "approved", { actor: dualRole })),
    ).rejects.toBeInstanceOf(QuoteApprovalIntegrityError);
  });

  it("requires a reason when a manager declines the quote", async () => {
    const provider = new MemoryProvider();
    const service = new QuoteApprovalService(provider);
    const { approval } = await service.request(requestApproval());
    await expect(
      service.decide(decideApproval(approval.id, "declined", { reason: " " })),
    ).rejects.toBeInstanceOf(QuoteApprovalValidationError);
  });

  it("enforces the quote's persisted dealership location", async () => {
    const service = new QuoteApprovalService(new MemoryProvider());
    const otherLocation = actor("usr_sales", ["deal.read", "quote.request_approval"], ["loc_other"]);
    await expect(
      service.request(requestApproval({ actor: otherLocation })),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });
});
