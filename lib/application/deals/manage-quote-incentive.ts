import { generateEntityId } from "@/lib/core/identifiers";
import { assertAuthorized, type AuthorizationActor } from "@/lib/platform/auth";
import type { OrganizationScope, RequestContext } from "@/lib/platform/data";

export type IncentiveEligibilityStatus = "pending" | "verified" | "ineligible";

export interface QuoteIncentiveApplication extends OrganizationScope {
  id: string;
  quoteId: string;
  quoteLineId: string;
  programId: string;
  amountCents: number;
  eligibilityStatus: IncentiveEligibilityStatus;
  eligibilityBasis?: string;
  verifiedBy?: string;
  verifiedAt?: string;
}

export interface CreateQuoteIncentiveRequest extends OrganizationScope {
  actor: AuthorizationActor;
  correlationId: string;
  quoteId: string;
  quoteLineId: string;
  programId: string;
  amountCents: number;
}

export interface DecideQuoteIncentiveRequest extends OrganizationScope {
  actor: AuthorizationActor;
  correlationId: string;
  applicationId: string;
  decision: "verified" | "ineligible";
  eligibilityBasis: string;
}

export interface QuoteIncentiveSession {
  getQuoteLineContext(
    scope: OrganizationScope,
    quoteId: string,
    quoteLineId: string,
  ): Promise<{
    quoteStatus: string;
    locationId: string;
    category: string;
    lineTotalCents: number;
  } | null>;
  getProgram(
    scope: OrganizationScope,
    programId: string,
  ): Promise<{
    active: boolean;
    locationId?: string;
    startsAt?: string;
    endsAt?: string;
  } | null>;
  createApplication(
    context: RequestContext,
    application: QuoteIncentiveApplication,
  ): Promise<QuoteIncentiveApplication>;
  getApplicationForUpdate(
    scope: OrganizationScope,
    applicationId: string,
  ): Promise<(QuoteIncentiveApplication & { quoteStatus: string; locationId: string }) | null>;
  decideApplication(
    context: RequestContext,
    application: QuoteIncentiveApplication,
  ): Promise<QuoteIncentiveApplication>;
}

export interface QuoteIncentiveProvider {
  transaction<Result>(
    operation: (session: QuoteIncentiveSession) => Promise<Result>,
  ): Promise<Result>;
}

export class QuoteIncentiveValidationError extends Error {
  constructor(readonly issues: readonly string[]) {
    super("Quote incentive data is invalid.");
    this.name = "QuoteIncentiveValidationError";
  }
}

export class QuoteIncentiveIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuoteIncentiveIntegrityError";
  }
}

export class QuoteIncentiveService {
  constructor(
    private readonly provider: QuoteIncentiveProvider,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async create(request: CreateQuoteIncentiveRequest) {
    validateCreate(request);
    authorize(request.actor, request.organizationId, request.locationId, "quote.revise");

    return this.provider.transaction(async (session) => {
      const line = await session.getQuoteLineContext(
        request,
        request.quoteId,
        request.quoteLineId,
      );
      if (!line) throw new QuoteIncentiveIntegrityError("The Quote discount line is unavailable.");
      authorize(request.actor, request.organizationId, line.locationId, "quote.revise");
      if (line.quoteStatus !== "draft") {
        throw new QuoteIncentiveIntegrityError(
          "Incentive provenance can only be attached to a draft Quote version.",
        );
      }
      if (line.category !== "discount" || line.lineTotalCents !== -request.amountCents) {
        throw new QuoteIncentiveIntegrityError(
          "The incentive amount must exactly match one Quote discount line.",
        );
      }

      const program = await session.getProgram(request, request.programId);
      if (!program?.active) {
        throw new QuoteIncentiveIntegrityError("The incentive program is unavailable or inactive.");
      }
      if (program.locationId && program.locationId !== line.locationId) {
        throw new QuoteIncentiveIntegrityError(
          "The incentive program does not apply to this dealership location.",
        );
      }
      const now = this.now();
      if (program.startsAt && now < new Date(program.startsAt)) {
        throw new QuoteIncentiveIntegrityError("The incentive program has not started.");
      }
      if (program.endsAt && now >= new Date(program.endsAt)) {
        throw new QuoteIncentiveIntegrityError("The incentive program has expired.");
      }

      const application: QuoteIncentiveApplication = {
        id: generateEntityId("qia"),
        organizationId: request.organizationId,
        locationId: line.locationId,
        quoteId: request.quoteId,
        quoteLineId: request.quoteLineId,
        programId: request.programId,
        amountCents: request.amountCents,
        eligibilityStatus: "pending",
      };
      return session.createApplication(context(request), application);
    });
  }

  async decide(request: DecideQuoteIncentiveRequest) {
    validateDecision(request);
    authorize(request.actor, request.organizationId, request.locationId, "quote.approve");

    return this.provider.transaction(async (session) => {
      const resolved = await session.getApplicationForUpdate(request, request.applicationId);
      if (!resolved) throw new QuoteIncentiveIntegrityError("The incentive application is unavailable.");
      authorize(request.actor, request.organizationId, resolved.locationId, "quote.approve");
      if (resolved.quoteStatus !== "draft") {
        throw new QuoteIncentiveIntegrityError(
          "Incentive eligibility can only be decided while the Quote is draft.",
        );
      }
      if (resolved.eligibilityStatus !== "pending") {
        throw new QuoteIncentiveIntegrityError(
          "This incentive eligibility decision is already final.",
        );
      }
      const application: QuoteIncentiveApplication = {
        ...resolved,
        eligibilityStatus: request.decision,
        eligibilityBasis: request.eligibilityBasis.trim(),
        verifiedBy: request.actor.userId,
        verifiedAt: this.now().toISOString(),
      };
      return session.decideApplication(context(request), application);
    });
  }
}

function validateCreate(request: CreateQuoteIncentiveRequest) {
  const issues: string[] = [];
  if (!request.quoteId.trim()) issues.push("quoteId is required.");
  if (!request.quoteLineId.trim()) issues.push("quoteLineId is required.");
  if (!request.programId.trim()) issues.push("programId is required.");
  if (!Number.isSafeInteger(request.amountCents) || request.amountCents <= 0) {
    issues.push("amountCents must be a positive safe integer.");
  }
  if (issues.length) throw new QuoteIncentiveValidationError(issues);
}

function validateDecision(request: DecideQuoteIncentiveRequest) {
  const issues: string[] = [];
  if (!request.applicationId.trim()) issues.push("applicationId is required.");
  if (!request.eligibilityBasis.trim()) issues.push("eligibilityBasis is required.");
  if (request.eligibilityBasis.trim().length > 1000) {
    issues.push("eligibilityBasis must not exceed 1000 characters.");
  }
  if (issues.length) throw new QuoteIncentiveValidationError(issues);
}

function authorize(
  actor: AuthorizationActor,
  organizationId: string,
  locationId: string | undefined,
  capability: "quote.revise" | "quote.approve",
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
