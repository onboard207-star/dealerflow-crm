import type { Pool } from "pg";

import {
  DealVehicleChangeIntegrityError,
  type DealVehicleChangeEvent,
  type DealVehicleChangeProvider,
  type DealVehicleChangeSession,
} from "@/lib/application/deals";
import { generateEntityId } from "@/lib/core/identifiers";
import type { OrganizationScope, RequestContext } from "@/lib/platform/data";
import { withTenantDatabaseContext } from "@/lib/server/database";
import type { SqlExecutor } from "@/lib/server/data";

export class PostgresDealVehicleChangeProvider implements DealVehicleChangeProvider {
  constructor(
    private readonly pool: Pool,
    private readonly tenant: { userId: string; organizationId: string },
  ) {}

  transaction<T>(operation: (session: DealVehicleChangeSession) => Promise<T>) {
    return withTenantDatabaseContext(this.pool, this.tenant, (client) =>
      operation(new Session(client as unknown as SqlExecutor)),
    );
  }
}

type EventRow = Record<string, unknown> & {
  id: string;
  organization_id: string;
  location_id: string;
  deal_id: string;
  customer_id: string;
  lead_id: string;
  from_vehicle_id: string;
  from_inventory_unit_id: string | null;
  to_vehicle_id: string;
  to_inventory_unit_id: string;
  reason: string;
  invalidated_quote_ids: string[];
  occurred_at: Date;
  idempotency_key: string;
};

class Session implements DealVehicleChangeSession {
  constructor(private readonly db: SqlExecutor) {}

