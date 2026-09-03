import type { Pool } from "pg";
import type {
  QuoteBackendProductProvider,
  QuoteBackendProductSession,
  QuoteBackendProductSnapshot,
} from "@/lib/application/deals";
import { generateEntityId } from "@/lib/core/identifiers";
import type { OrganizationScope, RequestContext } from "@/lib/platform/data";
import type { SqlExecutor } from "@/lib/server/data";
import { withTenantDatabaseContext } from "@/lib/server/database";

export class PostgresQuoteBackendProductProvider implements QuoteBackendProductProvider {
  constructor(
    private readonly pool: Pool,
    private readonly context: { userId: string; organizationId: string },
  ) {}

  transaction<Result>(
    operation: (session: QuoteBackendProductSession) => Promise<Result>,
  ) {
    return withTenantDatabaseContext(this.pool, this.context, (client) =>
      operation(new Session(client as unknown as SqlExecutor)),
    );
  }
}

class Session implements QuoteBackendProductSession {
  constructor(private readonly db: SqlExecutor) {}

  async getQuoteLineContext(
    scope: OrganizationScope,
    quoteId: string,
    quoteLineId: string,
  ) {
    const result = await this.db.query<{
      quote_status: string;
      location_id: string;
      category: string;
      total_cents: number;
    }>(
      `SELECT q.status::text AS quote_status, d.location_id,
              l.category::text, l.total_cents
       FROM deal_quote_lines l
       JOIN deal_quotes q
         ON q.organization_id=l.organization_id AND q.id=l.quote_id
       JOIN deals d
         ON d.organization_id=q.organization_id AND d.id=q.deal_id
       WHERE l.organization_id=$1 AND l.quote_id=$2 AND l.id=$3
       LIMIT 1`,
      [scope.organizationId, quoteId, quoteLineId],
    );
    const row = result.rows[0];
    return row
      ? {
          quoteStatus: row.quote_status,
          locationId: row.location_id,
          category: row.category,
          lineTotalCents: row.total_cents,
        }
      : null;
  }

  async getProduct(scope: OrganizationScope, productId: string) {
    const result = await this.db.query<{
      active: boolean;
      location_id: string | null;
      quote_line_category: "product" | "accessory";
    }>(
      `SELECT active, location_id, quote_line_category
       FROM backend_product_catalog
       WHERE organization_id=$1 AND id=$2
       LIMIT 1`,
      [scope.organizationId, productId],
    );
    const row = result.rows[0];
    return row
      ? {
          active: row.active,
          ...(row.location_id ? { locationId: row.location_id } : {}),
          quoteLineCategory: row.quote_line_category,
        }
      : null;
  }

  async snapshotExists(scope: OrganizationScope, quoteLineId: string) {
    const result = await this.db.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM quote_backend_product_snapshots
         WHERE organization_id=$1 AND quote_line_id=$2
       ) AS exists`,
      [scope.organizationId, quoteLineId],
    );
    return result.rows[0]?.exists === true;
  }

  async createSnapshot(
    context: RequestContext,
    snapshot: QuoteBackendProductSnapshot,
  ) {
    await this.db.query(
      `INSERT INTO quote_backend_product_snapshots
       (id, organization_id, quote_id, quote_line_id, product_id,
        sell_cents, cost_cents, gross_cents, captured_by, captured_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        snapshot.id,
        snapshot.organizationId,
        snapshot.quoteId,
        snapshot.quoteLineId,
        snapshot.productId,
        snapshot.sellCents,
        snapshot.costCents,
        snapshot.grossCents,
        context.actorId,
        snapshot.capturedAt,
      ],
    );
    await this.db.query(
      "INSERT INTO audit_logs (id, organization_id, actor_id, action, entity_type, entity_id, source, correlation_id, new_values) VALUES ($1,$2,$3,'quote.backend_product_cost_attached','deal_quote',$4,'application',$5,$6::jsonb)",
      [
        generateEntityId("aud"),
        context.organizationId,
        context.actorId,
        snapshot.quoteId,
        context.correlationId,
        JSON.stringify({
          quoteLineId: snapshot.quoteLineId,
          productId: snapshot.productId,
          sellCents: snapshot.sellCents,
          costCents: snapshot.costCents,
          grossCents: snapshot.grossCents,
        }),
      ],
    );
    return snapshot;
  }
}
