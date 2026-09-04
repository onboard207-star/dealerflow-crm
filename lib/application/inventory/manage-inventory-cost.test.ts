import { describe, expect, it } from "vitest";
import { AuthorizationError, type AuthorizationActor } from "@/lib/platform/auth";
import type { RequestContext } from "@/lib/platform/data";
import { InventoryCostIntegrityError, InventoryCostService, type InventoryCostProvider, type InventoryCostSession, type InventoryCostSnapshot } from "./manage-inventory-cost";

class MemoryProvider implements InventoryCostProvider, InventoryCostSession {
  locationId = "loc_main";
  records: InventoryCostSnapshot[] = [];
  async transaction<Result>(operation: (session: InventoryCostSession) => Promise<Result>) { return operation(this); }
  async getInventoryUnit() { return this.locationId ? { locationId: this.locationId } : null; }
  async getLatest() { return this.records.at(-1) ?? null; }
  async insert(_context: RequestContext, snapshot: InventoryCostSnapshot) { this.records.push(snapshot); return snapshot; }
}
const actor = (organizationId = "org_dealerflow", locations: readonly string[] | "all" = ["loc_main"], capabilities: AuthorizationActor["memberships"][number]["capabilities"] = ["inventory.read","inventory.cost.manage"]): AuthorizationActor => ({ userId: "usr_controller", memberships: [{ organizationId, locationIds: locations, capabilities }] });
const request = (who = actor()) => ({ actor: who, organizationId: "org_dealerflow", locationId: "loc_main", correlationId: "req_cost", inventoryUnitId: "inv_unit", costCents: 3150000, sourceType: "manual-verified" as const, sourceLabel: "Controller verified invoice", sourceReference: "INV-42", effectiveAt: "2026-09-02T12:00:00.000Z" });

describe("InventoryCostService", () => {
  it("is the shared provenance-aware write boundary for manual and integration sources", async () => {
    const provider = new MemoryProvider(); const service = new InventoryCostService(provider);
    await expect(service.record(request())).resolves.toMatchObject({ version: 1, sourceType: "manual-verified", costCents: 3150000 });
    await expect(service.record({ ...request(), sourceType: "dms-import", sourceLabel: "Provider DMS cost feed", sourceReference: "sync-9" })).resolves.toMatchObject({ version: 2, sourceType: "dms-import" });
    expect(provider.records[1]?.previousSnapshotId).toBe(provider.records[0]?.id);
  });
  it("preserves tenant and location isolation", async () => {
    await expect(new InventoryCostService(new MemoryProvider()).record(request(actor("org_other")))).rejects.toBeInstanceOf(AuthorizationError);
    await expect(new InventoryCostService(new MemoryProvider()).record(request(actor("org_dealerflow", ["loc_other"])))).rejects.toBeInstanceOf(AuthorizationError);
    await expect(new InventoryCostService(Object.assign(new MemoryProvider(), { locationId: "loc_other" })).record(request())).rejects.toBeInstanceOf(AuthorizationError);
  });
  it("rejects users without cost authority and does not substitute another value", async () => {
    await expect(new InventoryCostService(new MemoryProvider()).record(request(actor("org_dealerflow", ["loc_main"], ["inventory.read"])))).rejects.toBeInstanceOf(AuthorizationError);
    await expect(new InventoryCostService(new MemoryProvider()).record({ ...request(), costCents: Number.NaN })).rejects.toThrow("invalid");
  });
  it("rejects a mismatched requested location", async () => {
    await expect(new InventoryCostService(Object.assign(new MemoryProvider(), { locationId: "loc_other" })).record({ ...request(), actor: actor("org_dealerflow", "all") })).rejects.toBeInstanceOf(InventoryCostIntegrityError);
  });
});
