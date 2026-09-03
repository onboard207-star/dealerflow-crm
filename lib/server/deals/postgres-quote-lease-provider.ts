import type { Pool } from "pg";
import type {
  QuoteLeaseTerms,
  QuoteLeaseTermsProvider,
  QuoteLeaseTermsSession,
} from "@/lib/application/deals";
import { generateEntityId } from "@/lib/core/identifiers";
import type { OrganizationScope, RequestContext } from "@/lib/platform/data";
import type { SqlExecutor } from "@/lib/server/data";
import { withTenantDatabaseContext } from "@/lib/server/database";

export class PostgresQuoteLeaseProvider implements QuoteLeaseTermsProvider {
  constructor(
    private readonly pool: Pool,
    private readonly context: { userId: string; organizationId: string },
  ) {}
  transaction<Result>(
    operation: (session: QuoteLeaseTermsSession) => Promise<Result>,
  ) {
    return withTenantDatabaseContext(this.pool, this.context, (client) =>
      operation(new Session(client as unknown as SqlExecutor)),
    );
  }
}

class Session implements QuoteLeaseTermsSession {
  constructor(private readonly db: SqlExecutor) {}

  async getQuoteForLease(scope: OrganizationScope, quoteId: string) {
    const result = await this.db.query<{
      status: string;
      purchase_type: "cash" | "finance" | "lease";
      location_id: string;
    }>(
      `SELECT q.status::text, q.purchase_type, d.location_id
       FROM deal_quotes q
       JOIN deals d ON d.organization_id = q.organization_id AND d.id = q.deal_id
       WHERE q.organization_id = $1 AND q.id = $2
       FOR UPDATE OF q`,
      [scope.organizationId, quoteId],
    );
    const row = result.rows[0];
    return row
      ? {
          status: row.status,
          purchaseType: row.purchase_type,
          locationId: row.location_id,
        }
      : null;
  }

  async leaseTermsExist(scope: OrganizationScope, quoteId: string) {
    const result = await this.db.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM quote_lease_terms
         WHERE organization_id = $1 AND quote_id = $2
       ) AS exists`,
      [scope.organizationId, quoteId],
    );
    return result.rows[0]?.exists === true;
  }

  async createLeaseTerms(context: RequestContext, terms: QuoteLeaseTerms) {
    await this.db.query(
      `INSERT INTO quote_lease_terms
       (quote_id, organization_id, adjusted_cap_cost_cents, residual_value_cents,
        money_factor_ppm, term_months, annual_mileage, acquisition_fee_cents,
        cap_cost_reduction_cents, rebate_cents, base_payment_cents,
        source_type, source_label, source_reference, captured_by, captured_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        terms.quoteId,
        terms.organizationId,
        terms.adjustedCapCostCents,
        terms.residualValueCents,
        terms.moneyFactorPpm,
        terms.termMonths,
        terms.annualMileage ?? null,
        terms.acquisitionFeeCents,
        terms.capCostReductionCents,
        terms.rebateCents,
        terms.basePaymentCents,
        terms.sourceType,
        terms.sourceLabel,
        terms.sourceReference ?? null,
        context.actorId,
        terms.capturedAt,
      ],
    );
    await this.db.query(
      "INSERT INTO audit_logs (id, organization_id, actor_id, action, entity_type, entity_id, source, correlation_id, new_values) VALUES ($1,$2,$3,'quote.lease_terms_created','deal_quote',$4,'application',$5,$6::jsonb)",
      [
        generateEntityId("aud"),
        context.organizationId,
        context.actorId,
        terms.quoteId,
        context.correlationId,
        JSON.stringify({
          adjustedCapCostCents: terms.adjustedCapCostCents,
          residualValueCents: terms.residualValueCents,
          moneyFactorPpm: terms.moneyFactorPpm,
          termMonths: terms.termMonths,
          annualMileage: terms.annualMileage ?? null,
          acquisitionFeeCents: terms.acquisitionFeeCents,
          capCostReductionCents: terms.capCostReductionCents,
          rebateCents: terms.rebateCents,
          basePaymentCents: terms.basePaymentCents,
          sourceType: terms.sourceType,
          sourceLabel: terms.sourceLabel,
          sourceReference: terms.sourceReference ?? null,
        }),
      ],
    );
    return terms;
  }
}
