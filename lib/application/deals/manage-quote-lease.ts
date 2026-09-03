import { assertAuthorized, type AuthorizationActor } from "@/lib/platform/auth";
import type { OrganizationScope, RequestContext } from "@/lib/platform/data";

export type LeaseTermSourceType =
  | "manual-entry"
  | "lender-quote"
  | "oem-program"
  | "dealer-program";

export interface QuoteLeaseTerms extends OrganizationScope {
  quoteId: string;
  adjustedCapCostCents: number;
  residualValueCents: number;
  moneyFactorPpm: number;
  termMonths: number;
  annualMileage?: number;
  acquisitionFeeCents: number;
  capCostReductionCents: number;
  rebateCents: number;
  basePaymentCents: number;
  sourceType: LeaseTermSourceType;
  sourceLabel: string;
  sourceReference?: string;
  capturedAt: string;
}

export interface CreateQuoteLeaseTermsRequest extends OrganizationScope {
  actor: AuthorizationActor;
  correlationId: string;
  quoteId: string;
  adjustedCapCostCents: number;
  residualValueCents: number;
  moneyFactorPpm: number;
  termMonths: number;
  annualMileage?: number;
  acquisitionFeeCents?: number;
  capCostReductionCents?: number;
  rebateCents?: number;
  sourceType: LeaseTermSourceType;
  sourceLabel: string;
  sourceReference?: string;
}

export interface QuoteLeaseTermsSession {
  getQuoteForLease(
    scope: OrganizationScope,
    quoteId: string,
  ): Promise<{
    status: string;
    purchaseType: "cash" | "finance" | "lease";
    locationId: string;
  } | null>;
  leaseTermsExist(scope: OrganizationScope, quoteId: string): Promise<boolean>;
  createLeaseTerms(
    context: RequestContext,
    terms: QuoteLeaseTerms,
  ): Promise<QuoteLeaseTerms>;
}

export interface QuoteLeaseTermsProvider {
  transaction<Result>(
    operation: (session: QuoteLeaseTermsSession) => Promise<Result>,
  ): Promise<Result>;
}

export class QuoteLeaseValidationError extends Error {
  constructor(readonly issues: readonly string[]) {
    super("Quote lease terms are invalid.");
    this.name = "QuoteLeaseValidationError";
  }
}

export class QuoteLeaseIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuoteLeaseIntegrityError";
  }
}

