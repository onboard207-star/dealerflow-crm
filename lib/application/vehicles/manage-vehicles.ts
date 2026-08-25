import { generateEntityId } from "@/lib/core/identifiers";
import { assertAuthorized, type AuthorizationActor } from "@/lib/platform/auth";
import type { OrganizationScope, RequestContext } from "@/lib/platform/data";

export type InventoryStatus = "available" | "hold" | "sold" | "unavailable";
export type VehicleInterestRole = "primary" | "alternative" | "trade";
export interface VehicleRecord extends OrganizationScope { id: string; vin: string; year: number; make: string; model: string; trim?: string; exteriorColor?: string; }
export interface InventoryUnitRecord extends OrganizationScope { id: string; vehicleId: string; stockNumber: string; status: InventoryStatus; listPriceCents?: number; idempotencyKey: string; }
export interface VehicleInterestRecord extends OrganizationScope { id: string; customerId: string; leadId: string; vehicleId: string; role: VehicleInterestRole; status: "active" | "inactive" | "purchased" | "traded"; priority: number; notes?: string; idempotencyKey: string; }
export interface RegisterInventoryVehicleRequest extends OrganizationScope { actor: AuthorizationActor; correlationId: string; idempotencyKey: string; stockNumber: string; listPriceCents?: number; vehicle: { vin: string; year: number; make: string; model: string; trim?: string; exteriorColor?: string }; }
export interface AddVehicleInterestRequest extends OrganizationScope { actor: AuthorizationActor; correlationId: string; idempotencyKey: string; customerId: string; leadId: string; vehicleId: string; role: VehicleInterestRole; priority?: number; notes?: string; }
export interface AddTradeVehicleRequest extends OrganizationScope { actor: AuthorizationActor; correlationId: string; idempotencyKey: string; customerId: string; leadId: string; notes?: string; vehicle: { vin: string; year: number; make: string; model: string; trim?: string; exteriorColor?: string } }

export interface VehicleSession {
  acquireIdempotencyLock(scope: OrganizationScope, key: string): Promise<void>;
  findInventoryByIdempotency(scope: OrganizationScope, key: string): Promise<{ vehicle: VehicleRecord; inventory: InventoryUnitRecord } | null>;
  findVehicleByVin(scope: OrganizationScope, vin: string): Promise<VehicleRecord | null>;
  createVehicle(context: RequestContext, input: VehicleRecord): Promise<VehicleRecord>;
  createInventory(context: RequestContext, input: Omit<InventoryUnitRecord, "status">): Promise<InventoryUnitRecord>;
  findInterestByIdempotency(scope: OrganizationScope, key: string): Promise<VehicleInterestRecord | null>;
  interestContextExists(scope: OrganizationScope, input: { customerId: string; leadId: string; vehicleId: string; role: VehicleInterestRole }): Promise<boolean>;
  createInterest(context: RequestContext, input: Omit<VehicleInterestRecord, "status">): Promise<VehicleInterestRecord>;
}
export interface VehicleProvider { transaction<Result>(operation: (session: VehicleSession) => Promise<Result>): Promise<Result>; }

export class VehicleValidationError extends Error { constructor(readonly issues: readonly string[]) { super("Vehicle data is invalid."); this.name = "VehicleValidationError"; } }
export class VehicleIntegrityError extends Error { constructor(message: string) { super(message); this.name = "VehicleIntegrityError"; } }

