import type { Pool } from "pg";
import { DealIntegrityError, type DealProvider, type DealRecord, type DealSession, type DealStatusEvent } from "@/lib/application/deals";
import { generateEntityId } from "@/lib/core/identifiers";
import type { OrganizationScope, RequestContext } from "@/lib/platform/data";
import type { SqlExecutor } from "@/lib/server/data";
import { withTenantDatabaseContext } from "@/lib/server/database";

export class PostgresDealProvider implements DealProvider {
  constructor(private readonly pool: Pool, private readonly context: { userId: string; organizationId: string }) {}
  transaction<Result>(operation: (session: DealSession) => Promise<Result>) { return withTenantDatabaseContext(this.pool, this.context, (client) => operation(new Session(client as unknown as SqlExecutor))); }
}
type DealRow = { id: string; organization_id: string; location_id: string; customer_id: string; lead_id: string; primary_vehicle_id: string; inventory_unit_id: string | null; owner_user_id: string | null; deal_number: string; status: DealRecord["status"]; purchase_type: DealRecord["purchaseType"] | null; agreed_price_cents: number | null; idempotency_key: string };
type EventRow = { id: string; organization_id: string; deal_id: string; from_status: DealStatusEvent["fromStatus"] | null; to_status: DealStatusEvent["toStatus"]; reason: string | null; occurred_at: Date; idempotency_key: string };
const columns = "id, organization_id, location_id, customer_id, lead_id, primary_vehicle_id, inventory_unit_id, owner_user_id, deal_number, status, purchase_type, agreed_price_cents, idempotency_key";
class Session implements DealSession {
  constructor(private readonly db: SqlExecutor) {}
  async acquireIdempotencyLock(scope: OrganizationScope, key: string) { await this.db.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`${scope.organizationId}:${key}`]); }
  async findDealByIdempotency(scope: OrganizationScope, key: string) { const result = await this.db.query<DealRow>(`SELECT ${columns} FROM deals WHERE organization_id = $1 AND idempotency_key = $2 LIMIT 1`, [scope.organizationId, key]); return result.rows[0] ? deal(result.rows[0]) : null; }
  async creationContextExists(scope: OrganizationScope, input: { customerId: string; leadId: string; vehicleId: string; inventoryUnitId?: string; ownerUserId?: string }) { const result = await this.db.query<{ exists: boolean }>(`SELECT EXISTS (SELECT 1 FROM leads l
      JOIN vehicles v ON v.organization_id = l.organization_id AND v.id = $4
      WHERE l.organization_id = $1 AND l.customer_id = $2 AND l.id = $3
        AND l.status IN ('open','working','qualified') AND (l.location_id IS NULL OR l.location_id=$7)
        AND NOT EXISTS (SELECT 1 FROM deals existing WHERE existing.organization_id=l.organization_id
          AND existing.lead_id=l.id AND existing.status <> 'cancelled')
        AND ($5::text IS NULL OR EXISTS (SELECT 1 FROM inventory_units i WHERE i.organization_id = l.organization_id
          AND i.location_id = $7 AND i.vehicle_id = v.id AND i.id = $5 AND i.status IN ('available','hold')))
        AND ($6::text IS NULL OR EXISTS (SELECT 1 FROM organization_memberships m WHERE m.organization_id = l.organization_id
          AND m.user_id = $6 AND m.status = 'active'))) AS exists`, [scope.organizationId, input.customerId, input.leadId, input.vehicleId, input.inventoryUnitId ?? null, input.ownerUserId ?? null, scope.locationId ?? null]); return result.rows[0]?.exists === true; }
  async createDeal(context: RequestContext, record: DealRecord, event: DealStatusEvent) { try { await this.db.query(`INSERT INTO deals (id, organization_id, location_id, customer_id, lead_id, primary_vehicle_id,
      inventory_unit_id, owner_user_id, deal_number, status, purchase_type, agreed_price_cents, idempotency_key, created_by, updated_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14)`, [record.id, record.organizationId, record.locationId, record.customerId, record.leadId, record.primaryVehicleId, record.inventoryUnitId ?? null, record.ownerUserId ?? null, record.dealNumber, record.status, record.purchaseType ?? null, record.agreedPriceCents ?? null, record.idempotencyKey, context.actorId]); } catch (error) { if (isUniqueViolation(error)) throw new DealIntegrityError("This Lead already has an active Deal."); throw error; } await insertEvent(this.db, context, event); await audit(this.db, context, "deal.created", record.id); return record; }
  async findTransitionByIdempotency(scope: OrganizationScope, key: string) { const result = await this.db.query<DealRow & { event_id: string; from_status: EventRow["from_status"]; to_status: EventRow["to_status"]; reason: string | null; occurred_at: Date; event_key: string }>(`SELECT d.*, e.id AS event_id, e.from_status, e.to_status, e.reason, e.occurred_at, e.idempotency_key AS event_key FROM deal_status_events e JOIN deals d ON d.organization_id = e.organization_id AND d.id = e.deal_id WHERE e.organization_id = $1 AND e.idempotency_key = $2 LIMIT 1`, [scope.organizationId, key]); const row = result.rows[0]; return row ? { deal: deal(row), event: event({ id: row.event_id, organization_id: row.organization_id, deal_id: row.id, from_status: row.from_status, to_status: row.to_status, reason: row.reason, occurred_at: row.occurred_at, idempotency_key: row.event_key }) } : null; }
  async getDealForUpdate(scope: OrganizationScope, dealId: string) { const result = await this.db.query<DealRow>(`SELECT ${columns} FROM deals WHERE organization_id = $1 AND id = $2 FOR UPDATE`, [scope.organizationId, dealId]); return result.rows[0] ? deal(result.rows[0]) : null; }
  async deliveryCompleted(scope: OrganizationScope, dealId: string) { const result = await this.db.query<{ ready: boolean }>("SELECT EXISTS (SELECT 1 FROM deal_deliveries WHERE organization_id = $1 AND deal_id = $2 AND status = 'completed') AS ready", [scope.organizationId, dealId]); return result.rows[0]?.ready === true; }
  async transitionDeal(context: RequestContext, record: DealRecord, statusEvent: DealStatusEvent) {
    if (record.status === "delivered") {
      const delivery = await this.db.query<{ ready: boolean }>(`SELECT EXISTS (SELECT 1 FROM deal_deliveries
        WHERE organization_id = $1 AND deal_id = $2 AND status = 'completed') AS ready`, [record.organizationId, record.id]);
      if (delivery.rows[0]?.ready !== true) throw new DealIntegrityError("A completed delivery handoff is required before the Deal can be delivered.");
    }
    if (record.inventoryUnitId && (record.status === "contracted" || record.status === "delivered")) {
      const inventoryUpdate = await this.db.query<{ id: string }>(`UPDATE inventory_units SET status = $3,
        sold_at = CASE WHEN $3 = 'sold' THEN now() ELSE sold_at END, updated_by = $4, updated_at = now()
        WHERE organization_id = $1 AND id = $2 AND status IN ('available','hold') RETURNING id`,
      [record.organizationId, record.inventoryUnitId, record.status === "delivered" ? "sold" : "hold", context.actorId]);
      if (!inventoryUpdate.rows[0]) throw new DealIntegrityError("Deal inventory is no longer available.");
    }
    const update = await this.db.query<{ id: string }>(`UPDATE deals SET status = $3, updated_by = $4, updated_at = now() WHERE organization_id = $1 AND id = $2 AND status = $5 RETURNING id`, [record.organizationId, record.id, record.status, context.actorId, statusEvent.fromStatus]); if (!update.rows[0]) throw new Error("Concurrent deal transition was rejected.");
    if (record.status === "delivered") {
      const leadUpdate=await this.db.query<{from_status:"open"|"working"|"qualified"}>(`WITH current AS (SELECT status FROM leads WHERE organization_id=$1 AND id=$2 AND customer_id=$3 AND status IN ('open','working','qualified') FOR UPDATE), updated AS (UPDATE leads lead SET status='sold',stage='delivered',lost_reason=NULL,updated_by=$4,updated_at=now() FROM current WHERE lead.organization_id=$1 AND lead.id=$2 RETURNING current.status AS from_status) SELECT from_status FROM updated`,[record.organizationId,record.leadId,record.customerId,context.actorId]);
      if(!leadUpdate.rows[0])throw new DealIntegrityError("The Lead is no longer eligible for sale completion.");
      await this.db.query("INSERT INTO lead_status_events(id,organization_id,lead_id,from_status,to_status,occurred_at,idempotency_key,created_by) VALUES($1,$2,$3,$4,'sold',now(),$5,$6)",[generateEntityId("lse"),record.organizationId,record.leadId,leadUpdate.rows[0].from_status,`deal-delivered:${record.id}`,context.actorId]);
      await this.db.query(`UPDATE lead_vehicle_interests SET status = CASE WHEN vehicle_id = $4 THEN 'purchased' ELSE 'inactive' END,
        updated_by = $5, updated_at = now() WHERE organization_id = $1 AND lead_id = $2 AND customer_id = $3 AND status = 'active'`,
      [record.organizationId, record.leadId, record.customerId, record.primaryVehicleId, context.actorId]);
    }
    await insertEvent(this.db, context, statusEvent); await audit(this.db, context, "deal.status_changed", record.id); return record;
  }
}
function deal(row: DealRow): DealRecord { return { id: row.id, organizationId: row.organization_id, locationId: row.location_id, customerId: row.customer_id, leadId: row.lead_id, primaryVehicleId: row.primary_vehicle_id, ...(row.inventory_unit_id ? { inventoryUnitId: row.inventory_unit_id } : {}), ...(row.owner_user_id ? { ownerUserId: row.owner_user_id } : {}), dealNumber: row.deal_number, status: row.status, ...(row.purchase_type ? { purchaseType: row.purchase_type } : {}), ...(row.agreed_price_cents !== null ? { agreedPriceCents: row.agreed_price_cents } : {}), idempotencyKey: row.idempotency_key }; }
function event(row: EventRow): DealStatusEvent { return { id: row.id, organizationId: row.organization_id, dealId: row.deal_id, ...(row.from_status ? { fromStatus: row.from_status } : {}), toStatus: row.to_status, ...(row.reason ? { reason: row.reason } : {}), occurredAt: row.occurred_at.toISOString(), idempotencyKey: row.idempotency_key }; }
async function insertEvent(db: SqlExecutor, context: RequestContext, item: DealStatusEvent) { await db.query(`INSERT INTO deal_status_events (id, organization_id, deal_id, from_status, to_status, reason, occurred_at, idempotency_key, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [item.id, item.organizationId, item.dealId, item.fromStatus ?? null, item.toStatus, item.reason ?? null, item.occurredAt, item.idempotencyKey, context.actorId]); }
async function audit(db: SqlExecutor, context: RequestContext, action: string, entityId: string) { await db.query(`INSERT INTO audit_logs (id, organization_id, actor_id, action, entity_type, entity_id, source, correlation_id) VALUES ($1,$2,$3,$4,'deal',$5,'application',$6)`, [generateEntityId("aud"), context.organizationId, context.actorId, action, entityId, context.correlationId]); }
function isUniqueViolation(error: unknown): boolean { return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "23505"; }
