import { describe, expect, it } from "vitest";
import type { AuthorizationActor } from "@/lib/platform/auth";
import type { RequestContext } from "@/lib/platform/data";
import {
  calculateLeaseBasePaymentCents,
  QuoteLeaseIntegrityError,
  QuoteLeaseTermsService,
  QuoteLeaseValidationError,
  type QuoteLeaseTerms,
  type QuoteLeaseTermsProvider,
  type QuoteLeaseTermsSession,
} from "./manage-quote-lease";

class MemoryProvider implements QuoteLeaseTermsProvider, QuoteLeaseTermsSession {
  exists = false;
  quote = {
    status: "draft",
    purchaseType: "lease" as const,
    locationId: "loc_main",
  };
  async transaction<Result>(
    operation: (session: QuoteLeaseTermsSession) => Promise<Result>,
  ) {
    return operation(this);
  }
  async getQuoteForLease() { return this.quote; }
  async leaseTermsExist() { return this.exists; }
  async createLeaseTerms(_context: RequestContext, terms: QuoteLeaseTerms) {
    this.exists = true;
    return terms;
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
  correlationId: "req_lease",
  quoteId: "quo_12345678",
  adjustedCapCostCents: 4200000,
  residualValueCents: 2600000,
  moneyFactorPpm: 2050,
  termMonths: 36,
  annualMileage: 12000,
  acquisitionFeeCents: 59500,
  capCostReductionCents: 200000,
  rebateCents: 100000,
  sourceType: "oem-program" as const,
  sourceLabel: "Honda Financial lease program",
});

describe("calculateLeaseBasePaymentCents", () => {
  it("calculates depreciation plus finance charge deterministically", () => {
    expect(
      calculateLeaseBasePaymentCents({
        adjustedCapCostCents: 4200000,
        residualValueCents: 2600000,
        moneyFactorPpm: 2050,
        termMonths: 36,
        acquisitionFeeCents: 59500,
        capCostReductionCents: 200000,
        rebateCents: 100000,
      }),
    ).toBe(51211);
  });
});

describe("QuoteLeaseTermsService", () => {
  it("creates immutable lease terms with a calculated base payment", async () => {
    const service = new QuoteLeaseTermsService(
      new MemoryProvider(),
      () => new Date("2026-09-02T21:00:00.000Z"),
    );
    const terms = await service.create(request());
    expect(terms).toMatchObject({
      termMonths: 36,
      annualMileage: 12000,
      sourceType: "oem-program",
      capturedAt: "2026-09-02T21:00:00.000Z",
    });
    expect(terms.basePaymentCents).toBeGreaterThan(0);
  });

  it("rejects lease terms for a finance Quote", async () => {
    const provider = new MemoryProvider();
    provider.quote = { ...provider.quote, purchaseType: "finance" as never };
    const service = new QuoteLeaseTermsService(provider);
    await expect(service.create(request())).rejects.toBeInstanceOf(
      QuoteLeaseValidationError,
    );
  });

  it("rejects changes to an existing lease term snapshot", async () => {
    const provider = new MemoryProvider();
    const service = new QuoteLeaseTermsService(provider);
    await service.create(request());
    await expect(service.create(request())).rejects.toBeInstanceOf(
      QuoteLeaseIntegrityError,
    );
  });

  it("rejects residual above effective cap cost", async () => {
    const service = new QuoteLeaseTermsService(new MemoryProvider());
    await expect(
      service.create({
        ...request(),
        residualValueCents: 5000000,
      }),
    ).rejects.toBeInstanceOf(QuoteLeaseValidationError);
  });

  it("requires source provenance", async () => {
    const service = new QuoteLeaseTermsService(new MemoryProvider());
    await expect(
      service.create({ ...request(), sourceLabel: " " }),
    ).rejects.toBeInstanceOf(QuoteLeaseValidationError);
  });
});