export class InventoryVehicleService {
  constructor(private readonly provider: VehicleProvider) {}
  async register(request: RegisterInventoryVehicleRequest): Promise<{ vehicle: VehicleRecord; inventory: InventoryUnitRecord; created: boolean }> {
    const normalized = validateInventory(request);
    for (const capability of ["inventory.create", "inventory.read"] as const) assertAuthorized(request.actor, { capability, organizationId: request.organizationId, locationId: request.locationId });
    return this.provider.transaction(async (session) => {
      await session.acquireIdempotencyLock(request, request.idempotencyKey);
      const existing = await session.findInventoryByIdempotency(request, request.idempotencyKey);
      if (existing) return { ...existing, created: false };
      const context = requestContext(request);
      const vehicle = await session.findVehicleByVin(request, normalized.vin) ?? await session.createVehicle(context, {
        id: generateEntityId("veh"), organizationId: request.organizationId, ...(request.locationId ? { locationId: request.locationId } : {}),
        vin: normalized.vin, year: normalized.year, make: normalized.make, model: normalized.model,
        ...(normalized.trim ? { trim: normalized.trim } : {}), ...(normalized.exteriorColor ? { exteriorColor: normalized.exteriorColor } : {}),
      });
      const inventory = await session.createInventory(context, { id: generateEntityId("inv"), organizationId: request.organizationId,
        ...(request.locationId ? { locationId: request.locationId } : {}), vehicleId: vehicle.id,
        stockNumber: normalized.stockNumber, ...(normalized.listPriceCents !== undefined ? { listPriceCents: normalized.listPriceCents } : {}), idempotencyKey: request.idempotencyKey });
      return { vehicle, inventory, created: true };
    });
  }
}

export class VehicleInterestService {
  constructor(private readonly provider: VehicleProvider) {}
  async add(request: AddVehicleInterestRequest): Promise<{ interest: VehicleInterestRecord; created: boolean }> {
    const normalized = validateInterest(request);
    for (const capability of ["inventory.read", "lead.read", "lead.update", "customer.read"] as const) assertAuthorized(request.actor, { capability, organizationId: request.organizationId, locationId: request.locationId });
    return this.provider.transaction(async (session) => {
      await session.acquireIdempotencyLock(request, request.idempotencyKey);
      const existing = await session.findInterestByIdempotency(request, request.idempotencyKey);
      if (existing) return { interest: existing, created: false };
      if (!await session.interestContextExists(request, { customerId: request.customerId, leadId: request.leadId, vehicleId: request.vehicleId, role: request.role })) throw new VehicleIntegrityError("The lead, customer, vehicle, or location context is unavailable.");
      const interest = await session.createInterest(requestContext(request), { id: generateEntityId("vhi"), organizationId: request.organizationId,
        ...(request.locationId ? { locationId: request.locationId } : {}), customerId: request.customerId, leadId: request.leadId,
        vehicleId: request.vehicleId, role: request.role, priority: normalized.priority,
        ...(normalized.notes ? { notes: normalized.notes } : {}), idempotencyKey: request.idempotencyKey });
      return { interest, created: true };
    });
  }
}

export class TradeVehicleService {
  constructor(private readonly provider: VehicleProvider) {}
  async add(request: AddTradeVehicleRequest): Promise<{ vehicle: VehicleRecord; interest: VehicleInterestRecord; created: boolean }> {
    const normalized = validateTradeVehicle(request);
    for (const capability of ["inventory.create", "inventory.read", "lead.read", "lead.update", "customer.read"] as const) assertAuthorized(request.actor, { capability, organizationId: request.organizationId, locationId: request.locationId });
    return this.provider.transaction(async (session) => {
      await session.acquireIdempotencyLock(request, request.idempotencyKey);
      const existing = await session.findInterestByIdempotency(request, request.idempotencyKey);
      if (existing) {
        const vehicle = await session.findVehicleByVin(request, normalized.vin);
        if (!vehicle || vehicle.id !== existing.vehicleId) throw new VehicleIntegrityError("The existing trade interest references an unavailable vehicle.");
        return { vehicle, interest: existing, created: false };
      }
      const context = requestContext(request);
      const vehicle = await session.findVehicleByVin(request, normalized.vin) ?? await session.createVehicle(context, {
        id: generateEntityId("veh"), organizationId: request.organizationId, locationId: request.locationId!,
        vin: normalized.vin, year: normalized.year, make: normalized.make, model: normalized.model,
        ...(normalized.trim ? { trim: normalized.trim } : {}), ...(normalized.exteriorColor ? { exteriorColor: normalized.exteriorColor } : {}),
      });
      if (!await session.interestContextExists(request, { customerId: request.customerId, leadId: request.leadId, vehicleId: vehicle.id, role: "trade" })) throw new VehicleIntegrityError("The Lead, Customer, trade Vehicle, or location context is unavailable.");
      const interest = await session.createInterest(context, { id: generateEntityId("vhi"), organizationId: request.organizationId,
        locationId: request.locationId!, customerId: request.customerId, leadId: request.leadId, vehicleId: vehicle.id,
        role: "trade", priority: 0, ...(normalized.notes ? { notes: normalized.notes } : {}), idempotencyKey: request.idempotencyKey });
      return { vehicle, interest, created: true };
    });
  }
}

