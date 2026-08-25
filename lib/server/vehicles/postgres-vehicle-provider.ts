import type { Pool } from "pg";

import type { InventoryUnitRecord, VehicleInterestRecord, VehicleProvider, VehicleRecord, VehicleSession } from "@/lib/application/vehicles";
import { generateEntityId } from "@/lib/core/identifiers";
import type { OrganizationScope, RequestContext } from "@/lib/platform/data";
import type { SqlExecutor } from "@/lib/server/data";
import { withTenantDatabaseContext } from "@/lib/server/database";
import { appendSystemInventoryEvent } from "./inventory-events";

export class PostgresVehicleProvider implements VehicleProvider {
  constructor(private readonly pool: Pool, private readonly context: { userId: string; organizationId: string }) {}
  transaction<Result>(operation: (session: VehicleSession) => Promise<Result>) { return withTenantDatabaseContext(this.pool, this.context, (client) => operation(new Session(client as unknown as SqlExecutor))); }
}

type VehicleRow = { id: string; organization_id: string; vin: string; year: number; make: string; model: string; trim: string | null; exterior_color: string | null };
type InventoryRow = { id: string; organization_id: string; location_id: string; vehicle_id: string; stock_number: string; status: InventoryUnitRecord["status"]; list_price_cents: number | null; idempotency_key: string };
type InterestRow = { id: string; organization_id: string; customer_id: string; lead_id: string; vehicle_id: string; role: VehicleInterestRecord["role"]; status: VehicleInterestRecord["status"]; priority: number; notes: string | null; idempotency_key: string };

