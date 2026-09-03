import type { Pool } from "pg";
import {
  QuoteApprovalIntegrityError,
  type QuoteApprovalProvider,
  type QuoteApprovalRecord,
  type QuoteApprovalSession,
} from "@/lib/application/deals";
import { generateEntityId } from "@/lib/core/identifiers";
import type { OrganizationScope, RequestContext } from "@/lib/platform/data";
import type { SqlExecutor } from "@/lib/server/data";
import { withTenantDatabaseContext } from "@/lib/server/database";

type ApprovalRow = {
  id: string;
  organization_id: string;
  quote_id: string;
  status: QuoteApprovalRecord["status"];
  request_reason: string | null;
  decision_reason: string | null;
  requested_by: string | null;
  requested_at: Date;
  decided_by: string | null;
  decided_at: Date | null;
  request_idempotency_key: string;
  decision_idempotency_key: string | null;
  location_id?: string;
};

const columns = `a.id, a.organization_id, a.quote_id, a.status, a.request_reason,
  a.decision_reason, a.requested_by, a.requested_at, a.decided_by, a.decided_at,
  a.request_idempotency_key, a.decision_idempotency_key`;

export class PostgresQuoteApprovalProvider implements QuoteApprovalProvider {
  constructor(
    private readonly pool: Pool,
    private readonly context: { userId: string; organizationId: string },
  ) {}
  transaction<Result>(operation: (session: QuoteApprovalSession) => Promise<Result>) {
    return withTenantDatabaseContext(this.pool, this.context, (client) =>
      operation(new Session(client as unknown as SqlExecutor)),
    );
  }
}

class Session implements QuoteApprovalSession {
  constructor(private readonly db: SqlExecutor) {}