function validateInventory(request: RegisterInventoryVehicleRequest) { const issues: string[] = []; const vin = request.vehicle.vin.trim().toUpperCase(); const make = request.vehicle.make.trim(); const model = request.vehicle.model.trim(); const stockNumber = request.stockNumber.trim();
  if (!request.locationId) issues.push("locationId is required."); if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) issues.push("vehicle.vin must be a valid 17-character VIN.");
  if (!Number.isInteger(request.vehicle.year) || request.vehicle.year < 1886 || request.vehicle.year > 2200) issues.push("vehicle.year is invalid.");
  if (!make) issues.push("vehicle.make is required."); if (!model) issues.push("vehicle.model is required."); if (!stockNumber) issues.push("stockNumber is required.");
  if (request.listPriceCents !== undefined && (!Number.isSafeInteger(request.listPriceCents) || request.listPriceCents < 0)) issues.push("listPriceCents must be a nonnegative integer.");
  if (!request.idempotencyKey.trim()) issues.push("idempotencyKey is required."); if (issues.length) throw new VehicleValidationError(issues);
  return { vin, year: request.vehicle.year, make, model, stockNumber, ...(request.vehicle.trim?.trim() ? { trim: request.vehicle.trim.trim() } : {}), ...(request.vehicle.exteriorColor?.trim() ? { exteriorColor: request.vehicle.exteriorColor.trim() } : {}), ...(request.listPriceCents !== undefined ? { listPriceCents: request.listPriceCents } : {}) }; }
function validateInterest(request: AddVehicleInterestRequest) { const issues: string[] = []; const priority = request.priority ?? 0; const notes = request.notes?.trim();
  if (!request.locationId?.trim()) issues.push("locationId is required."); if (!request.customerId.trim()) issues.push("customerId is required."); if (!request.leadId.trim()) issues.push("leadId is required."); if (!request.vehicleId.trim()) issues.push("vehicleId is required.");
  if (!Number.isSafeInteger(priority) || priority < 0) issues.push("priority must be a nonnegative integer."); if (notes && notes.length > 1000) issues.push("notes must not exceed 1000 characters."); if (!request.idempotencyKey.trim()) issues.push("idempotencyKey is required.");
  if (issues.length) throw new VehicleValidationError(issues); return { priority, ...(notes ? { notes } : {}) }; }
function validateTradeVehicle(request: AddTradeVehicleRequest) { const issues: string[] = []; const vin=request.vehicle.vin.trim().toUpperCase(); const make=request.vehicle.make.trim(); const model=request.vehicle.model.trim(); const notes=request.notes?.trim(); if(!request.locationId?.trim())issues.push("locationId is required."); if(!request.customerId.trim())issues.push("customerId is required."); if(!request.leadId.trim())issues.push("leadId is required."); if(!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin))issues.push("vehicle.vin must be a valid 17-character VIN."); if(!Number.isInteger(request.vehicle.year)||request.vehicle.year<1886||request.vehicle.year>2200)issues.push("vehicle.year is invalid."); if(!make)issues.push("vehicle.make is required."); if(!model)issues.push("vehicle.model is required."); if(notes&&notes.length>1000)issues.push("notes must not exceed 1000 characters."); if(!request.idempotencyKey.trim())issues.push("idempotencyKey is required."); if(issues.length)throw new VehicleValidationError(issues); return{vin,year:request.vehicle.year,make,model,...(request.vehicle.trim?.trim()?{trim:request.vehicle.trim.trim()}:{}),...(request.vehicle.exteriorColor?.trim()?{exteriorColor:request.vehicle.exteriorColor.trim()}:{}),...(notes?{notes}:{})}; }
function requestContext(request: { actor: AuthorizationActor; organizationId: string; locationId?: string; correlationId: string }): RequestContext { return { actorId: request.actor.userId, organizationId: request.organizationId, correlationId: request.correlationId, ...(request.locationId ? { locationId: request.locationId } : {}) }; }
