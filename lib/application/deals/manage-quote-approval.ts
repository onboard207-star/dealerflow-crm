import { generateEntityId } from "@/lib/core/identifiers";
import { assertAuthorized, type AuthorizationActor } from "@/lib/platform/auth";
import type { OrganizationScope, RequestContext } from "@/lib/platform/data";
import type { DealStatus } from "./manage-deal";
import type { QuoteStatus } from "./manage-quote";

export type QuoteApprovalStatus = "pending" | "approved" | "declined";
export type QuoteApprovalDecision = Exclude<QuoteApprovalStatus, "pending">;

export interface QuoteApprovalRecord extends OrganizationScope {
  id: string;
  quoteId: string;
  status: QuoteApprovalStatus;
  requestReason?: string;
  decisionReason?: string;
  requestedBy: string;
  requestedAt: string;
  decidedBy?: string;
  decidedAt?: string;
  requestIdempotencyKey: string;
  decisionIdempotencyKey?: string;
}

export interface RequestQuoteApprovalRequest extends OrganizationScope {
  actor: AuthorizationActor;
  correlationId: string;
  idempotencyKey: string;
  quoteId: string;
  reason?: string;
}

export interface DecideQuoteApprovalRequest extends OrganizationScope {
  actor: AuthorizationActor;
  correlationId: string;
  idempotencyKey: string;
  approvalId: string;
  decision: QuoteApprovalDecision;
  reason?: string;
}

export interface QuoteApprovalSession {
  acquireLock(scope: OrganizationScope, key: string): Promise<void>;
  findRequestByIdempotency(scope: OrganizationScope, key: string): Promise<QuoteApprovalRecord | null>;
  getQuoteForApproval(
    scope: OrganizationScope,
    quoteId: string,
  ): Promise<{ quoteStatus: QuoteStatus; dealStatus: DealStatus; locationId: string } | null>;
  getApprovalForQuote(scope: OrganizationScope, quoteId: string): Promise<QuoteApprovalRecord | null>;
  createApproval(context: RequestContext, approval: QuoteApprovalRecord): Promise<QuoteApprovalRecord>;
  findDecisionByIdempotency(scope: OrganizationScope, key: string): Promise<QuoteApprovalRecord | null>;
  getApprovalForUpdate(
    scope: OrganizationScope,
    approvalId: string,
  ): Promise<{ approval: QuoteApprovalRecord; quoteStatus: QuoteStatus; dealStatus: DealStatus; locationId: string } | null>;
  decideApproval(context: RequestContext, approval: QuoteApprovalRecord): Promise<QuoteApprovalRecord>;
}

export interface QuoteApprovalProvider {
  transaction<Result>(operation: (session: QuoteApprovalSession) => Promise<Result>): Promise<Result>;
}

export class QuoteApprovalValidationError extends Error {
  constructor(readonly issues: readonly string[]) {
    super("Quote approval data is invalid.");
    this.name = "QuoteApprovalValidationError";
  }
}

export class QuoteApprovalIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuoteApprovalIntegrityError";
  }
}

