import { describe, expect, it } from "vitest";
import { AuthorizationError, type AuthorizationActor } from "@/lib/platform/auth";
import type { RequestContext } from "@/lib/platform/data";
import type { InventoryCostSnapshot } from "@/lib/application/inventory";
import { calculateQuoteProfitability, QuoteProfitabilityIntegrityError, QuoteProfitabilityService, type PackPolicy, type QuoteProfitabilityProvider, type QuoteProfitabilitySession, type QuoteProfitabilitySnapshot } from "./index";

const policy = (locationId?: string, enabled = true, amount = 50000): PackPolicy => ({ id: locationId ? "qpk_location" : "qpk_org", organizationId: "org_dealerflow", ...(locationId ? { locationId } : {}), enabled, ...(enabled ? { packAmountCents: amount } : {}), version: 1, updatedAt: "2026-09-02T12:00:00.000Z" });
const cost: InventoryCostSnapshot = { id: "ics_cost01", organizationId: "org_dealerflow", locationId: "loc_main", inventoryUnitId: "inv_unit", version: 2, previousSnapshotId: "ics_cost00", costCents: 3600000, sourceType: "manual-verified", sourceLabel: "Controller verified invoice", sourceReference: "INV-42", effectiveAt: "2026-09-02T12:00:00.000Z", capturedAt: "2026-09-02T12:05:00.000Z", capturedBy: "usr_controller" };

class MemoryProvider implements QuoteProfitabilityProvider, QuoteProfitabilitySession {
  quote: Awaited<ReturnType<QuoteProfitabilitySession["getQuoteContext"]>> = { status: "draft", locationId: "loc_main", inventoryUnitId: "inv_unit", vehicleSellCents: 4000000 };
  policies = { organizationDefault: null as PackPolicy | null, locationOverride: null as PackPolicy | null };
  inventoryCost: InventoryCostSnapshot | null = cost;
  backendGross = 150000;
  exists = false;
  async transaction<Result>(operation: (session: QuoteProfitabilitySession) => Promise<Result>) { return operation(this); }
  async getQuoteContext() { return this.quote; }
  async getPackPolicies() { return this.policies; }
  async getLatestInventoryCost() { return this.inventoryCost; }
  async getBackendGross() { return this.backendGross; }
  async snapshotExists() { return this.exists; }
  async createSnapshot(_context: RequestContext, profitability: QuoteProfitabilitySnapshot) { this.exists = true; return profitability; }
}
const actor = (locationIds: readonly string[] | "all" = ["loc_main"], capabilities: AuthorizationActor["memberships"][number]["capabilities"] = ["deal.read","quote.revise","quote.view_sensitive_terms"]): AuthorizationActor => ({ userId: "usr_finance", memberships: [{ organizationId: "org_dealerflow", locationIds, capabilities }] });
const request = () => ({ actor: actor(), organizationId: "org_dealerflow", correlationId: "req_profit", quoteId: "quo_12345678" });

describe("calculateQuoteProfitability", () => {
  it("preserves negative front gross and combines backend gross", () => {
    expect(calculateQuoteProfitability({ vehicleSellCents: 3500000, vehicleCostCents: 3600000, packCents: 50000, backendGrossCents: 100000 })).toMatchObject({ frontGrossCents: -150000, totalGrossCents: -50000 });
  });
});
describe("QuoteProfitabilityService", () => {
  it("uses the latest authoritative cost and a location pack override", async () => {
    const provider = new MemoryProvider(); provider.policies.locationOverride = policy("loc_main");
    await expect(new QuoteProfitabilityService(provider).capture(request())).resolves.toMatchObject({ inventoryCostSnapshotId: "ics_cost01", packPolicyId: "qpk_location", vehicleCostCents: 3600000, packCents: 50000, frontGrossCents: 350000, totalGrossCents: 500000 });
  });
  it("falls back to the organization pack and permits zero only without an enabled policy", async () => {
    const fallback = new MemoryProvider(); fallback.policies.organizationDefault = policy();
    await expect(new QuoteProfitabilityService(fallback).capture(request())).resolves.toMatchObject({ packPolicyId: "qpk_org", packCents: 50000 });
    const zero = new MemoryProvider();
    await expect(new QuoteProfitabilityService(zero).capture(request())).resolves.toMatchObject({ packCents: 0 });
  });
  it("fails closed for missing cost and malformed enabled policy", async () => {
    const missing = new MemoryProvider(); missing.inventoryCost = null;
    await expect(new QuoteProfitabilityService(missing).capture(request())).rejects.toThrow("Authoritative inventory cost is unavailable");
    const malformed = new MemoryProvider(); malformed.policies.organizationDefault = { ...policy(), packAmountCents: undefined };
    await expect(new QuoteProfitabilityService(malformed).capture(request())).rejects.toThrow("no configured amount");
  });
  it("enforces location scope, sensitive authority, and immutability", async () => {
    await expect(new QuoteProfitabilityService(new MemoryProvider()).capture({ ...request(), actor: actor(["loc_other"]) })).rejects.toBeInstanceOf(AuthorizationError);
    await expect(new QuoteProfitabilityService(new MemoryProvider()).capture({ ...request(), actor: actor(["loc_main"], ["deal.read","quote.revise"]) })).rejects.toBeInstanceOf(AuthorizationError);
    const provider = new MemoryProvider(); const service = new QuoteProfitabilityService(provider); await service.capture(request());
    await expect(service.capture(request())).rejects.toBeInstanceOf(QuoteProfitabilityIntegrityError);
  });
});
