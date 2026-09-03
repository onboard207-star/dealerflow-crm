import { describe, expect, it } from "vitest";
import type { AuthorizationActor } from "@/lib/platform/auth";
import type { RequestContext } from "@/lib/platform/data";
import {
  calculateAmortizedPaymentCents,
  QuoteTermsIntegrityError,
  QuoteTermsService,
  QuoteTermsValidationError,
  type QuoteCommercialTerms,
  type QuoteFinanceTerms,
  type QuoteTermsProvider,
  type QuoteTermsSession,
} from "./manage-quote-terms";

class MemoryProvider implements QuoteTermsProvider, QuoteTermsSession {
  exists = false;
  quote: { status: "draft"; purchaseType: "cash" | "finance" | "lease"; totalCents: number; dealId: string; locationId: string } = {
    status: "draft",
    purchaseType: "finance" as const,
    totalCents: 4000000,
    dealId: "dea_12345678",
    locationId: "loc_main",
  };
  trade = {
    id: "tap_12345678",
    allowanceCents: 1200000,
    payoffCents: 700000,
    equityCents: 500000,
  };
  async transaction<Result>(operation: (session: QuoteTermsSession) => Promise<Result>) {
    return operation(this);
  }
  async getQuoteForTerms() { return this.quote; }
  async getAcceptedTradeAppraisal() { return this.trade; }
  async termsExist() { return this.exists; }
  async createTerms(
    _context: RequestContext,
    commercial: QuoteCommercialTerms,
    finance?: QuoteFinanceTerms,
  ) {
    this.exists = true;
    return { commercial, ...(finance ? { finance } : {}) };
  }
}

const actor: AuthorizationActor = {
  userId: "usr_sales",
  memberships: [{
    organizationId: "org_dealerflow",
    locationIds: ["loc_main"],
    capabilities: ["deal.read", "quote.revise"],
  }],
};

const request = () => ({
  actor,
  organizationId: "org_dealerflow",
  correlationId: "req_terms",
  quoteId: "quo_12345678",
  cashDownCents: 300000,
  tradeAppraisalId: "tap_12345678",
  finance: {
    aprBasisPoints: 599,
    termMonths: 72,
    sourceType: "manual-entry" as const,
    sourceLabel: "Manager-entered approved rate",
  },
});

describe("calculateAmortizedPaymentCents", () => {
  it("calculates standard amortized payment deterministically", () => {
    expect(calculateAmortizedPaymentCents(3200000, 599, 72)).toBe(53018);
  });

  it("handles zero APR without floating-rate math", () => {
    expect(calculateAmortizedPaymentCents(1200000, 0, 60)).toBe(20000);
  });
});

describe("QuoteTermsService", () => {
  it("snapshots accepted trade economics and calculates amount financed", async () => {
    const service = new QuoteTermsService(
      new MemoryProvider(),
      () => new Date("2026-09-02T20:45:00.000Z"),
    );
    const result = await service.create(request());
    expect(result.commercial).toMatchObject({
      tradeAllowanceCents: 1200000,
      tradePayoffCents: 700000,
      tradeEquityCents: 500000,
      cashDownCents: 300000,
      amountFinancedCents: 3200000,
    });
    expect(result.finance).toMatchObject({
      aprBasisPoints: 599,
      termMonths: 72,
      sourceType: "manual-entry",
      capturedAt: "2026-09-02T20:45:00.000Z",
    });
  });

  it("does not permit in-place replacement of Quote terms", async () => {
    const provider = new MemoryProvider();
    const service = new QuoteTermsService(provider);
    await service.create(request());
    await expect(service.create(request())).rejects.toBeInstanceOf(QuoteTermsIntegrityError);
  });

  it("rejects a trade appraisal that is not accepted for the Deal", async () => {
    const provider = new MemoryProvider();
    provider.trade = null as never;
    const service = new QuoteTermsService(provider);
    await expect(service.create(request())).rejects.toBeInstanceOf(QuoteTermsIntegrityError);
  });

  it("rejects finance data on a cash Quote", async () => {
    const provider = new MemoryProvider();
    provider.quote = { ...provider.quote, purchaseType: "cash" };
    const service = new QuoteTermsService(provider);
    await expect(service.create(request())).rejects.toBeInstanceOf(QuoteTermsValidationError);
  });

  it("rejects down payment plus positive equity above total", async () => {
    const provider = new MemoryProvider();
    provider.quote = { ...provider.quote, totalCents: 500000 };
    const service = new QuoteTermsService(provider);
    await expect(service.create(request())).rejects.toBeInstanceOf(QuoteTermsValidationError);
  });

  it("requires finance source provenance", async () => {
    const service = new QuoteTermsService(new MemoryProvider());
    const input = request();
    input.finance.sourceLabel = " ";
    await expect(service.create(input)).rejects.toBeInstanceOf(QuoteTermsValidationError);
  });
});
