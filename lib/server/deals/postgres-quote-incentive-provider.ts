import type { Pool } from "pg";
import type {
  QuoteIncentiveApplication,
  QuoteIncentiveProvider,
  QuoteIncentiveSession,
} from "@/lib/application/deals";
import { generateEntityId } from "@/lib/core/identifiers";
import type { OrganizationScope, RequestContext } from "@/lib/platform/data";
import type { SqlExecutor } from "@/lib/server/data";
import { withTenantDatabaseContext } from "@/lib/server/database";

export class PostgresQuoteIncentiveProvider implements QuoteIncentiveProvider {
  constructor(
    private readonly pool: Pool,
    private readonly context: { userId: string; organizationId: string },
  ) {}
  transaction<Result>(
    operation: (session: QuoteIncentiveSession) => Promise<Result>,
  ) {
    return withTenantDatabaseContext(this.pool, this.context, (client) =>
      operation(new Session(client as unknown as SqlExecutor)),
    );
  }
}

class Session implements QuoteIncentiveSession {
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
         ON q.organization_id = l.organization_id AND q.id = l.quote_id
       JOIN deals d
         ON d.organization_id = q.organization_id AND d.id = q.deal_id
       WHERE l.organization_id = $1
         AND l.quote_id = $2
         AND l.id = $3
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

  async getProgram(scope: OrganizationScope, programId: string) {
    const result = await this.db.query<{
      active: boolean;
      location_id: string | null;
      starts_at: Date | null;
      ends_at: Date | null;
    }>(
      `SELECT active, location_id, starts_at, ends_at
       FROM incentive_programs
       WHERE organization_id = $1 AND id = $2
       LIMIT 1`,
      [scope.organizationId, programId],
    );
    const row = result.rows[0];
    return row
      ? {
          active: row.active,
          ...(row.location_id ? { locationId: row.location_id } : {}),
          ...(row.starts_at ? { startsAt: row.starts_at.toISOString() } : {}),
          ...(row.ends_at ? { endsAt: row.ends_at.toISOString() } : {}),
        }
      : null;
  }

  async createApplication(
    context: RequestContext,
    application: QuoteIncentiveApplication,
  ) {
    await this.db.query(
      `INSERT INTO quote_incentive_applications
       (id, organization_id, quote_id, quote_line_id, program_id, amount_cents,
        eligibility_status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,'pending',$7)`,
      [
        application.id,
        application.organizationId,
        application.quoteId,
        application.quoteLineId,
        application.programId,
        application.amountCents,
        context.actorId,
      ],
    );
    await audit(this.db, context, "quote.incentive_attached", application.id, {
      quoteId: application.quoteId,
      quoteLineId: application.quoteLineId,
      programId: application.programId,
      amountCents: application.amountCents,
    });
    return application;
  }

  async getApplicationForUpdate(scope: OrganizationScope, applicationId: string) {
    const result = await this.db.query<{
      id: string;
      organization_id: string;
      quote_id: string;
      quote_line_id: string;
      program_id: string;
      amount_cents: number;
      eligibility_status: "pending" | "verified" | "ineligible";
      eligibility_basis: string | null;
      verified_by: string | null;
      verified_at: Date | null;
      quote_status: string;
      location_id: string;
    }>(
      `SELECT a.id, a.organization_id, a.quote_id, a.quote_line_id, a.program_id,
              a.amount_cents, a.eligibility_status, a.eligibility_basis,
              a.verified_by, a.verified_at, q.status::text AS quote_status,
              d.location_id
       FROM quote_incentive_applications a
       JOIN deal_quotes q
         ON q.organization_id = a.organization_id AND q.id = a.quote_id
       JOIN deals d
         ON d.organization_id = q.organization_id AND d.id = q.deal_id
       WHERE a.organization_id = $1 AND a.id = $2
       FOR UPDATE OF a`,
      [scope.organizationId, applicationId],
    );
    const row = result.rows[0];
    return row
      ? {
          id: row.id,
          organizationId: row.organization_id,
          locationId: row.location_id,
          quoteId: row.quote_id,
          quoteLineId: row.quote_line_id,
          programId: row.program_id,
          amountCents: row.amount_cents,
          eligibilityStatus: row.eligibility_status,
          ...(row.eligibility_basis ? { eligibilityBasis: row.eligibility_basis } : {}),
          ...(row.verified_by ? { verifiedBy: row.verified_by } : {}),
          ...(row.verified_at ? { verifiedAt: row.verified_at.toISOString() } : {}),
          quoteStatus: row.quote_status,
        }
      : null;
  }

  async decideApplication(
    context: RequestContext,
    application: QuoteIncentiveApplication,
  ) {
    await this.db.query(
      `UPDATE quote_incentive_applications
       SET eligibility_status = $3, eligibility_basis = $4,
           verified_by = $5, verified_at = $6
       WHERE organization_id = $1 AND id = $2 AND eligibility_status = 'pending'`,
      [
        application.organizationId,
        application.id,
        application.eligibilityStatus,
        application.eligibilityBasis ?? null,
        context.actorId,
        application.verifiedAt,
      ],
    );
    await audit(
      this.db,
      context,
      application.eligibilityStatus === "verified"
        ? "quote.incentive_verified"
        : "quote.incentive_ineligible",
      application.id,
      {
        eligibilityStatus: application.eligibilityStatus,
        eligibilityBasis: application.eligibilityBasis ?? null,
      },
    );
    return application;
  }
}

async function audit(
  db: SqlExecutor,
  context: RequestContext,
  action: string,
  entityId: string,
  newValues: unknown,
) {
  await db.query(
    "INSERT INTO audit_logs (id, organization_id, actor_id, action, entity_type, entity_id, source, correlation_id, new_values) VALUES ($1,$2,$3,$4,'quote_incentive',$5,'application',$6,$7::jsonb)",
    [
      generateEntityId("aud"),
      context.organizationId,
      context.actorId,
      action,
      entityId,
      context.correlationId,
      JSON.stringify(newValues),
    ],
  );
}
