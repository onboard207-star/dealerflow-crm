import type { Pool } from "pg";
import {
  QuoteApprovalPolicyConflictError,
  type QuoteApprovalPolicy,
  type QuoteApprovalPolicyProvider,
} from "@/lib/application/deals";
import { generateEntityId } from "@/lib/core/identifiers";
import type { OrganizationScope, RequestContext } from "@/lib/platform/data";
import type { SqlExecutor } from "@/lib/server/data";
import { withTenantDatabaseContext } from "@/lib/server/database";

type PolicyRow = {
  id: string;
  organization_id: string;
  location_id: string | null;
  enabled: boolean;
  always_require_approval: boolean;
  discount_threshold_cents: number | null;
  version: number;
};

const columns =
  "id, organization_id, location_id, enabled, always_require_approval, discount_threshold_cents, version";

export class PostgresQuoteApprovalPolicyProvider implements QuoteApprovalPolicyProvider {
  constructor(
    private readonly pool: Pool,
    private readonly context: { userId: string; organizationId: string },
  ) {}

  async get(scope: OrganizationScope) {
    return withTenantDatabaseContext(this.pool, this.context, async (client) => {
      const db = client as unknown as SqlExecutor;
      const result = await db.query<PolicyRow>(
        `SELECT ${columns}
         FROM quote_approval_policies
         WHERE organization_id = $1
           AND (($2::text is null AND location_id is null) OR location_id = $2)
         LIMIT 1`,
        [scope.organizationId, scope.locationId ?? null],
      );
      return result.rows[0] ? hydrate(result.rows[0]) : null;
    });
  }

  async create(context: RequestContext, policy: QuoteApprovalPolicy) {
    return withTenantDatabaseContext(this.pool, this.context, async (client) => {
      const db = client as unknown as SqlExecutor;
      await db.query(
        `INSERT INTO quote_approval_policies
         (id, organization_id, location_id, enabled, always_require_approval,
          discount_threshold_cents, version, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,1,$7,$7)`,
        [
          policy.id,
          policy.organizationId,
          policy.locationId ?? null,
          policy.enabled,
          policy.alwaysRequireApproval,
          policy.discountThresholdCents ?? null,
          context.actorId,
        ],
      );
      await audit(db, context, "quote.approval_policy_created", policy.id);
      return policy;
    });
  }

  async update(context: RequestContext, policy: QuoteApprovalPolicy, expectedVersion: number) {
    return withTenantDatabaseContext(this.pool, this.context, async (client) => {
      const db = client as unknown as SqlExecutor;
      const result = await db.query<{ id: string }>(
        `UPDATE quote_approval_policies
         SET enabled = $4, always_require_approval = $5, discount_threshold_cents = $6,
             version = $7, updated_by = $8, updated_at = now()
         WHERE organization_id = $1
           AND id = $2
           AND version = $3
         RETURNING id`,
        [
          policy.organizationId,
          policy.id,
          expectedVersion,
          policy.enabled,
          policy.alwaysRequireApproval,
          policy.discountThresholdCents ?? null,
          policy.version,
          context.actorId,
        ],
      );
      if (!result.rows[0]) throw new QuoteApprovalPolicyConflictError();
      await audit(db, context, "quote.approval_policy_updated", policy.id);
      return policy;
    });
  }
}

function hydrate(row: PolicyRow): QuoteApprovalPolicy {
  return {
    id: row.id,
    organizationId: row.organization_id,
    ...(row.location_id ? { locationId: row.location_id } : {}),
    enabled: row.enabled,
    alwaysRequireApproval: row.always_require_approval,
    ...(row.discount_threshold_cents !== null
      ? { discountThresholdCents: row.discount_threshold_cents }
      : {}),
    version: row.version,
  };
}

async function audit(db: SqlExecutor, context: RequestContext, action: string, entityId: string) {
  await db.query(
    "INSERT INTO audit_logs (id, organization_id, actor_id, action, entity_type, entity_id, source, correlation_id) VALUES ($1,$2,$3,$4,'quote_approval_policy',$5,'application',$6)",
    [generateEntityId("aud"), context.organizationId, context.actorId, action, entityId, context.correlationId],
  );
}
