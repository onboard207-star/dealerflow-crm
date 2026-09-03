import { assertAuthorized, type AuthorizationActor } from "@/lib/platform/auth";
import type { OrganizationScope, RequestContext } from "@/lib/platform/data";

export type FinanceTermSourceType =
  | "manual-entry"
  | "lender-quote"
  | "oem-program"
  | "dealer-program";

export interface QuoteCommercialTerms extends OrganizationScope {
  quoteId: string;
  tradeAppraisalId?: string;
  tradeAllowanceCents: number;
  tradePayoffCents: number;
  tradeEquityCents: number;
  cashDownCents: number;
  amountFinancedCents?: number;
}

export interface QuoteFinanceTerms extends OrganizationScope {
  quoteId: string;
  aprBasisPoints: number;
  termMonths: number;
  estimatedPaymentCents: number;
  sourceType: FinanceTermSourceType;
  sourceLabel: string;
  sourceReference?: string;
  capturedAt: string;
}

export interface CreateQuoteTermsRequest extends OrganizationScope {
  actor: AuthorizationActor;
  correlationId: string;
  quoteId: string;
  cashDownCents?: number;
  tradeAppraisalId?: string;
  finance?: {
    aprBasisPoints: number;
    termMonths: number;
    sourceType: FinanceTermSourceType;
    sourceLabel: string;
    sourceReference?: string;
  };
}

export interface QuoteTermsSession {
  getQuoteForTerms(
    scope: OrganizationScope,
    quoteId: string,
  ): Promise<{
    status: string;
    purchaseType: "cash" | "finance" | "lease";
    totalCents: number;
    dealId: string;
    locationId: string;
  } | null>;
  getAcceptedTradeAppraisal(
    scope: OrganizationScope,
    dealId: string,
    appraisalId: string,
  ): Promise<{
    id: string;
    allowanceCents: number;
    payoffCents: number;
    equityCents: number;
  } | null>;
  termsExist(scope: OrganizationScope, quoteId: string): Promise<boolean>;
  createTerms(
    context: RequestContext,
    commercial: QuoteCommercialTerms,
    finance?: QuoteFinanceTerms,
  ): Promise<{ commercial: QuoteCommercialTerms; finance?: QuoteFinanceTerms }>;
}

export interface QuoteTermsProvider {
  transaction<Result>(operation: (session: QuoteTermsSession) => Promise<Result>): Promise<Result>;
}

export class QuoteTermsValidationError extends Error {
  constructor(readonly issues: readonly string[]) {
    super("Quote commercial or finance terms are invalid.");
    this.name = "QuoteTermsValidationError";
  }
}

export class QuoteTermsIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuoteTermsIntegrityError";
  }
}