export class QuoteLeaseTermsService {
  constructor(
    private readonly provider: QuoteLeaseTermsProvider,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async create(request: CreateQuoteLeaseTermsRequest): Promise<QuoteLeaseTerms> {
    validate(request);
    authorize(request.actor, request.organizationId, request.locationId);

    return this.provider.transaction(async (session) => {
      const quote = await session.getQuoteForLease(request, request.quoteId);
      if (!quote) throw new QuoteLeaseIntegrityError("The Quote is unavailable.");
      authorize(request.actor, request.organizationId, quote.locationId);
      if (quote.purchaseType !== "lease") {
        throw new QuoteLeaseValidationError([
          "Lease terms can only be attached to a lease Quote.",
        ]);
      }
      if (quote.status !== "draft") {
        throw new QuoteLeaseIntegrityError(
          "Lease terms can only be attached to a draft Quote version.",
        );
      }
      if (await session.leaseTermsExist(request, request.quoteId)) {
        throw new QuoteLeaseIntegrityError(
          "This Quote version already has lease terms. Create a revised Quote version to change them.",
        );
      }

      const acquisitionFeeCents = request.acquisitionFeeCents ?? 0;
      const capCostReductionCents = request.capCostReductionCents ?? 0;
      const rebateCents = request.rebateCents ?? 0;
      const effectiveCapCost =
        request.adjustedCapCostCents +
        acquisitionFeeCents -
        capCostReductionCents -
        rebateCents;
      if (effectiveCapCost < 0) {
        throw new QuoteLeaseValidationError([
          "Lease cap cost reductions and rebates cannot reduce effective cap cost below zero.",
        ]);
      }
      if (request.residualValueCents > effectiveCapCost) {
        throw new QuoteLeaseValidationError([
          "Residual value cannot exceed effective capitalized cost.",
        ]);
      }

      const terms: QuoteLeaseTerms = {
        quoteId: request.quoteId,
        organizationId: request.organizationId,
        locationId: quote.locationId,
        adjustedCapCostCents: request.adjustedCapCostCents,
        residualValueCents: request.residualValueCents,
        moneyFactorPpm: request.moneyFactorPpm,
        termMonths: request.termMonths,
        ...(request.annualMileage !== undefined
          ? { annualMileage: request.annualMileage }
          : {}),
        acquisitionFeeCents,
        capCostReductionCents,
        rebateCents,
        basePaymentCents: calculateLeaseBasePaymentCents({
          adjustedCapCostCents: request.adjustedCapCostCents,
          residualValueCents: request.residualValueCents,
          moneyFactorPpm: request.moneyFactorPpm,
          termMonths: request.termMonths,
          acquisitionFeeCents,
          capCostReductionCents,
          rebateCents,
        }),
        sourceType: request.sourceType,
        sourceLabel: request.sourceLabel.trim(),
        ...(request.sourceReference?.trim()
          ? { sourceReference: request.sourceReference.trim() }
          : {}),
        capturedAt: this.now().toISOString(),
      };
      return session.createLeaseTerms(context(request), terms);
    });
  }
}

export function calculateLeaseBasePaymentCents(input: {
  adjustedCapCostCents: number;
  residualValueCents: number;
  moneyFactorPpm: number;
  termMonths: number;
  acquisitionFeeCents?: number;
  capCostReductionCents?: number;
  rebateCents?: number;
}) {
  const acquisitionFeeCents = input.acquisitionFeeCents ?? 0;
  const capCostReductionCents = input.capCostReductionCents ?? 0;
  const rebateCents = input.rebateCents ?? 0;
  const effectiveCapCostCents =
    input.adjustedCapCostCents +
    acquisitionFeeCents -
    capCostReductionCents -
    rebateCents;
  const depreciationCents =
    (effectiveCapCostCents - input.residualValueCents) / input.termMonths;
  const moneyFactor = input.moneyFactorPpm / 1_000_000;
  const financeChargeCents =
    (effectiveCapCostCents + input.residualValueCents) * moneyFactor;
  return Math.round(depreciationCents + financeChargeCents);
}

function validate(request: CreateQuoteLeaseTermsRequest) {
  const issues: string[] = [];
  for (const [label, value] of [
    ["adjustedCapCostCents", request.adjustedCapCostCents],
    ["residualValueCents", request.residualValueCents],
    ["moneyFactorPpm", request.moneyFactorPpm],
    ["termMonths", request.termMonths],
    ["acquisitionFeeCents", request.acquisitionFeeCents ?? 0],
    ["capCostReductionCents", request.capCostReductionCents ?? 0],
    ["rebateCents", request.rebateCents ?? 0],
  ] as const) {
    if (!Number.isSafeInteger(value) || value < 0) {
      issues.push(`${label} must be a nonnegative safe integer.`);
    }
  }
  if (request.moneyFactorPpm > 100000) issues.push("moneyFactorPpm is too large.");
  if (request.termMonths < 1 || request.termMonths > 60) {
    issues.push("termMonths must be between 1 and 60.");
  }
  if (
    request.annualMileage !== undefined &&
    (!Number.isSafeInteger(request.annualMileage) || request.annualMileage <= 0)
  ) {
    issues.push("annualMileage must be a positive whole number.");
  }
  if (!request.sourceLabel.trim()) issues.push("lease sourceLabel is required.");
  if (request.sourceLabel.trim().length > 200) {
    issues.push("lease sourceLabel must not exceed 200 characters.");
  }
  if ((request.sourceReference?.length ?? 0) > 500) {
    issues.push("lease sourceReference must not exceed 500 characters.");
  }
  if (issues.length) throw new QuoteLeaseValidationError(issues);
}

function authorize(
  actor: AuthorizationActor,
  organizationId: string,
  locationId: string | undefined,
) {
  assertAuthorized(actor, { capability: "deal.read", organizationId, locationId });
  assertAuthorized(actor, { capability: "quote.revise", organizationId, locationId });
}

function context(request: CreateQuoteLeaseTermsRequest): RequestContext {
  return {
    actorId: request.actor.userId,
    organizationId: request.organizationId,
    correlationId: request.correlationId,
    ...(request.locationId ? { locationId: request.locationId } : {}),
  };
}
