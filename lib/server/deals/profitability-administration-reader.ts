import { assertAuthorized, type AuthorizationActor } from "@/lib/platform/auth";
import { resolveEffectivePackPolicy, type PackPolicy } from "@/lib/application/deals";
import { withTenantDatabaseContext, type DatabasePool } from "@/lib/server/database";

export interface ProfitabilityAdministrationModel {
  inventory: Array<{
    id: string;
    locationId: string;
    stockNumber: string;
    vin: string;
    vehicleLabel: string;
    status: string;
    cost?: { id: string; version: number; costCents: number; sourceType: string; sourceLabel: string; sourceReference?: string; effectiveAt: string; capturedAt: string; recordedBy?: string };
  }>;
  locations: Array<{
    id: string;
    name: string;
    organizationDefault: PackPolicy | null;
    locationOverride: PackPolicy | null;
    effective: { amountCents: number; source: string; invalid: boolean };
  }>;
  dashboard: {
    activeInventory: number;
    inventoryWithCost: number;
    inventoryMissingCost: number;
    quotesMissingCost: number;
    locationsWithoutPack: number;
    invalidEnabledPolicies: number;
    completedSnapshots: number;
    quotesAwaitingInputs: number;
  };
  blockedQuotes: Array<{ quoteId: string; version: number; dealId: string; stockNumber?: string; reason: "missing-cost" | "awaiting-snapshot" }>;
  audit: Array<{ id: string; action: string; entityType: string; entityId: string; actorId?: string; createdAt: string; changes?: Record<string, unknown> }>;
}

export class ProfitabilityAdministrationReader {
  constructor(private readonly pool: DatabasePool) {}