export class QuoteApprovalService {
  constructor(
    private readonly provider: QuoteApprovalProvider,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async request(
    request: RequestQuoteApprovalRequest,
  ): Promise<{ approval: QuoteApprovalRecord; created: boolean }> {
    validateRequest(request);
    authorize(request.actor, request.organizationId, request.locationId, "quote.request_approval");

    return this.provider.transaction(async (session) => {
      await session.acquireLock(request, request.idempotencyKey);
      const retry = await session.findRequestByIdempotency(request, request.idempotencyKey);
      if (retry) {
        authorize(request.actor, request.organizationId, retry.locationId, "quote.request_approval");
        return { approval: retry, created: false };
      }

      await session.acquireLock(request, `quote-approval:${request.quoteId}`);
      const quote = await session.getQuoteForApproval(request, request.quoteId);
      if (!quote) throw new QuoteApprovalIntegrityError("The quote is unavailable.");
      authorize(request.actor, request.organizationId, quote.locationId, "quote.request_approval");
      if (quote.quoteStatus !== "draft") {
        throw new QuoteApprovalIntegrityError("Only a draft quote can be submitted for approval.");
      }
      if (["contracted", "delivered", "cancelled"].includes(quote.dealStatus)) {
        throw new QuoteApprovalIntegrityError("The deal no longer accepts quote approval requests.");
      }
      if (await session.getApprovalForQuote(request, request.quoteId)) {
        throw new QuoteApprovalIntegrityError(
          "This quote version already has an approval lifecycle. Create a revised quote version before resubmitting.",
        );
      }

      const approval: QuoteApprovalRecord = {
        id: generateEntityId("qap"),
        organizationId: request.organizationId,
        locationId: quote.locationId,
        quoteId: request.quoteId,
        status: "pending",
        ...(request.reason?.trim() ? { requestReason: request.reason.trim() } : {}),
        requestedBy: request.actor.userId,
        requestedAt: this.now().toISOString(),
        requestIdempotencyKey: request.idempotencyKey,
      };
      return { approval: await session.createApproval(context(request), approval), created: true };
    });
  }

  async decide(
    request: DecideQuoteApprovalRequest,
  ): Promise<{ approval: QuoteApprovalRecord; decided: boolean }> {
    validateDecision(request);
    authorize(request.actor, request.organizationId, request.locationId, "quote.approve");

    return this.provider.transaction(async (session) => {
      await session.acquireLock(request, request.idempotencyKey);
      const retry = await session.findDecisionByIdempotency(request, request.idempotencyKey);
      if (retry) {
        authorize(request.actor, request.organizationId, retry.locationId, "quote.approve");
        return { approval: retry, decided: false };
      }

      const resolved = await session.getApprovalForUpdate(request, request.approvalId);
      if (!resolved) throw new QuoteApprovalIntegrityError("The quote approval is unavailable.");
      authorize(request.actor, request.organizationId, resolved.locationId, "quote.approve");
      if (resolved.approval.status !== "pending") {
        throw new QuoteApprovalIntegrityError("This quote approval already has a terminal decision.");
      }
      if (resolved.approval.requestedBy === request.actor.userId) {
        throw new QuoteApprovalIntegrityError("A quote approval requester cannot approve or decline their own request.");
      }
      if (resolved.quoteStatus !== "draft") {
        throw new QuoteApprovalIntegrityError("Only a draft quote can receive an internal approval decision.");
      }
      if (["contracted", "delivered", "cancelled"].includes(resolved.dealStatus)) {
        throw new QuoteApprovalIntegrityError("The deal no longer accepts quote approval decisions.");
      }

      const now = this.now().toISOString();
      const approval: QuoteApprovalRecord = {
        ...resolved.approval,
        status: request.decision,
        ...(request.reason?.trim() ? { decisionReason: request.reason.trim() } : {}),
        decidedBy: request.actor.userId,
        decidedAt: now,
        decisionIdempotencyKey: request.idempotencyKey,
      };
      return { approval: await session.decideApproval(context(request), approval), decided: true };
    });
  }
}

function validateRequest(request: RequestQuoteApprovalRequest) {
  const issues: string[] = [];
  if (!request.quoteId.trim()) issues.push("quoteId is required.");
  if (!request.idempotencyKey.trim()) issues.push("idempotencyKey is required.");
  if (request.reason && request.reason.trim().length > 1000) issues.push("reason must not exceed 1000 characters.");
  if (issues.length) throw new QuoteApprovalValidationError(issues);
}

function validateDecision(request: DecideQuoteApprovalRequest) {
  const issues: string[] = [];
  if (!request.approvalId.trim()) issues.push("approvalId is required.");
  if (!request.idempotencyKey.trim()) issues.push("idempotencyKey is required.");
  if (request.reason && request.reason.trim().length > 1000) issues.push("reason must not exceed 1000 characters.");
  if (request.decision === "declined" && !request.reason?.trim()) issues.push("reason is required when declining approval.");
  if (issues.length) throw new QuoteApprovalValidationError(issues);
}

function authorize(
  actor: AuthorizationActor,
  organizationId: string,
  locationId: string | undefined,
  capability: "quote.request_approval" | "quote.approve",
) {
  assertAuthorized(actor, { capability: "deal.read", organizationId, locationId });
  assertAuthorized(actor, { capability, organizationId, locationId });
}

function context(request: {
  actor: AuthorizationActor;
  organizationId: string;
  correlationId: string;
  locationId?: string;
}): RequestContext {
  return {
    actorId: request.actor.userId,
    organizationId: request.organizationId,
    correlationId: request.correlationId,
    ...(request.locationId ? { locationId: request.locationId } : {}),
  };
}