export class QuoteTermsService {
  constructor(
    private readonly provider: QuoteTermsProvider,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async create(
    request: CreateQuoteTermsRequest,
  ): Promise<{ commercial: QuoteCommercialTerms; finance?: QuoteFinanceTerms }> {
    validate(request);
    authorize(request.actor, request.organizationId, request.locationId);

    return this.provider.transaction(async (session) => {
      const quote = await session.getQuoteForTerms(request, request.quoteId);
      if (!quote) throw new QuoteTermsIntegrityError("The Quote is unavailable.");
      authorize(request.actor, request.organizationId, quote.locationId);
      if (quote.status !== "draft") {
        throw new QuoteTermsIntegrityError(
          "Commercial and finance terms can only be attached to a draft Quote version.",
        );
      }
      if (await session.termsExist(request, request.quoteId)) {
        throw new QuoteTermsIntegrityError(
          "This Quote version already has commercial terms. Create a new Quote version to revise them.",
        );
      }

      let tradeAllowanceCents = 0;
      let tradePayoffCents = 0;
      let tradeEquityCents = 0;
      if (request.tradeAppraisalId) {
        const trade = await session.getAcceptedTradeAppraisal(
          request,
          quote.dealId,
          request.tradeAppraisalId,
        );
        if (!trade) {
          throw new QuoteTermsIntegrityError(
            "The selected trade appraisal is not an accepted appraisal for this Deal.",
          );
        }
        tradeAllowanceCents = trade.allowanceCents;
        tradePayoffCents = trade.payoffCents;
        tradeEquityCents = trade.equityCents;
      }

      const cashDownCents = request.cashDownCents ?? 0;
      const rawAmountFinanced =
        quote.totalCents - cashDownCents - tradeEquityCents;
      if (rawAmountFinanced < 0) {
        throw new QuoteTermsValidationError([
          "Cash down plus positive trade equity cannot exceed the Quote total.",
        ]);
      }

      const commercial: QuoteCommercialTerms = {
        quoteId: request.quoteId,
        organizationId: request.organizationId,
        locationId: quote.locationId,
        ...(request.tradeAppraisalId ? { tradeAppraisalId: request.tradeAppraisalId } : {}),
        tradeAllowanceCents,
        tradePayoffCents,
        tradeEquityCents,
        cashDownCents,
        ...(quote.purchaseType === "finance"
          ? { amountFinancedCents: rawAmountFinanced }
          : {}),
      };

      let finance: QuoteFinanceTerms | undefined;
      if (request.finance) {
        if (quote.purchaseType !== "finance") {
          throw new QuoteTermsValidationError([
            "APR and term can only be attached to a finance Quote.",
          ]);
        }
        finance = {
          quoteId: request.quoteId,
          organizationId: request.organizationId,
          locationId: quote.locationId,
          aprBasisPoints: request.finance.aprBasisPoints,
          termMonths: request.finance.termMonths,
          estimatedPaymentCents: calculateAmortizedPaymentCents(
            rawAmountFinanced,
            request.finance.aprBasisPoints,
            request.finance.termMonths,
          ),
          sourceType: request.finance.sourceType,
          sourceLabel: request.finance.sourceLabel.trim(),
          ...(request.finance.sourceReference?.trim()
            ? { sourceReference: request.finance.sourceReference.trim() }
            : {}),
          capturedAt: this.now().toISOString(),
        };
      }

      return session.createTerms(context(request), commercial, finance);
    });
  }
}

export function calculateAmortizedPaymentCents(
  principalCents: number,
  aprBasisPoints: number,
  termMonths: number,
) {
  if (
    !Number.isSafeInteger(principalCents) ||
    principalCents < 0 ||
    !Number.isSafeInteger(aprBasisPoints) ||
    aprBasisPoints < 0 ||
    aprBasisPoints > 10000 ||
    !Number.isSafeInteger(termMonths) ||
    termMonths < 1 ||
    termMonths > 120
  ) {
    throw new QuoteTermsValidationError(["Payment inputs are invalid."]);
  }
  if (principalCents === 0) return 0;
  if (aprBasisPoints === 0) return Math.round(principalCents / termMonths);

  const principal = principalCents / 100;
  const monthlyRate = aprBasisPoints / 10000 / 12;
  const payment =
    (principal * monthlyRate) /
    (1 - Math.pow(1 + monthlyRate, -termMonths));
  return Math.round(payment * 100);
}

function validate(request: CreateQuoteTermsRequest) {
  const issues: string[] = [];
  if (!request.quoteId.trim()) issues.push("quoteId is required.");
  if (
    request.cashDownCents !== undefined &&
    (!Number.isSafeInteger(request.cashDownCents) || request.cashDownCents < 0)
  ) {
    issues.push("cashDownCents must be a nonnegative safe integer.");
  }
  if (request.finance) {
    if (
      !Number.isSafeInteger(request.finance.aprBasisPoints) ||
      request.finance.aprBasisPoints < 0 ||
      request.finance.aprBasisPoints > 10000
    ) {
      issues.push("aprBasisPoints must be between 0 and 10000.");
    }
    if (
      !Number.isSafeInteger(request.finance.termMonths) ||
      request.finance.termMonths < 1 ||
      request.finance.termMonths > 120
    ) {
      issues.push("termMonths must be between 1 and 120.");
    }
    if (!request.finance.sourceLabel.trim()) issues.push("finance sourceLabel is required.");
    if (request.finance.sourceLabel.trim().length > 200) {
      issues.push("finance sourceLabel must not exceed 200 characters.");
    }
    if ((request.finance.sourceReference?.length ?? 0) > 500) {
      issues.push("finance sourceReference must not exceed 500 characters.");
    }
  }
  if (issues.length) throw new QuoteTermsValidationError(issues);
}

function authorize(
  actor: AuthorizationActor,
  organizationId: string,
  locationId: string | undefined,
) {
  assertAuthorized(actor, { capability: "deal.read", organizationId, locationId });
  assertAuthorized(actor, { capability: "quote.revise", organizationId, locationId });
}

function context(request: CreateQuoteTermsRequest): RequestContext {
  return {
    actorId: request.actor.userId,
    organizationId: request.organizationId,
    correlationId: request.correlationId,
    ...(request.locationId ? { locationId: request.locationId } : {}),
  };
}
