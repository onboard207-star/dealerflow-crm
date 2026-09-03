import { describe, expect, it } from "vitest";
import { AuthorizationError, type AuthorizationActor } from "@/lib/platform/auth";
import type { RequestContext } from "@/lib/platform/data";
import {
  calculateBackendGross,
  QuoteBackendProductIntegrityError,
  QuoteBackendProductService,
  type QuoteBackendProductProvider,
  type QuoteBackendProductSession,
  type QuoteBackendProductSnapshot,
} from "./manage-quote-backend-product";

class MemoryProvider implements QuoteBackendProductProvider, QuoteBackendProductSession {
  exists = false;
  line = {
    quoteStatus: "draft",
    locationId: "loc_main",
    category: "product",
    lineTotalCents: 250000,
  };
  product: { active: boolean; quoteLineCategory: "product" | "accessory" } = {
    active: true,
    quoteLineCategory: "product" as const,
  };
  async transaction<Result>(
    operation: (session: QuoteBackendProductSession) => Promise<Result>,
  ) {
    return operation(this);
  }
  async getQuoteLineContext() { return this.line; }
  async getProduct() { return this.product; }
  async snapshotExists() { return this.exists; }
  async createSnapshot(_context: RequestContext, snapshot: QuoteBackendProductSnapshot) {
    this.exists = true;
    return snapshot;
  }
}

const actor = (
  capabilities: AuthorizationActor["memberships"][number]["capabilities"],
): AuthorizationActor => ({
  userId: "usr_finance",
  memberships: [
    {
      organizationId: "org_dealerflow",
      locationIds: ["loc_main"],
      capabilities,
    },
  ],
});

const privileged = actor([
  "deal.read",
  "quote.revise",
  "quote.view_sensitive_terms",
]);

const request = () => ({
  actor: privileged,
  organizationId: "org_dealerflow",
  correlationId: "req_backend",
  quoteId: "quo_12345678",
  quoteLineId: "qli_12345678",
  productId: "bpc_12345678",
  costCents: 120000,
});

describe("calculateBackendGross", () => {
  it("calculates aggregate sell minus cost", () => {
    expect(
      calculateBackendGross([
        { sellCents: 250000, costCents: 120000 },
        { sellCents: 100000, costCents: 40000 },
      ]),
    ).toBe(190000);
  });
});

describe("QuoteBackendProductService", () => {
  it("creates an immutable internal cost/gross snapshot for an existing Quote product line", async () => {
    const service = new QuoteBackendProductService(
      new MemoryProvider(),
      () => new Date("2026-09-02T22:30:00.000Z"),
    );
    const snapshot = await service.attach(request());
    expect(snapshot).toMatchObject({
      sellCents: 250000,
      costCents: 120000,
      grossCents: 130000,
      capturedAt: "2026-09-02T22:30:00.000Z",
    });
  });

  it("requires sensitive-term authority in addition to Quote revision", async () => {
    const service = new QuoteBackendProductService(new MemoryProvider());
    await expect(
      service.attach({
        ...request(),
        actor: actor(["deal.read", "quote.revise"]),
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("does not allow cost attachment to a vehicle Quote line", async () => {
    const provider = new MemoryProvider();
    provider.line = { ...provider.line, category: "vehicle" };
    const service = new QuoteBackendProductService(provider);
    await expect(service.attach(request())).rejects.toBeInstanceOf(
      QuoteBackendProductIntegrityError,
    );
  });

  it("requires catalog and Quote line categories to match", async () => {
    const provider = new MemoryProvider();
    provider.product = {
      ...provider.product,
      quoteLineCategory: "accessory",
    };
    const service = new QuoteBackendProductService(provider);
    await expect(service.attach(request())).rejects.toBeInstanceOf(
      QuoteBackendProductIntegrityError,
    );
  });

  it("does not rewrite a cost snapshot on the same immutable Quote version", async () => {
    const provider = new MemoryProvider();
    const service = new QuoteBackendProductService(provider);
    await service.attach(request());
    await expect(service.attach(request())).rejects.toBeInstanceOf(
      QuoteBackendProductIntegrityError,
    );
  });

  it("allows negative gross to remain visible rather than hiding a loss", async () => {
    const service = new QuoteBackendProductService(new MemoryProvider());
    const snapshot = await service.attach({ ...request(), costCents: 300000 });
    expect(snapshot.grossCents).toBe(-50000);
  });
});