  async lock(scope: OrganizationScope, key: string) {
    await this.db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `${scope.organizationId}:${key}`,
    ]);
  }

  async findByIdempotency(scope: OrganizationScope, key: string) {
    const result = await this.db.query<EventRow>(
      "SELECT * FROM deal_vehicle_change_events WHERE organization_id=$1 AND idempotency_key=$2",
      [scope.organizationId, key],
    );
    return result.rows[0] ? mapEvent(result.rows[0]) : null;
  }

  async getContext(
    scope: OrganizationScope,
    input: {
      dealId: string;
      customerId: string;
      leadId: string;
      toVehicleId: string;
      toInventoryUnitId: string;
    },
  ) {
    const result = await this.db.query<{
      location_id: string;
      status: string;
      primary_vehicle_id: string;
      inventory_unit_id: string | null;
      approval_started: boolean;
      accepted_started: boolean;
      documents_started: boolean;
      delivery_started: boolean;
      target_valid: boolean;
    }>(
      `SELECT d.location_id,d.status::text,d.primary_vehicle_id,d.inventory_unit_id,
        EXISTS(SELECT 1 FROM deal_quote_approvals a
          JOIN deal_quotes q ON q.organization_id=a.organization_id AND q.id=a.quote_id
          WHERE q.organization_id=d.organization_id AND q.deal_id=d.id) approval_started,
        EXISTS(SELECT 1 FROM deal_quotes q
          WHERE q.organization_id=d.organization_id AND q.deal_id=d.id
            AND q.status IN ('presented','accepted')) accepted_started,
        EXISTS(SELECT 1 FROM deal_document_requirements x
          WHERE x.organization_id=d.organization_id AND x.deal_id=d.id) documents_started,
        EXISTS(SELECT 1 FROM deal_deliveries x
          WHERE x.organization_id=d.organization_id AND x.deal_id=d.id) delivery_started,
        EXISTS(SELECT 1 FROM inventory_units i
          JOIN vehicles v ON v.organization_id=i.organization_id AND v.id=i.vehicle_id
          JOIN lead_vehicle_interests vi
            ON vi.organization_id=i.organization_id AND vi.vehicle_id=i.vehicle_id
           AND vi.customer_id=d.customer_id AND vi.lead_id=d.lead_id
           AND vi.role='primary' AND vi.status='active'
          WHERE i.organization_id=d.organization_id AND i.location_id=d.location_id
            AND i.id=$6 AND i.vehicle_id=$5 AND i.status='available') target_valid
       FROM deals d
       WHERE d.organization_id=$1 AND d.id=$2 AND d.customer_id=$3 AND d.lead_id=$4
       FOR UPDATE`,
      [scope.organizationId, input.dealId, input.customerId, input.leadId, input.toVehicleId, input.toInventoryUnitId],
    );
    const row = result.rows[0];
    if (!row || !row.target_valid) return null;
    const blockingReason = row.approval_started
      ? "Vehicle change is unavailable after Quote approval has begun."
      : row.accepted_started
        ? "Vehicle change is unavailable after a Quote was presented or accepted."
        : row.documents_started
          ? "Vehicle change is unavailable after document work has begun."
          : row.delivery_started
            ? "Vehicle change is unavailable after delivery work has begun."
            : undefined;
    return {
      locationId: row.location_id,
      status: row.status,
      fromVehicleId: row.primary_vehicle_id,
      ...(row.inventory_unit_id ? { fromInventoryUnitId: row.inventory_unit_id } : {}),
      ...(blockingReason ? { blockingReason } : {}),
    };
  }

  async change(context: RequestContext, event: DealVehicleChangeEvent) {
    const quotes = await this.db.query<{ id: string }>(
      "SELECT id FROM deal_quotes WHERE organization_id=$1 AND deal_id=$2 AND status='draft' FOR UPDATE",
      [event.organizationId, event.dealId],
    );
    for (const quote of quotes.rows) {
      await this.db.query(
        "UPDATE deal_quotes SET status='expired',expires_at=$3,updated_by=$4,updated_at=$3 WHERE organization_id=$1 AND id=$2 AND status='draft'",
        [event.organizationId, quote.id, event.occurredAt, context.actorId],
      );
      await this.db.query(
        "INSERT INTO deal_quote_status_events(id,organization_id,quote_id,from_status,to_status,reason,occurred_at,idempotency_key,created_by) VALUES($1,$2,$3,'draft','expired',$4,$5,$6,$7)",
        [
          generateEntityId("qse"),
          event.organizationId,
          quote.id,
          "Invalidated by Deal vehicle change.",
          event.occurredAt,
          `deal-vehicle:${event.id}:quote:${quote.id}`,
          context.actorId,
        ],
      );
    }

    const invalidatedQuoteIds = quotes.rows.map((quote) => quote.id);
    await this.db.query(
      "INSERT INTO deal_vehicle_change_events(id,organization_id,location_id,deal_id,customer_id,lead_id,from_vehicle_id,from_inventory_unit_id,to_vehicle_id,to_inventory_unit_id,reason,invalidated_quote_ids,occurred_at,idempotency_key,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)",
      [
        event.id,
        event.organizationId,
        event.locationId,
        event.dealId,
        event.customerId,
        event.leadId,
        event.fromVehicleId,
        event.fromInventoryUnitId ?? null,
        event.toVehicleId,
        event.toInventoryUnitId,
        event.reason,
        invalidatedQuoteIds,
        event.occurredAt,
        event.idempotencyKey,
        context.actorId,
      ],
    );

    const updated = await this.db.query<{ id: string }>(
      "UPDATE deals SET primary_vehicle_id=$3,inventory_unit_id=$4,updated_by=$5,updated_at=$6 WHERE organization_id=$1 AND id=$2 AND primary_vehicle_id=$7 AND inventory_unit_id IS NOT DISTINCT FROM $8 AND status IN ('draft','working') RETURNING id",
      [
        event.organizationId,
        event.dealId,
        event.toVehicleId,
        event.toInventoryUnitId,
        context.actorId,
        event.occurredAt,
        event.fromVehicleId,
        event.fromInventoryUnitId ?? null,
      ],
    );
    if (!updated.rows[0]) {
      throw new DealVehicleChangeIntegrityError("The Deal changed concurrently; no Vehicle replacement was applied.");
    }

    await this.db.query(
      "INSERT INTO audit_logs(id,organization_id,actor_id,action,entity_type,entity_id,source,correlation_id,old_values,new_values) VALUES($1,$2,$3,'deal.vehicle_changed','deal',$4,'application',$5,$6::jsonb,$7::jsonb)",
      [
        generateEntityId("aud"),
        event.organizationId,
        context.actorId,
        event.dealId,
        context.correlationId,
        JSON.stringify({ vehicleId: event.fromVehicleId, inventoryUnitId: event.fromInventoryUnitId ?? null }),
        JSON.stringify({
          vehicleId: event.toVehicleId,
          inventoryUnitId: event.toInventoryUnitId,
          invalidatedQuoteIds,
        }),
      ],
    );
  }
}

function mapEvent(row: EventRow): DealVehicleChangeEvent {
  return {
    id: row.id,
    organizationId: row.organization_id,
    locationId: row.location_id,
    dealId: row.deal_id,
    customerId: row.customer_id,
    leadId: row.lead_id,
    fromVehicleId: row.from_vehicle_id,
    ...(row.from_inventory_unit_id ? { fromInventoryUnitId: row.from_inventory_unit_id } : {}),
    toVehicleId: row.to_vehicle_id,
    toInventoryUnitId: row.to_inventory_unit_id,
    reason: row.reason,
    invalidatedQuoteIds: row.invalidated_quote_ids,
    occurredAt: row.occurred_at.toISOString(),
    idempotencyKey: row.idempotency_key,
  };
}
