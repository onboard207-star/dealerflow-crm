import type { Pool } from "pg";
import { QuoteProfitabilityIntegrityError, type QuoteProfitabilityProvider, type QuoteProfitabilitySession } from "@/lib/application/deals";
import { generateEntityId } from "@/lib/core/identifiers";
import type { OrganizationScope, RequestContext } from "@/lib/platform/data";
import type { SqlExecutor } from "@/lib/server/data";
import { withTenantDatabaseContext } from "@/lib/server/database";

export class PostgresQuoteProfitabilityProvider implements QuoteProfitabilityProvider {
  constructor(private readonly pool: Pool, private readonly tenant: { userId: string; organizationId: string }) {}
  transaction<Result>(operation: (session: QuoteProfitabilitySession) => Promise<Result>) {
    return withTenantDatabaseContext(this.pool, this.tenant, (client) => operation(new Session(client as unknown as SqlExecutor)));
  }
}

class Session implements QuoteProfitabilitySession {
  constructor(private readonly db: SqlExecutor) {}
  async getQuoteContext(scope: OrganizationScope, quoteId: string) {
    const result = await this.db.query<{ status: string; location_id: string; inventory_unit_id: string | null; vehicle_sell_cents: number }>(
      `SELECT q.status::text,d.location_id,d.inventory_unit_id,l.total_cents AS vehicle_sell_cents
       FROM deal_quotes q JOIN deals d ON d.organization_id=q.organization_id AND d.id=q.deal_id
       JOIN deal_quote_lines l ON l.organization_id=q.organization_id AND l.quote_id=q.id AND l.category='vehicle'
       WHERE q.organization_id=$1 AND q.id=$2 LIMIT 1 FOR UPDATE OF q`,
      [scope.organizationId, quoteId],
    );
    const row = result.rows[0];
    return row ? { status: row.status, locationId: row.location_id, ...(row.inventory_unit_id ? { inventoryUnitId: row.inventory_unit_id } : {}), vehicleSellCents: row.vehicle_sell_cents } : null;
  }
  async getPackPolicy(scope: OrganizationScope, locationId: string) {
    const result = await this.db.query<{ id: string; enabled: boolean; pack_amount_cents: number | null }>(
      `SELECT id,enabled,pack_amount_cents FROM quote_pack_policies
       WHERE organization_id=$1 AND (location_id=$2 OR location_id IS NULL)
       ORDER BY (location_id IS NOT NULL) DESC LIMIT 1`,
      [scope.organizationId, locationId],
    );
    const row = result.rows[0];
    return row ? { id: row.id, enabled: row.enabled, ...(row.pack_amount_cents !== null ? { packAmountCents: row.pack_amount_cents } : {}) } : null;
  }
  async getBackendGross(scope: OrganizationScope, quoteId: string) {
    const result = await this.db.query<{ gross: number }>("SELECT COALESCE(sum(gross_cents),0)::int AS gross FROM quote_backend_product_snapshots WHERE organization_id=$1 AND quote_id=$2", [scope.organizationId, quoteId]);
    return result.rows[0]?.gross ?? 0;
  }
  async snapshotExists(scope: OrganizationScope, quoteId: string) {
    const result = await this.db.query<{ exists: boolean }>("SELECT EXISTS(SELECT 1 FROM quote_profitability_snapshots WHERE organization_id=$1 AND quote_id=$2) AS exists", [scope.organizationId, quoteId]);
    return result.rows[0]?.exists === true;
  }
  async createSnapshot(context: RequestContext, input: Parameters<QuoteProfitabilitySession["createSnapshot"]>[1]) {
    await this.db.query(
      `INSERT INTO inventory_cost_snapshots(id,organization_id,location_id,inventory_unit_id,cost_cents,source_type,source_label,source_reference,effective_at,captured_at,captured_by)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [input.costSnapshot.id, context.organizationId, context.locationId, input.costSnapshot.inventoryUnitId, input.costSnapshot.costCents, input.costSnapshot.sourceType, input.costSnapshot.sourceLabel, input.costSnapshot.sourceReference ?? null, input.costSnapshot.effectiveAt, input.costSnapshot.capturedAt, context.actorId],
    );
    const item = input.profitability;
    const inserted = await this.db.query<{ id: string }>(
      `INSERT INTO quote_profitability_snapshots(id,organization_id,location_id,quote_id,inventory_unit_id,inventory_cost_snapshot_id,pack_policy_id,vehicle_sell_cents,vehicle_cost_cents,pack_cents,front_gross_cents,backend_gross_cents,total_gross_cents,captured_at,captured_by)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT(organization_id,quote_id) DO NOTHING RETURNING id`,
      [item.id,item.organizationId,item.locationId,item.quoteId,item.inventoryUnitId,item.inventoryCostSnapshotId,item.packPolicyId ?? null,item.vehicleSellCents,item.vehicleCostCents,item.packCents,item.frontGrossCents,item.backendGrossCents,item.totalGrossCents,item.capturedAt,context.actorId],
    );
    if (!inserted.rows[0]) throw new QuoteProfitabilityIntegrityError("Profitability was already captured for this Quote version.");
    await this.db.query("INSERT INTO audit_logs(id,organization_id,actor_id,action,entity_type,entity_id,source,correlation_id) VALUES($1,$2,$3,'quote.profitability_captured','deal_quote',$4,'application',$5)", [generateEntityId("aud"), context.organizationId, context.actorId, item.quoteId, context.correlationId]);
    return item;
  }
}
