import type { Pool } from "pg";

import {
  InventoryCostIntegrityError,
  type InventoryCostProvider,
  type InventoryCostSession,
  type InventoryCostSnapshot,
} from "@/lib/application/inventory";
import { generateEntityId } from "@/lib/core/identifiers";
import type { OrganizationScope, RequestContext } from "@/lib/platform/data";
import type { SqlExecutor } from "@/lib/server/data";
import { withTenantDatabaseContext } from "@/lib/server/database";

export class PostgresInventoryCostProvider implements InventoryCostProvider {
  constructor(
    private readonly pool: Pool,
    private readonly tenant: { userId: string; organizationId: string },
  ) {}

  transaction<Result>(operation: (session: InventoryCostSession) => Promise<Result>) {
    return withTenantDatabaseContext(this.pool, this.tenant, (client) =>
      operation(new Session(client as unknown as SqlExecutor)),
    );
  }
}

type CostRow = {
  id: string;
  organization_id: string;
  location_id: string;
  inventory_unit_id: string;
  version: number;
  previous_snapshot_id: string | null;
  cost_cents: number;
  source_type: InventoryCostSnapshot["sourceType"];
  source_label: string;
  source_reference: string | null;
  effective_at: Date;
  captured_at: Date;
  captured_by: string;
};

class Session implements InventoryCostSession {
  constructor(private readonly db: SqlExecutor) {}

  async getInventoryUnit(scope: OrganizationScope, inventoryUnitId: string) {
    const result = await this.db.query<{ location_id: string }>(
      "SELECT location_id FROM inventory_units WHERE organization_id=$1 AND id=$2 FOR UPDATE",
      [scope.organizationId, inventoryUnitId],
    );
    return result.rows[0] ? { locationId: result.rows[0].location_id } : null;
  }

  async getLatest(scope: OrganizationScope, inventoryUnitId: string) {
    const result = await this.db.query<CostRow>(
      `SELECT id,organization_id,location_id,inventory_unit_id,version,previous_snapshot_id,cost_cents,
        source_type,source_label,source_reference,effective_at,captured_at,captured_by
       FROM inventory_cost_snapshots
       WHERE organization_id=$1 AND inventory_unit_id=$2
       ORDER BY version DESC LIMIT 1 FOR UPDATE`,
      [scope.organizationId, inventoryUnitId],
    );
    return result.rows[0] ? snapshot(result.rows[0]) : null;
  }

  async insert(context: RequestContext, value: InventoryCostSnapshot) {
    const result = await this.db.query<CostRow>(
      `INSERT INTO inventory_cost_snapshots(
        id,organization_id,location_id,inventory_unit_id,version,previous_snapshot_id,cost_cents,
        source_type,source_label,source_reference,effective_at,captured_at,captured_by
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id,organization_id,location_id,inventory_unit_id,version,previous_snapshot_id,cost_cents,
        source_type,source_label,source_reference,effective_at,captured_at,captured_by`,
      [
        value.id,
        context.organizationId,
        context.locationId,
        value.inventoryUnitId,
        value.version,
        value.previousSnapshotId ?? null,
        value.costCents,
        value.sourceType,
        value.sourceLabel,
        value.sourceReference ?? null,
        value.effectiveAt,
        value.capturedAt,
        context.actorId,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new InventoryCostIntegrityError("The inventory cost revision could not be recorded.");
    await this.db.query(
      `INSERT INTO audit_logs(
        id,organization_id,actor_id,action,entity_type,entity_id,source,correlation_id,old_values,new_values
       ) VALUES($1,$2,$3,'inventory.cost_recorded','inventory_unit',$4,'application',$5,$6::jsonb,$7::jsonb)`,
      [
        generateEntityId("aud"),
        context.organizationId,
        context.actorId,
        value.inventoryUnitId,
        context.correlationId,
        JSON.stringify(value.previousSnapshotId ? { previousSnapshotId: value.previousSnapshotId, previousVersion: value.version - 1 } : null),
        JSON.stringify({ snapshotId: value.id, locationId: context.locationId, version: value.version, costCents: value.costCents, sourceType: value.sourceType, sourceLabel: value.sourceLabel, sourceReference: value.sourceReference ?? null, effectiveAt: value.effectiveAt }),
      ],
    );
    return snapshot(row);
  }
}

function snapshot(row: CostRow): InventoryCostSnapshot {
  return {
    id: row.id,
    organizationId: row.organization_id,
    locationId: row.location_id,
    inventoryUnitId: row.inventory_unit_id,
    version: row.version,
    ...(row.previous_snapshot_id ? { previousSnapshotId: row.previous_snapshot_id } : {}),
    costCents: row.cost_cents,
    sourceType: row.source_type,
    sourceLabel: row.source_label,
    ...(row.source_reference ? { sourceReference: row.source_reference } : {}),
    effectiveAt: row.effective_at.toISOString(),
    capturedAt: row.captured_at.toISOString(),
    capturedBy: row.captured_by,
  };
}