  read(input: { actor: AuthorizationActor; organizationId: string; search?: string }): Promise<ProfitabilityAdministrationModel> {
    const membership = assertAuthorized(input.actor, { capability: "inventory.cost.read", organizationId: input.organizationId });
    assertAuthorized(input.actor, { capability: "quote.pack.read", organizationId: input.organizationId });
    const all = membership.locationIds === "all";
    const locationIds = all ? [] : [...membership.locationIds];
    const search = input.search?.trim().slice(0, 100) ?? "";
    return withTenantDatabaseContext(this.pool, { userId: input.actor.userId, organizationId: input.organizationId }, async (client) => {
      const inventory = await client.query(`SELECT unit.id,unit.location_id,unit.stock_number,unit.status::text,vehicle.vin,vehicle.year,vehicle.make,vehicle.model,vehicle.trim,
          cost.id cost_id,cost.version,cost.cost_cents,cost.source_type,cost.source_label,cost.source_reference,cost.effective_at,cost.captured_at,person.name recorded_by
        FROM inventory_units unit
        JOIN vehicles vehicle ON vehicle.organization_id=unit.organization_id AND vehicle.id=unit.vehicle_id
        LEFT JOIN LATERAL (SELECT * FROM inventory_cost_snapshots WHERE organization_id=unit.organization_id AND inventory_unit_id=unit.id ORDER BY version DESC LIMIT 1) cost ON true
        LEFT JOIN users person ON person.id=cost.captured_by
        WHERE unit.organization_id=$1 AND ($2::boolean OR unit.location_id=ANY($3::text[]))
          AND unit.status IN ('available','hold')
          AND ($4='' OR unit.stock_number ILIKE '%'||$4||'%' OR vehicle.vin ILIKE '%'||$4||'%' OR (vehicle.year::text||' '||vehicle.make||' '||vehicle.model||' '||coalesce(vehicle.trim,'')) ILIKE '%'||$4||'%')
        ORDER BY (cost.id IS NULL) DESC,unit.updated_at DESC LIMIT 100`, [input.organizationId, all, locationIds, search]) as { rows: InventoryRow[] };
      const locationRows = await client.query("SELECT id,name FROM locations WHERE organization_id=$1 AND active=true AND ($2::boolean OR id=ANY($3::text[])) ORDER BY name", [input.organizationId, all, locationIds]) as { rows: Array<{ id:string;name:string }> };
      const policyRows = await client.query("SELECT id,organization_id,location_id,enabled,pack_amount_cents,version,updated_at FROM quote_pack_policies WHERE organization_id=$1 AND ($2::boolean OR location_id IS NULL OR location_id=ANY($3::text[]))", [input.organizationId, all, locationIds]) as { rows: PolicyRow[] };
      const dashboard = await client.query(`SELECT
          (SELECT count(*) FROM inventory_units WHERE organization_id=$1 AND status IN ('available','hold') AND ($2::boolean OR location_id=ANY($3::text[])))::text active_inventory,
          (SELECT count(*) FROM inventory_units unit WHERE unit.organization_id=$1 AND unit.status IN ('available','hold') AND ($2::boolean OR unit.location_id=ANY($3::text[])) AND EXISTS(SELECT 1 FROM inventory_cost_snapshots cost WHERE cost.organization_id=unit.organization_id AND cost.inventory_unit_id=unit.id))::text inventory_with_cost,
          (SELECT count(*) FROM deal_quotes quote JOIN deals deal ON deal.organization_id=quote.organization_id AND deal.id=quote.deal_id WHERE quote.organization_id=$1 AND quote.status='draft' AND ($2::boolean OR deal.location_id=ANY($3::text[])) AND deal.inventory_unit_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM inventory_cost_snapshots cost WHERE cost.organization_id=deal.organization_id AND cost.inventory_unit_id=deal.inventory_unit_id))::text quotes_missing_cost,
          (SELECT count(*) FROM quote_profitability_snapshots snapshot WHERE snapshot.organization_id=$1 AND ($2::boolean OR snapshot.location_id=ANY($3::text[])))::text completed_snapshots,
          (SELECT count(*) FROM deal_quotes quote JOIN deals deal ON deal.organization_id=quote.organization_id AND deal.id=quote.deal_id WHERE quote.organization_id=$1 AND quote.status='draft' AND ($2::boolean OR deal.location_id=ANY($3::text[])) AND NOT EXISTS(SELECT 1 FROM quote_profitability_snapshots snapshot WHERE snapshot.organization_id=quote.organization_id AND snapshot.quote_id=quote.id))::text quotes_awaiting_inputs,
          (SELECT count(*) FROM quote_pack_policies policy WHERE policy.organization_id=$1 AND policy.enabled=true AND policy.pack_amount_cents IS NULL AND ($2::boolean OR policy.location_id IS NULL OR policy.location_id=ANY($3::text[])))::text invalid_policies`, [input.organizationId, all, locationIds]) as { rows: DashboardRow[] };
      const blockedQuotes=await client.query(`SELECT quote.id quote_id,quote.version,deal.id deal_id,unit.stock_number,
          CASE WHEN deal.inventory_unit_id IS NULL OR cost.id IS NULL THEN 'missing-cost' ELSE 'awaiting-snapshot' END reason
        FROM deal_quotes quote JOIN deals deal ON deal.organization_id=quote.organization_id AND deal.id=quote.deal_id
        LEFT JOIN inventory_units unit ON unit.organization_id=deal.organization_id AND unit.id=deal.inventory_unit_id
        LEFT JOIN LATERAL (SELECT id FROM inventory_cost_snapshots WHERE organization_id=deal.organization_id AND inventory_unit_id=deal.inventory_unit_id ORDER BY version DESC LIMIT 1) cost ON true
        WHERE quote.organization_id=$1 AND quote.status='draft' AND ($2::boolean OR deal.location_id=ANY($3::text[]))
          AND NOT EXISTS(SELECT 1 FROM quote_profitability_snapshots snapshot WHERE snapshot.organization_id=quote.organization_id AND snapshot.quote_id=quote.id)
        ORDER BY quote.created_at LIMIT 50`,[input.organizationId,all,locationIds]) as {rows:BlockedQuoteRow[]};
      const audit = await client.query("SELECT id,action,entity_type,entity_id,actor_id,created_at,new_values FROM audit_logs WHERE organization_id=$1 AND action IN ('inventory.cost_recorded','quote.pack_policy_saved') ORDER BY created_at DESC LIMIT 30", [input.organizationId]) as { rows: AuditRow[] };
      const orgDefault = mapPolicy(policyRows.rows.find((row) => row.location_id === null));
      const locations = locationRows.rows.map((location) => {
        const override = mapPolicy(policyRows.rows.find((row) => row.location_id === location.id));
        try { const effective=resolveEffectivePackPolicy({ organizationDefault: orgDefault, locationOverride: override }); return { id:location.id,name:location.name,organizationDefault:orgDefault,locationOverride:override,effective:{amountCents:effective.amountCents,source:effective.source,invalid:false} }; }
        catch { return { id:location.id,name:location.name,organizationDefault:orgDefault,locationOverride:override,effective:{amountCents:0,source:"invalid-enabled-policy",invalid:true} }; }
      });
      const metrics = dashboard.rows[0]!;
      const activeInventory=Number(metrics.active_inventory), inventoryWithCost=Number(metrics.inventory_with_cost);
      return {
        inventory: inventory.rows.map((row) => ({ id:row.id,locationId:row.location_id,stockNumber:row.stock_number,vin:row.vin,vehicleLabel:`${row.year} ${row.make} ${row.model}${row.trim?` ${row.trim}`:""}`,status:row.status,...(row.cost_id&&row.version!==null&&row.cost_cents!==null&&row.source_type&&row.source_label&&row.effective_at&&row.captured_at?{cost:{id:row.cost_id,version:row.version,costCents:row.cost_cents,sourceType:row.source_type,sourceLabel:row.source_label,...(row.source_reference?{sourceReference:row.source_reference}:{}),effectiveAt:row.effective_at.toISOString(),capturedAt:row.captured_at.toISOString(),...(row.recorded_by?{recordedBy:row.recorded_by}:{})}}:{}) })),
        locations,
        dashboard:{activeInventory,inventoryWithCost,inventoryMissingCost:activeInventory-inventoryWithCost,quotesMissingCost:Number(metrics.quotes_missing_cost),locationsWithoutPack:locations.filter((item)=>item.effective.source==="no-enabled-policy").length,invalidEnabledPolicies:Number(metrics.invalid_policies),completedSnapshots:Number(metrics.completed_snapshots),quotesAwaitingInputs:Number(metrics.quotes_awaiting_inputs)},
        blockedQuotes:blockedQuotes.rows.map(row=>({quoteId:row.quote_id,version:row.version,dealId:row.deal_id,...(row.stock_number?{stockNumber:row.stock_number}:{}),reason:row.reason})),
        audit:audit.rows.map((row)=>({id:row.id,action:row.action,entityType:row.entity_type,entityId:row.entity_id,...(row.actor_id?{actorId:row.actor_id}:{}),createdAt:row.created_at.toISOString(),...(row.new_values?{changes:row.new_values}:{})})),
      };
    });
  }
}