  async acquireLock(scope: OrganizationScope, key: string) {
    await this.db.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
      `${scope.organizationId}:${key}`,
    ]);
  }

  async findRequestByIdempotency(scope: OrganizationScope, key: string) {
    const result = await this.db.query<ApprovalRow & { location_id: string }>(
      `SELECT ${columns}, d.location_id
       FROM deal_quote_approvals a
       JOIN deal_quotes q ON q.organization_id = a.organization_id AND q.id = a.quote_id
       JOIN deals d ON d.organization_id = q.organization_id AND d.id = q.deal_id
       WHERE a.organization_id = $1 AND a.request_idempotency_key = $2 LIMIT 1`,
      [scope.organizationId, key],
    );
    return result.rows[0] ? hydrate(result.rows[0]) : null;
  }

  async getQuoteForApproval(scope: OrganizationScope, quoteId: string) {
    const result = await this.db.query<{
      quote_status: import("@/lib/application/deals").QuoteStatus;
      deal_status: import("@/lib/application/deals").DealStatus;
      location_id: string;
    }>(
      `SELECT q.status AS quote_status, d.status AS deal_status, d.location_id
       FROM deal_quotes q
       JOIN deals d ON d.organization_id = q.organization_id AND d.id = q.deal_id
       WHERE q.organization_id = $1 AND q.id = $2
       FOR UPDATE OF q`,
      [scope.organizationId, quoteId],
    );
    const row = result.rows[0];
    return row
      ? { quoteStatus: row.quote_status, dealStatus: row.deal_status, locationId: row.location_id }
      : null;
  }

  async getApprovalForQuote(scope: OrganizationScope, quoteId: string) {
    const result = await this.db.query<ApprovalRow & { location_id: string }>(
      `SELECT ${columns}, d.location_id
       FROM deal_quote_approvals a
       JOIN deal_quotes q ON q.organization_id = a.organization_id AND q.id = a.quote_id
       JOIN deals d ON d.organization_id = q.organization_id AND d.id = q.deal_id
       WHERE a.organization_id = $1 AND a.quote_id = $2 LIMIT 1`,
      [scope.organizationId, quoteId],
    );
    return result.rows[0] ? hydrate(result.rows[0]) : null;
  }

  async createApproval(context: RequestContext, approval: QuoteApprovalRecord) {
    await this.db.query(
      `INSERT INTO deal_quote_approvals
       (id, organization_id, quote_id, status, request_reason, requested_by, requested_at, request_idempotency_key)
       VALUES ($1,$2,$3,'pending',$4,$5,$6,$7)`,
      [
        approval.id,
        approval.organizationId,
        approval.quoteId,
        approval.requestReason ?? null,
        context.actorId,
        approval.requestedAt,
        approval.requestIdempotencyKey,
      ],
    );
    await audit(this.db, context, "quote.approval_requested", approval.quoteId);
    return approval;
  }

  async findDecisionByIdempotency(scope: OrganizationScope, key: string) {
    const result = await this.db.query<ApprovalRow & { location_id: string }>(
      `SELECT ${columns}, d.location_id
       FROM deal_quote_approvals a
       JOIN deal_quotes q ON q.organization_id = a.organization_id AND q.id = a.quote_id
       JOIN deals d ON d.organization_id = q.organization_id AND d.id = q.deal_id
       WHERE a.organization_id = $1 AND a.decision_idempotency_key = $2 LIMIT 1`,
      [scope.organizationId, key],
    );
    return result.rows[0] ? hydrate(result.rows[0]) : null;
  }

  async getApprovalForUpdate(scope: OrganizationScope, approvalId: string) {
    const result = await this.db.query<
      ApprovalRow & {
        quote_status: import("@/lib/application/deals").QuoteStatus;
        deal_status: import("@/lib/application/deals").DealStatus;
        location_id: string;
      }
    >(
      `SELECT ${columns}, q.status AS quote_status, d.status AS deal_status, d.location_id
       FROM deal_quote_approvals a
       JOIN deal_quotes q ON q.organization_id = a.organization_id AND q.id = a.quote_id
       JOIN deals d ON d.organization_id = q.organization_id AND d.id = q.deal_id
       WHERE a.organization_id = $1 AND a.id = $2 FOR UPDATE OF a`,
      [scope.organizationId, approvalId],
    );
    const row = result.rows[0];
    return row
      ? {
          approval: hydrate(row),
          quoteStatus: row.quote_status,
          dealStatus: row.deal_status,
          locationId: row.location_id,
        }
      : null;
  }

  async decideApproval(context: RequestContext, approval: QuoteApprovalRecord) {
    const update = await this.db.query<{ id: string }>(
      `UPDATE deal_quote_approvals
       SET status = $3, decision_reason = $4, decided_by = $5, decided_at = $6,
           decision_idempotency_key = $7, updated_at = now()
       WHERE organization_id = $1 AND id = $2 AND status = 'pending'
       RETURNING id`,
      [
        approval.organizationId,
        approval.id,
        approval.status,
        approval.decisionReason ?? null,
        context.actorId,
        approval.decidedAt,
        approval.decisionIdempotencyKey,
      ],
    );
    if (!update.rows[0]) throw new QuoteApprovalIntegrityError("Concurrent quote approval decision was rejected.");
    await audit(
      this.db,
      context,
      approval.status === "approved" ? "quote.approved" : "quote.approval_declined",
      approval.quoteId,
    );
    return approval;
  }
}

function hydrate(row: ApprovalRow): QuoteApprovalRecord {
  if (!row.requested_by) throw new QuoteApprovalIntegrityError("Quote approval requester is unavailable.");
  return {
    id: row.id,
    organizationId: row.organization_id,
    ...(row.location_id ? { locationId: row.location_id } : {}),
    quoteId: row.quote_id,
    status: row.status,
    ...(row.request_reason ? { requestReason: row.request_reason } : {}),
    ...(row.decision_reason ? { decisionReason: row.decision_reason } : {}),
    requestedBy: row.requested_by,
    requestedAt: row.requested_at.toISOString(),
    ...(row.decided_by ? { decidedBy: row.decided_by } : {}),
    ...(row.decided_at ? { decidedAt: row.decided_at.toISOString() } : {}),
    requestIdempotencyKey: row.request_idempotency_key,
    ...(row.decision_idempotency_key
      ? { decisionIdempotencyKey: row.decision_idempotency_key }
      : {}),
  };
}

async function audit(db: SqlExecutor, context: RequestContext, action: string, entityId: string) {
  await db.query(
    "INSERT INTO audit_logs (id, organization_id, actor_id, action, entity_type, entity_id, source, correlation_id) VALUES ($1,$2,$3,$4,'deal_quote',$5,'application',$6)",
    [generateEntityId("aud"), context.organizationId, context.actorId, action, entityId, context.correlationId],
  );
}
