import { describe, expect, it } from "vitest";
import type { AuthorizationActor } from "@/lib/platform/auth";
import type { RequestContext } from "@/lib/platform/data";
import {
  QuoteIncentiveIntegrityError,
  QuoteIncentiveService,
  QuoteIncentiveValidationError,
  type QuoteIncentiveApplication,
  type QuoteIncentiveProvider,
  type QuoteIncentiveSession,
} from "./manage-quote-incentive";

class MemoryProvider implements QuoteIncentiveProvider, QuoteIncentiveSession {
  application: QuoteIncentiveApplication | null = null;
  line = {
    quoteStatus: "draft",
    locationId: "loc_main",
    category: "discount",
    lineTotalCents: -150000,
  };
  program = { active: true };
  async transaction<Result>(
    operation: (session: QuoteIncentiveSession) => Promise<Result>,
  ) {
    return operation(this);
  }
  async getQuoteLineContext() { return this.line; }
  async getProgram() { return this.program; }
  async createApplication(_context: RequestContext, value: QuoteIncentiveApplication) {
    this.application = value;
    return value;
  }
  async getApplicationForUpdate() {
    return this.application
      ? {
          ...this.application,
          quoteStatus: this.line.quoteStatus,
          locationId: this.line.locationId,
        }
      : null;
  }
  async decideApplication(_context: RequestContext, value: QuoteIncentiveApplication) {
    this.application = value;
    return value;
  }
}

const actor = (
  capabilities: AuthorizationActor["memberships"][number]["capabilities"],
): AuthorizationActor => ({
  userId: capabilities.includes("quote.approve") ? "usr_manager" : "usr_sales",
  memberships: [
    {
      organizationId: "org_dealerflow",
      locationIds: ["loc_main"],
      capabilities,
    },
  ],
});

const createRequest = () => ({
  actor: actor(["deal.read", "quote.revise"]),
  organizationId: "org_dealerflow",
  correlationId: "req_incentive",
  quoteId: "quo_12345678",
  quoteLineId: "qli_12345678",
  programId: "inc_12345678",
  amountCents: 150000,
});

describe("QuoteIncentiveService", () => {
  it("attaches provenance only to an exact matching discount line", async () => {
    const service = new QuoteIncentiveService(new MemoryProvider());
    const application = await service.create(createRequest());
    expect(application).toMatchObject({
      quoteLineId: "qli_12345678",
      amountCents: 150000,
      eligibilityStatus: "pending",
    });
  });

  it("rejects incentive provenance when amount does not match Quote math", async () => {
    const service = new QuoteIncentiveService(new MemoryProvider());
    await expect(
      service.create({ ...createRequest(), amountCents: 100000 }),
    ).rejects.toBeInstanceOf(QuoteIncentiveIntegrityError);
  });

  it("rejects expired incentive programs", async () => {
    const provider = new MemoryProvider();
    provider.program = {
      active: true,
      endsAt: "2026-09-01T00:00:00.000Z",
    } as never;
    const service = new QuoteIncentiveService(
      provider,
      () => new Date("2026-09-02T12:00:00.000Z"),
    );
    await expect(service.create(createRequest())).rejects.toBeInstanceOf(
      QuoteIncentiveIntegrityError,
    );
  });

  it("requires manager authority to verify eligibility", async () => {
    const provider = new MemoryProvider();
    const service = new QuoteIncentiveService(provider);
    const application = await service.create(createRequest());
    await expect(
      service.decide({
        actor: actor(["deal.read", "quote.revise"]),
        organizationId: "org_dealerflow",
        correlationId: "decision",
        applicationId: application.id,
        decision: "verified",
        eligibilityBasis: "Customer supplied required program documentation.",
      }),
    ).rejects.toThrow();
  });

  it("requires documented eligibility basis for a final decision", async () => {
    const provider = new MemoryProvider();
    const service = new QuoteIncentiveService(provider);
    const application = await service.create(createRequest());
    await expect(
      service.decide({
        actor: actor(["deal.read", "quote.approve"]),
        organizationId: "org_dealerflow",
        correlationId: "decision",
        applicationId: application.id,
        decision: "verified",
        eligibilityBasis: " ",
      }),
    ).rejects.toBeInstanceOf(QuoteIncentiveValidationError);
  });

  it("records verified eligibility without changing Quote totals", async () => {
    const provider = new MemoryProvider();
    const service = new QuoteIncentiveService(
      provider,
      () => new Date("2026-09-02T22:00:00.000Z"),
    );
    const application = await service.create(createRequest());
    const verified = await service.decide({
      actor: actor(["deal.read", "quote.approve"]),
      organizationId: "org_dealerflow",
      correlationId: "decision",
      applicationId: application.id,
      decision: "verified",
      eligibilityBasis: "Program requirements verified against customer documentation.",
    });
    expect(verified).toMatchObject({
      eligibilityStatus: "verified",
      amountCents: 150000,
      verifiedAt: "2026-09-02T22:00:00.000Z",
    });
  });
});
