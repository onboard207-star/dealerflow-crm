import { describe, expect, it } from "vitest";

import type { AuthorizationActor } from "@/lib/platform/auth";
import type { RequestContext } from "@/lib/platform/data";
import { InventoryVehicleService, VehicleIntegrityError, VehicleInterestService, VehicleValidationError,
  TradeVehicleService, type AddVehicleInterestRequest, type InventoryUnitRecord, type RegisterInventoryVehicleRequest,
  type VehicleInterestRecord, type VehicleProvider, type VehicleRecord, type VehicleSession } from "./manage-vehicles";

class MemoryProvider implements VehicleProvider, VehicleSession {
  vehicles: VehicleRecord[] = []; inventory: InventoryUnitRecord[] = []; interests: VehicleInterestRecord[] = []; contextExists = true; contextInput?: { customerId: string; leadId: string; vehicleId: string; role: "primary" | "alternative" | "trade" };
  async transaction<Result>(operation: (session: VehicleSession) => Promise<Result>) { return operation(this); }
  async acquireIdempotencyLock() {}
  async findInventoryByIdempotency(scope: { organizationId: string }, key: string) { const inventory = this.inventory.find((item) => item.organizationId === scope.organizationId && item.idempotencyKey === key); if (!inventory) return null; return { inventory, vehicle: this.vehicles.find((item) => item.id === inventory.vehicleId)! }; }
  async findVehicleByVin(scope: { organizationId: string }, vin: string) { return this.vehicles.find((item) => item.organizationId === scope.organizationId && item.vin === vin) ?? null; }
  async createVehicle(_context: RequestContext, input: VehicleRecord) { this.vehicles.push(input); return input; }
  async createInventory(_context: RequestContext, input: Omit<InventoryUnitRecord, "status">) { const item: InventoryUnitRecord = { ...input, status: "available" }; this.inventory.push(item); return item; }
  async findInterestByIdempotency(scope: { organizationId: string }, key: string) { return this.interests.find((item) => item.organizationId === scope.organizationId && item.idempotencyKey === key) ?? null; }
  async interestContextExists(_scope: { organizationId: string }, input: { customerId: string; leadId: string; vehicleId: string; role: "primary" | "alternative" | "trade" }) { this.contextInput = input; return this.contextExists; }
  async createInterest(_context: RequestContext, input: Omit<VehicleInterestRecord, "status">) { const item: VehicleInterestRecord = { ...input, status: "active" }; this.interests.push(item); return item; }
}

const actor: AuthorizationActor = { userId: "usr_inventory", memberships: [{ organizationId: "org_dealerflow", locationIds: ["loc_main"], capabilities: ["inventory.create", "inventory.read", "lead.read", "lead.update", "customer.read"] }] };
const inventoryRequest = (overrides: Partial<RegisterInventoryVehicleRequest> = {}): RegisterInventoryVehicleRequest => ({ actor, organizationId: "org_dealerflow", locationId: "loc_main", correlationId: "req_inventory", idempotencyKey: "inventory:stock-1", stockNumber: "H26418", listPriceCents: 4285000, vehicle: { vin: "2HKRS6H98SH123456", year: 2026, make: "Honda", model: "CR-V", trim: "Hybrid Touring", exteriorColor: "Platinum White Pearl" }, ...overrides });
const interestRequest = (overrides: Partial<AddVehicleInterestRequest> = {}): AddVehicleInterestRequest => ({ actor, organizationId: "org_dealerflow", locationId: "loc_main", correlationId: "req_interest", idempotencyKey: "interest:lead-1:primary", customerId: "cus_jordan", leadId: "led_jordan", vehicleId: "veh_crv", role: "primary", ...overrides });

describe("InventoryVehicleService", () => {
  it("registers inventory idempotently and normalizes its VIN", async () => { const provider = new MemoryProvider(); const service = new InventoryVehicleService(provider); const first = await service.register(inventoryRequest({ vehicle: { ...inventoryRequest().vehicle, vin: "2hkrs6h98sh123456" } })); const second = await service.register(inventoryRequest()); expect(first.created).toBe(true); expect(second.created).toBe(false); expect(provider.vehicles[0]?.vin).toBe("2HKRS6H98SH123456"); expect(provider.inventory).toHaveLength(1); });
  it("reuses canonical vehicle identity across a returning inventory cycle", async () => { const provider = new MemoryProvider(); const service = new InventoryVehicleService(provider); const first = await service.register(inventoryRequest()); provider.inventory[0]!.status = "sold"; const second = await service.register(inventoryRequest({ idempotencyKey: "inventory:stock-2", stockNumber: "U991", locationId: "loc_main" })); expect(second.vehicle.id).toBe(first.vehicle.id); expect(provider.vehicles).toHaveLength(1); expect(provider.inventory).toHaveLength(2); });
  it("rejects invalid VIN and monetary values", async () => { await expect(new InventoryVehicleService(new MemoryProvider()).register(inventoryRequest({ listPriceCents: -1, vehicle: { ...inventoryRequest().vehicle, vin: "INVALID" } }))).rejects.toBeInstanceOf(VehicleValidationError); });
});

describe("VehicleInterestService", () => {
  it("links a customer lead to a canonical vehicle idempotently", async () => { const provider = new MemoryProvider(); const service = new VehicleInterestService(provider); const first = await service.add(interestRequest()); const second = await service.add(interestRequest()); expect(first.created).toBe(true); expect(second.created).toBe(false); expect(provider.interests).toHaveLength(1); expect(provider.contextInput).toEqual({ customerId: "cus_jordan", leadId: "led_jordan", vehicleId: "veh_crv", role: "primary" }); });
  it("rejects a vehicle that is outside the verified lead-customer context", async () => { const provider = new MemoryProvider(); provider.contextExists = false; await expect(new VehicleInterestService(provider).add(interestRequest())).rejects.toBeInstanceOf(VehicleIntegrityError); });
  it("requires an authorized dealership location for every interest", async () => { const request = interestRequest(); delete request.locationId; await expect(new VehicleInterestService(new MemoryProvider()).add(request)).rejects.toBeInstanceOf(VehicleValidationError); });
});

describe("TradeVehicleService", () => {
  it("creates canonical trade identity and interest atomically and idempotently", async () => { const provider=new MemoryProvider();const service=new TradeVehicleService(provider);const input={actor,organizationId:"org_dealerflow",locationId:"loc_main",correlationId:"req_trade",idempotencyKey:"trade:1",customerId:"cus_jordan",leadId:"led_jordan",vehicle:{vin:"1HGCM82633A004352",year:2020,make:"Honda",model:"Accord"}};const first=await service.add(input);const second=await service.add(input);expect(first.created).toBe(true);expect(second.created).toBe(false);expect(provider.vehicles).toHaveLength(1);expect(provider.interests[0]).toMatchObject({role:"trade",vehicleId:first.vehicle.id});});
  it("rejects invalid trade VIN and missing location", async () => { const provider=new MemoryProvider();const service=new TradeVehicleService(provider);await expect(service.add({actor,organizationId:"org_dealerflow",correlationId:"req_trade",idempotencyKey:"trade:bad",customerId:"cus_jordan",leadId:"led_jordan",vehicle:{vin:"bad",year:2020,make:"Honda",model:"Accord"}})).rejects.toBeInstanceOf(VehicleValidationError);});
});