class Session implements VehicleSession {
  constructor(private readonly db: SqlExecutor) {}
  async acquireIdempotencyLock(scope: OrganizationScope, key: string) { await this.db.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`${scope.organizationId}:${key}`]); }
  async findInventoryByIdempotency(scope: OrganizationScope, key: string) { const result = await this.db.query<InventoryRow & VehicleRow>(`SELECT i.id, i.organization_id, i.location_id, i.vehicle_id, i.stock_number, i.status, i.list_price_cents, i.idempotency_key,
      v.id AS v_id, v.vin, v.year, v.make, v.model, v.trim, v.exterior_color FROM inventory_units i
      JOIN vehicles v ON v.organization_id = i.organization_id AND v.id = i.vehicle_id
      WHERE i.organization_id = $1 AND i.idempotency_key = $2 LIMIT 1`, [scope.organizationId, key]);
    const row = result.rows[0] as (InventoryRow & VehicleRow & { v_id?: string }) | undefined; return row ? { vehicle: vehicle({ ...row, id: row.v_id ?? row.vehicle_id }), inventory: inventory(row) } : null; }
  async findVehicleByVin(scope: OrganizationScope, vin: string) { const result = await this.db.query<VehicleRow>("SELECT id, organization_id, vin, year, make, model, trim, exterior_color FROM vehicles WHERE organization_id = $1 AND vin = $2 LIMIT 1", [scope.organizationId, vin]); return result.rows[0] ? vehicle(result.rows[0]) : null; }
  async createVehicle(context: RequestContext, input: VehicleRecord) { const result = await this.db.query<VehicleRow>(`INSERT INTO vehicles (id, organization_id, vin, year, make, model, trim, exterior_color, created_by, updated_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)
      ON CONFLICT (organization_id, vin) DO UPDATE SET updated_at = vehicles.updated_at
      RETURNING id, organization_id, vin, year, make, model, trim, exterior_color`,
    [input.id, input.organizationId, input.vin, input.year, input.make, input.model, input.trim ?? null, input.exteriorColor ?? null, context.actorId]);
    const row = result.rows[0]; if (!row) throw new Error("Database did not return the vehicle."); await audit(this.db, context, "vehicle.resolved", "vehicle", row.id); return vehicle(row); }
  async createInventory(context: RequestContext, input: Omit<InventoryUnitRecord, "status">) { const result = await this.db.query<InventoryRow>(`INSERT INTO inventory_units
      (id, organization_id, location_id, vehicle_id, stock_number, idempotency_key, list_price_cents, status, acquired_at, created_by, updated_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'available',now(),$8,$8) RETURNING id, organization_id, location_id, vehicle_id, stock_number, status, list_price_cents, idempotency_key`,
    [input.id, input.organizationId, input.locationId, input.vehicleId, input.stockNumber, input.idempotencyKey, input.listPriceCents ?? null, context.actorId]);
    const row = result.rows[0]; if (!row) throw new Error("Database did not return inventory.");await appendSystemInventoryEvent(this.db,context,{inventoryUnitId:row.id,kind:"created",toStatus:"available",...(row.list_price_cents!==null?{newPriceCents:row.list_price_cents}:{}),idempotencyKey:`create:${input.idempotencyKey}`}); await audit(this.db, context, "inventory.created", "inventory_unit", row.id); return inventory(row); }
  async findInterestByIdempotency(scope: OrganizationScope, key: string) { const result = await this.db.query<InterestRow>("SELECT * FROM lead_vehicle_interests WHERE organization_id = $1 AND idempotency_key = $2 LIMIT 1", [scope.organizationId, key]); return result.rows[0] ? interest(result.rows[0]) : null; }
  async interestContextExists(scope: OrganizationScope, input: { customerId: string; leadId: string; vehicleId: string; role: "primary" | "alternative" | "trade" }) { const result = await this.db.query<{ exists: boolean }>(`SELECT EXISTS (
      SELECT 1 FROM leads l JOIN vehicles v ON v.organization_id=l.organization_id AND v.id=$4
      WHERE l.organization_id=$1 AND l.customer_id=$2 AND l.id=$3
        AND l.status IN ('open','working','qualified') AND (l.location_id IS NULL OR l.location_id=$5)
        AND ($6='trade' OR EXISTS(SELECT 1 FROM inventory_units i WHERE i.organization_id=l.organization_id
          AND i.vehicle_id=v.id AND i.location_id=$5 AND i.status IN ('available','hold')))) AS exists`,
    [scope.organizationId, input.customerId, input.leadId, input.vehicleId, scope.locationId ?? null, input.role]); return result.rows[0]?.exists === true; }
  async createInterest(context: RequestContext, input: Omit<VehicleInterestRecord, "status">) { const result = await this.db.query<InterestRow>(`INSERT INTO lead_vehicle_interests
      (id, organization_id, customer_id, lead_id, vehicle_id, role, status, priority, notes, idempotency_key, created_by, updated_by)
      VALUES ($1,$2,$3,$4,$5,$6,'active',$7,$8,$9,$10,$10) RETURNING *`,
    [input.id, input.organizationId, input.customerId, input.leadId, input.vehicleId, input.role, input.priority, input.notes ?? null, input.idempotencyKey, context.actorId]);
    const row = result.rows[0]; if (!row) throw new Error("Database did not return vehicle interest."); await audit(this.db, context, "vehicle_interest.created", "vehicle_interest", row.id); return interest(row); }
}

function vehicle(row: VehicleRow): VehicleRecord { return { id: row.id, organizationId: row.organization_id, vin: row.vin, year: row.year, make: row.make, model: row.model, ...(row.trim ? { trim: row.trim } : {}), ...(row.exterior_color ? { exteriorColor: row.exterior_color } : {}) }; }
function inventory(row: InventoryRow): InventoryUnitRecord { return { id: row.id, organizationId: row.organization_id, locationId: row.location_id, vehicleId: row.vehicle_id, stockNumber: row.stock_number, status: row.status, ...(row.list_price_cents !== null ? { listPriceCents: row.list_price_cents } : {}), idempotencyKey: row.idempotency_key }; }
function interest(row: InterestRow): VehicleInterestRecord { return { id: row.id, organizationId: row.organization_id, customerId: row.customer_id, leadId: row.lead_id, vehicleId: row.vehicle_id, role: row.role, status: row.status, priority: row.priority, ...(row.notes ? { notes: row.notes } : {}), idempotencyKey: row.idempotency_key }; }
async function audit(db: SqlExecutor, context: RequestContext, action: string, entityType: string, entityId: string) { await db.query(`INSERT INTO audit_logs (id, organization_id, actor_id, action, entity_type, entity_id, source, correlation_id)
    VALUES ($1,$2,$3,$4,$5,$6,'application',$7)`, [generateEntityId("aud"), context.organizationId, context.actorId, action, entityType, entityId, context.correlationId]); }
