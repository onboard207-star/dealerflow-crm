import type { Pool } from "pg";
import type {
  QuoteCommercialTerms,
  QuoteFinanceTerms,
  QuoteTermsProvider,
  QuoteTermsSession,
} from "@/lib/application/deals";
import { generateEntityId } from "@/lib/core/identifiers";
import type { OrganizationScope, RequestContext } from "@/lib/platform/data";
import type { SqlExecutor } from "@/lib/server/data";
import { withTenantDatabaseContext } from "@/lib/server/database";

export class PostgresQuoteTermsProvider implements QuoteTermsProvider {
  constructor(
    private readonly pool: Pool,
    private readonly context: { userId: string; organizationId: string },
  ) {}

  transaction<Result>(operation: (session: QuoteTermsSession) => Promise<Result>) {
    return withTenantDatabaseContext(this.pool, this.context, (client) =>
      operation(new Session(client as unknown as SqlExecutor)),
    );
  }
}

class Session implements QuoteTermsSession {
  constructor(private readonly db: SqlExecutor) {}

  async getQuoteForTerms(scope: OrganizationScope, quoteId: string) {
    const result = await this.db.query<{
      status: string;
      purchase_type: "cash" | "finance" | "lease";
      total_cents: number;
      deal_id: string;
      location_id: string;
    }>(
      `SELECT q.status::text, q.purchase_type, q.total_cents, q.deal_id, d.location_id
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
          totalCents: row.total_cents,
          dealId: row.deal_id,
          locationId: row.location_id,
        }
      : null;
  }

  async getAcceptedTradeAppraisal(
    scope: OrganizationScope,
    dealId: string,
    appraisalId: string,
  ) {
    const result = await this.db.query<{
      id: string;
      allowance_cents: number;
      payoff_cents: number;
      equity_cents: number;
    }>(
      `SELECT id, allowance_cents, payoff_cents, equity_cents
       FROM trade_appraisals
       WHERE organization_id = $1
         AND deal_id = $2
         AND id = $3
         AND status IN ('accepted','acquired')
       LIMIT 1`,
      [scope.organizationId, dealId, appraisalId],
    );
    const row = result.rows[0];
    return row
      ? {
          id: row.id,
          allowanceCents: row.allowance_cents,
          payoffCents: row.payoff_cents,
          equityCents: row.equity_cents,
        }
      : null;
  }

  async termsExist(scope: OrganizationScope, quoteId: string) {
    const result = await this.db.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM quote_commercial_terms
         WHERE organization_id = $1 AND quote_id = $2
       ) AS exists`,
      [scope.organizationId, quoteId],
    );
    return result.rows[0]?.exists === true;
  }

  async createTerms(
    context: RequestContext,
    commercial: QuoteCommercialTerms,
    finance?: QuoteFinanceTerms,
  ) {
    await this.db.query(
      `INSERT INTO quote_commercial_terms
       (quote_id, organization_id, trade_appraisal_id, trade_allowance_cents,
        trade_payoff_cents, trade_equity_cents, cash_down_cents,
        amount_financed_cents, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        commercial.quoteId,
        commercial.organizationId,
        commercial.tradeAppraisalId ?? null,
        commercial.tradeAllowanceCents,
        commercial.tradePayoffCents,
        commercial.tradeEquityCents,
        commercial.cashDownCents,
        commercial.amountFinancedCents ?? null,
        context.actorId,
      ],
    );

    if (finance) {
      await this.db.query(
        `INSERT INTO quote_finance_terms
         (quote_id, organization_id, apr_basis_points, term_months,
          estimated_payment_cents, source_type, source_label, source_reference,
          captured_by, captured_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          finance.quoteId,
          finance.organizationId,
          finance.aprBasisPoints,
          finance.termMonths,
          finance.estimatedPaymentCents,
          finance.sourceType,
          finance.sourceLabel,
          finance.sourceReference ?? null,
          context.actorId,
          finance.capturedAt,
        ],
      );
    }

    await this.db.query(
      "INSERT INTO audit_logs (id, organization_id, actor_id, action, entity_type, entity_id, source, correlation_id, new_values) VALUES ($1,$2,$3,'quote.terms_created','deal_quote',$4,'application',$5,$6::jsonb)",
      [
        generateEntityId("aud"),
        context.organizationId,
        context.actorId,
        commercial.quoteId,
        context.correlationId,
        JSON.stringify({
          cashDownCents: commercial.cashDownCents,
          tradeAppraisalId: commercial.tradeAppraisalId ?? null,
          tradeAllowanceCents: commercial.tradeAllowanceCents,
          tradePayoffCents: commercial.tradePayoffCents,
          tradeEquityCents: commercial.tradeEquityCents,
          amountFinancedCents: commercial.amountFinancedCents ?? null,
          finance: finance
            ? {
                aprBasisPoints: finance.aprBasisPoints,
                termMonths: finance.termMonths,
                estimatedPaymentCents: finance.estimatedPaymentCents,
                sourceType: finance.sourceType,
                sourceLabel: finance.sourceLabel,
                sourceReference: finance.sourceReference ?? null,
              }
            : null,
        }),
      ],
    );
    return { commercial, ...(finance ? { finance } : {}) };
  }
}
