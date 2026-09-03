import { describe, expect, it } from "vitest";
import { AuthorizationError, type AuthorizationActor } from "@/lib/platform/auth";
import type { RequestContext } from "@/lib/platform/data";
import { calculateQuoteProfitability, QuoteProfitabilityIntegrityError, QuoteProfitabilityService, type QuoteProfitabilityProvider, type QuoteProfitabilitySession, type QuoteProfitabilitySnapshot } from "./manage-quote-profitability";

class MemoryProvider implements QuoteProfitabilityProvider, QuoteProfitabilitySession {
  quote: Awaited<ReturnType<QuoteProfitabilitySession["getQuoteContext"]>> = { status: "draft", locationId: "loc_main", inventoryUnitId: "inv_unit", vehicleSellCents: 4000000 };
  policy: Awaited<ReturnType<QuoteProfitabilitySession["getPackPolicy"]>> = null;
  backendGross = 150000;
  exists = false;
  async transaction<Result>(operation: (session: QuoteProfitabilitySession) => Promise<Result>) { return operation(this); }
  async getQuoteContext() { return this.quote; }
  async getPackPolicy() { return this.policy; }
  async getBackendGross() { return this.backendGross; }
  async snapshotExists() { return this.exists; }
  async createSnapshot(_context: RequestContext, input: { profitability: QuoteProfitabilitySnapshot }) { this.exists = true; return input.profitability; }
}
const actor = (locationIds: readonly string[] | "all" = ["loc_main"], capabilities: AuthorizationActor["memberships"][number]["capabilities"] = ["deal.read","quote.revise","quote.view_sensitive_terms"]): AuthorizationActor => ({ userId: "usr_finance", memberships: [{ organizationId: "org_dealerflow", locationIds, capabilities }] });
const request = () => ({ actor: actor(), organizationId: "org_dealerflow", correlationId: "req_profit", quoteId: "quo_12345678", vehicleCostCents: 3600000, costSourceType: "manual-documented" as const, costSourceLabel: "Controller-confirmed invoice", costSourceReference: "invoice-42", costEffectiveAt: "2026-09-02T12:00:00.000Z" });

describe("calculateQuoteProfitability", () => {
  it("preserves negative front gross and combines backend gross", () => {
    expect(calculateQuoteProfitability({ vehicleSellCents: 3500000, vehicleCostCents: 3600000, packCents: 50000, backendGrossCents: 100000 })).toMatchObject({ frontGrossCents: -150000, totalGrossCents: -50000 });
  });
  it("uses zero pack only when pack is disabled or absent", () => {
    expect(calculateQuoteProfitability({ vehicleSellCents: 4000000, vehicleCostCents: 3600000, packCents: 0, backendGrossCents: 0 }).frontGrossCents).toBe(400000);
  });
});
describe("QuoteProfitabilityService", () => {
  it("captures sourced cost, configured pack, front gross, backend gross, and total gross", async () => {
    const provider = new MemoryProvider();
    provider.policy = { id: "qpk_policy", enabled: true, packAmountCents: 50000 };
    const result = await new QuoteProfitabilityService(provider, () => new Date("2026-09-02T12:30:00.000Z")).capture(request());
    expect(result).toMatchObject({ vehicleSellCents: 4000000, vehicleCostCents: 3600000, packCents: 50000, frontGrossCents: 350000, backendGrossCents: 150000, totalGrossCents: 500000 });
  });
  it("rejects missing authoritative inventory linkage", async () => {
    const provider = new MemoryProvider(); provider.quote = { status: "draft", locationId: "loc_main", vehicleSellCents: 4000000 };
    await expect(new QuoteProfitabilityService(provider).capture(request())).rejects.toBeInstanceOf(QuoteProfitabilityIntegrityError);
  });
  it("rejects an enabled but unset pack rather than inventing an amount", async () => {
    const provider = new MemoryProvider(); provider.policy = { id: "qpk_policy", enabled: true };
    await expect(new QuoteProfitabilityService(provider).capture(request())).rejects.toBeInstanceOf(QuoteProfitabilityIntegrityError);
  });
  it("enforces tenant location scope and sensitive-term authority", async () => {
    await expect(new QuoteProfitabilityService(new MemoryProvider()).capture({ ...request(), actor: actor(["loc_other"]) })).rejects.toBeInstanceOf(AuthorizationError);
    await expect(new QuoteProfitabilityService(new MemoryProvider()).capture({ ...request(), actor: actor(["loc_main"], ["deal.read","quote.revise"]) })).rejects.toBeInstanceOf(AuthorizationError);
  });
  it("does not rewrite an immutable profitability snapshot", async () => {
    const provider = new MemoryProvider(); const service = new QuoteProfitabilityService(provider); await service.capture(request());
    await expect(service.capture(request())).rejects.toBeInstanceOf(QuoteProfitabilityIntegrityError);
  });
});
