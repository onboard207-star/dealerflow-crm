import type { Pool } from "pg";
import { QuoteIntegrityError, type QuoteLine, type QuoteProvider, type QuoteRecord, type QuoteSession, type QuoteStatusEvent } from "@/lib/application/deals";
import { evaluateQuoteApprovalPolicy, type QuoteApprovalPolicy } from "@/lib/application/deals";
import { generateEntityId } from "@/lib/core/identifiers";
import type { OrganizationScope, RequestContext } from "@/lib/platform/data";
import type { SqlExecutor } from "@/lib/server/data";
import { withTenantDatabaseContext } from "@/lib/server/database";

export class PostgresQuoteProvider implements QuoteProvider { constructor(private readonly pool: Pool, private readonly context: { userId: string; organizationId: string }) {} transaction<Result>(operation: (session: QuoteSession) => Promise<Result>) { return withTenantDatabaseContext(this.pool, this.context, (client) => operation(new Session(client as unknown as SqlExecutor))); } }
type QuoteRow = { id: string; organization_id: string; location_id?: string; deal_id: string; version: number; status: QuoteRecord["status"]; purchase_type: QuoteRecord["purchaseType"]; currency: string; subtotal_cents: number; fee_cents: number; tax_cents: number; discount_cents: number; total_cents: number; expires_at: Date | null; presented_at: Date | null; accepted_at: Date | null; idempotency_key: string };
type LineRow = { id: string; position: number; category: QuoteLine["category"]; description: string; quantity: number; unit_amount_cents: number; total_cents: number };
type EventRow = { id: string; organization_id: string; quote_id: string; from_status: QuoteStatusEvent["fromStatus"] | null; to_status: QuoteStatusEvent["toStatus"]; reason: string | null; occurred_at: Date; idempotency_key: string };
const columns = "q.id, q.organization_id, q.deal_id, q.version, q.status, q.purchase_type, q.currency, q.subtotal_cents, q.fee_cents, q.tax_cents, q.discount_cents, q.total_cents, q.expires_at, q.presented_at, q.accepted_at, q.idempotency_key";
class Session implements QuoteSession {
  constructor(private readonly db: SqlExecutor) {}
  async acquireLock(scope: OrganizationScope, key: string) { await this.db.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`${scope.organizationId}:${key}`]); }
  async findQuoteByIdempotency(scope: OrganizationScope, key: string) { const result = await this.db.query<QuoteRow & { location_id: string }>(`SELECT ${columns}, d.location_id FROM deal_quotes q JOIN deals d ON d.organization_id = q.organization_id AND d.id = q.deal_id WHERE q.organization_id = $1 AND q.idempotency_key = $2 LIMIT 1`, [scope.organizationId, key]); return result.rows[0] ? this.hydrate(result.rows[0]) : null; }
  async getDealContextForUpdate(scope: OrganizationScope, dealId: string) { const result = await this.db.query<{ status: import("@/lib/application/deals").DealStatus; location_id: string }>("SELECT status, location_id FROM deals WHERE organization_id = $1 AND id = $2 FOR UPDATE", [scope.organizationId, dealId]); const row = result.rows[0]; return row ? { status: row.status, locationId: row.location_id } : null; }
  async nextVersion(scope: OrganizationScope, dealId: string) { const result = await this.db.query<{ version: number }>("SELECT COALESCE(max(version), 0)::int + 1 AS version FROM deal_quotes WHERE organization_id = $1 AND deal_id = $2", [scope.organizationId, dealId]); return result.rows[0]?.version ?? 1; }
  async createQuote(context: RequestContext, quote: QuoteRecord, statusEvent: QuoteStatusEvent) { await this.db.query(`INSERT INTO deal_quotes (id, organization_id, deal_id, version, status, purchase_type, currency,
      subtotal_cents, fee_cents, tax_cents, discount_cents, total_cents, expires_at, idempotency_key, created_by, updated_by)
      VALUES ($1,$2,$3,$4,'draft',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14)`, [quote.id, quote.organizationId, quote.dealId, quote.version, quote.purchaseType, quote.currency, quote.subtotalCents, quote.feeCents, quote.taxCents, quote.discountCents, quote.totalCents, quote.expiresAt ?? null, quote.idempotencyKey, context.actorId]);
    for (const line of quote.lines) await this.db.query(`INSERT INTO deal_quote_lines (id, organization_id, quote_id, position, category, description, quantity, unit_amount_cents, total_cents) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [line.id, quote.organizationId, quote.id, line.position, line.category, line.description, line.quantity, line.unitAmountCents, line.totalCents]);
    await insertEvent(this.db, context, statusEvent); await audit(this.db, context, "quote.created", quote.id); return quote; }
  async findTransitionByIdempotency(scope: OrganizationScope, key: string) { const result = await this.db.query<QuoteRow & { location_id: string; event_id: string; from_status: EventRow["from_status"]; to_status: EventRow["to_status"]; reason: string | null; occurred_at: Date; event_key: string }>(`SELECT ${columns}, d.location_id, e.id AS event_id, e.from_status, e.to_status, e.reason, e.occurred_at, e.idempotency_key AS event_key FROM deal_quote_status_events e JOIN deal_quotes q ON q.organization_id = e.organization_id AND q.id = e.quote_id JOIN deals d ON d.organization_id = q.organization_id AND d.id = q.deal_id WHERE e.organization_id = $1 AND e.idempotency_key = $2 LIMIT 1`, [scope.organizationId, key]); const row = result.rows[0]; if (!row) return null; return { quote: await this.hydrate(row), event: statusEvent({ id: row.event_id, organization_id: row.organization_id, quote_id: row.id, from_status: row.from_status, to_status: row.to_status, reason: row.reason, occurred_at: row.occurred_at, idempotency_key: row.event_key }) }; }
  async getQuoteForUpdate(scope: OrganizationScope, quoteId: string) { const result = await this.db.query<QuoteRow & { location_id: string; deal_status: import("@/lib/application/deals").DealStatus }>(`SELECT ${columns}, d.location_id, d.status AS deal_status FROM deal_quotes q JOIN deals d ON d.organization_id = q.organization_id AND d.id = q.deal_id WHERE q.organization_id = $1 AND q.id = $2 FOR UPDATE OF q`, [scope.organizationId, quoteId]); const row = result.rows[0]; return row ? { quote: await this.hydrate(row), dealStatus: row.deal_status, locationId: row.location_id } : null; }
  async getApprovalStatus(scope: OrganizationScope, quoteId: string) { const result = await this.db.query<{ status: "pending" | "approved" | "declined" }>("SELECT status FROM deal_quote_approvals WHERE organization_id = $1 AND quote_id = $2 LIMIT 1", [scope.organizationId, quoteId]); return result.rows[0]?.status ?? null; }
  async getApprovalRequirement(scope: OrganizationScope, quote: Pick<QuoteRecord, "locationId" | "discountCents">) {
    const result = await this.db.query<{ id: string; organization_id: string; location_id: string | null; enabled: boolean; always_require_approval: boolean; discount_threshold_cents: number | null; version: number }>(
      `SELECT id, organization_id, location_id, enabled, always_require_approval,
              discount_threshold_cents, version
       FROM quote_approval_policies
       WHERE organization_id = $1
         AND enabled = true
         AND (location_id = $2 OR location_id is null)
       ORDER BY (location_id is not null) DESC
       LIMIT 1`,
      [scope.organizationId, quote.locationId ?? null],
    );
    const row = result.rows[0];
    const policy: QuoteApprovalPolicy | null = row ? {
      id: row.id,
      organizationId: row.organization_id,
      ...(row.location_id ? { locationId: row.location_id } : {}),
      enabled: row.enabled,
      alwaysRequireApproval: row.always_require_approval,
      ...(row.discount_threshold_cents !== null ? { discountThresholdCents: row.discount_threshold_cents } : {}),
      version: row.version,
    } : null;
    return evaluateQuoteApprovalPolicy(policy, quote);
  }
  async hasAcceptedQuote(scope: OrganizationScope, dealId: string, exceptQuoteId: string) { const result = await this.db.query<{ exists: boolean }>("SELECT EXISTS (SELECT 1 FROM deal_quotes WHERE organization_id = $1 AND deal_id = $2 AND status = 'accepted' AND id <> $3) AS exists", [scope.organizationId, dealId, exceptQuoteId]); return result.rows[0]?.exists === true; }
  async transitionQuote(context: RequestContext, quote: QuoteRecord, event: QuoteStatusEvent) { const update = await this.db.query<{ id: string }>(`UPDATE deal_quotes SET status = $3, presented_at = $4, accepted_at = $5, updated_by = $6, updated_at = now() WHERE organization_id = $1 AND id = $2 AND status = $7 RETURNING id`, [quote.organizationId, quote.id, quote.status, quote.presentedAt ?? null, quote.acceptedAt ?? null, context.actorId, event.fromStatus]); if (!update.rows[0]) throw new QuoteIntegrityError("Concurrent quote transition was rejected."); if (quote.status === "accepted") await this.db.query("UPDATE deals SET agreed_price_cents = $3, purchase_type = $4, updated_by = $5, updated_at = now() WHERE organization_id = $1 AND id = $2", [quote.organizationId, quote.dealId, quote.totalCents, quote.purchaseType, context.actorId]); await insertEvent(this.db, context, event); await audit(this.db, context, "quote.status_changed", quote.id); return quote; }
  private async hydrate(row: QuoteRow & { location_id?: string }): Promise<QuoteRecord> { const lines = await this.db.query<LineRow>("SELECT id, position, category, description, quantity, unit_amount_cents, total_cents FROM deal_quote_lines WHERE organization_id = $1 AND quote_id = $2 ORDER BY position", [row.organization_id, row.id]); return { id: row.id, organizationId: row.organization_id, ...(row.location_id ? { locationId: row.location_id } : {}), dealId: row.deal_id, version: row.version, status: row.status, purchaseType: row.purchase_type, currency: row.currency, subtotalCents: row.subtotal_cents, feeCents: row.fee_cents, taxCents: row.tax_cents, discountCents: row.discount_cents, totalCents: row.total_cents, ...(row.expires_at ? { expiresAt: row.expires_at.toISOString() } : {}), ...(row.presented_at ? { presentedAt: row.presented_at.toISOString() } : {}), ...(row.accepted_at ? { acceptedAt: row.accepted_at.toISOString() } : {}), idempotencyKey: row.idempotency_key, lines: lines.rows.map(line) }; }
}
function line(row: LineRow): QuoteLine { return { id: row.id, position: row.position, category: row.category, description: row.description, quantity: row.quantity, unitAmountCents: row.unit_amount_cents, totalCents: row.total_cents }; }
function statusEvent(row: EventRow): QuoteStatusEvent { return { id: row.id, organizationId: row.organization_id, quoteId: row.quote_id, ...(row.from_status ? { fromStatus: row.from_status } : {}), toStatus: row.to_status, ...(row.reason ? { reason: row.reason } : {}), occurredAt: row.occurred_at.toISOString(), idempotencyKey: row.idempotency_key }; }
async function insertEvent(db: SqlExecutor, context: RequestContext, item: QuoteStatusEvent) { await db.query("INSERT INTO deal_quote_status_events (id, organization_id, quote_id, from_status, to_status, reason, occurred_at, idempotency_key, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)", [item.id, item.organizationId, item.quoteId, item.fromStatus ?? null, item.toStatus, item.reason ?? null, item.occurredAt, item.idempotencyKey, context.actorId]); }
async function audit(db: SqlExecutor, context: RequestContext, action: string, entityId: string) { await db.query("INSERT INTO audit_logs (id, organization_id, actor_id, action, entity_type, entity_id, source, correlation_id) VALUES ($1,$2,$3,$4,'deal_quote',$5,'application',$6)", [generateEntityId("aud"), context.organizationId, context.actorId, action, entityId, context.correlationId]); }
