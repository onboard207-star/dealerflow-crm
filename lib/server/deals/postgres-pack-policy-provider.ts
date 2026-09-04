import type { Pool } from "pg";

import { PackPolicyIntegrityError, type PackPolicy, type PackPolicyProvider, type PackPolicySession } from "@/lib/application/deals";
import { generateEntityId } from "@/lib/core/identifiers";
import type { OrganizationScope, RequestContext } from "@/lib/platform/data";
import type { SqlExecutor } from "@/lib/server/data";
import { withTenantDatabaseContext } from "@/lib/server/database";

export class PostgresPackPolicyProvider implements PackPolicyProvider {
  constructor(private readonly pool: Pool, private readonly tenant: { userId: string; organizationId: string }) {}
  transaction<Result>(operation: (session: PackPolicySession) => Promise<Result>) {
    return withTenantDatabaseContext(this.pool, this.tenant, (client) => operation(new Session(client as unknown as SqlExecutor)));
  }
}

type Row = { id: string; organization_id: string; location_id: string | null; enabled: boolean; pack_amount_cents: number | null; version: number; updated_at: Date };

class Session implements PackPolicySession {
  constructor(private readonly db: SqlExecutor) {}
  async getScope(scope: OrganizationScope, locationId?: string) {
    const result = await this.db.query<Row>(
      "SELECT id,organization_id,location_id,enabled,pack_amount_cents,version,updated_at FROM quote_pack_policies WHERE organization_id=$1 AND location_id IS NOT DISTINCT FROM $2::text FOR UPDATE",
      [scope.organizationId, locationId ?? null],
    );
    return result.rows[0] ? policy(result.rows[0]) : null;
  }
  async save(context: RequestContext, input: { id: string; enabled: boolean; packAmountCents?: number; expectedVersion?: number }) {
    const old = input.expectedVersion === undefined ? null : await this.getScope(context, context.locationId);
    const result = input.expectedVersion === undefined
      ? await this.db.query<Row>(
          `INSERT INTO quote_pack_policies(id,organization_id,location_id,enabled,pack_amount_cents,version,created_by,updated_by)
           VALUES($1,$2,$3,$4,$5,1,$6,$6)
           ON CONFLICT DO NOTHING
           RETURNING id,organization_id,location_id,enabled,pack_amount_cents,version,updated_at`,
          [input.id, context.organizationId, context.locationId ?? null, input.enabled, input.packAmountCents ?? null, context.actorId],
        )
      : await this.db.query<Row>(
          `UPDATE quote_pack_policies SET enabled=$4,pack_amount_cents=$5,version=version+1,updated_by=$6,updated_at=now()
           WHERE organization_id=$1 AND location_id IS NOT DISTINCT FROM $2::text AND id=$3 AND version=$7
           RETURNING id,organization_id,location_id,enabled,pack_amount_cents,version,updated_at`,
          [context.organizationId, context.locationId ?? null, input.id, input.enabled, input.packAmountCents ?? null, context.actorId, input.expectedVersion],
        );
    const row = result.rows[0];
    if (!row) throw new PackPolicyIntegrityError("The pack policy changed. Reload before saving.");
    await this.db.query(
      `INSERT INTO audit_logs(id,organization_id,actor_id,action,entity_type,entity_id,source,correlation_id,old_values,new_values)
       VALUES($1,$2,$3,'quote.pack_policy_saved','quote_pack_policy',$4,'application',$5,$6::jsonb,$7::jsonb)`,
      [generateEntityId("aud"), context.organizationId, context.actorId, row.id, context.correlationId, JSON.stringify(old ? { enabled: old.enabled, packAmountCents: old.packAmountCents ?? null, version: old.version } : null), JSON.stringify({ locationId: row.location_id, enabled: row.enabled, packAmountCents: row.pack_amount_cents, version: row.version })],
    );
    return policy(row);
  }
}

function policy(row: Row): PackPolicy {
  return { id: row.id, organizationId: row.organization_id, ...(row.location_id ? { locationId: row.location_id } : {}), enabled: row.enabled, ...(row.pack_amount_cents !== null ? { packAmountCents: row.pack_amount_cents } : {}), version: row.version, updatedAt: row.updated_at.toISOString() };
}