type InventoryRow={id:string;location_id:string;stock_number:string;status:string;vin:string;year:number;make:string;model:string;trim:string|null;cost_id:string|null;version:number|null;cost_cents:number|null;source_type:string|null;source_label:string|null;source_reference:string|null;effective_at:Date|null;captured_at:Date|null;recorded_by:string|null};
type PolicyRow={id:string;organization_id:string;location_id:string|null;enabled:boolean;pack_amount_cents:number|null;version:number;updated_at:Date};
type DashboardRow={active_inventory:string;inventory_with_cost:string;quotes_missing_cost:string;completed_snapshots:string;quotes_awaiting_inputs:string;invalid_policies:string};
type BlockedQuoteRow={quote_id:string;version:number;deal_id:string;stock_number:string|null;reason:"missing-cost"|"awaiting-snapshot"};
type AuditRow={id:string;action:string;entity_type:string;entity_id:string;actor_id:string|null;created_at:Date;new_values:Record<string,unknown>|null};
function mapPolicy(row: PolicyRow | undefined): PackPolicy | null {
  return row?{id:row.id,organizationId:row.organization_id,...(row.location_id?{locationId:row.location_id}:{}),enabled:row.enabled,...(row.pack_amount_cents!==null?{packAmountCents:row.pack_amount_cents}:{}),version:row.version,updatedAt:row.updated_at.toISOString()}:null;
}
