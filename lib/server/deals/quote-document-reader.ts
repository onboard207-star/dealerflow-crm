import { withTenantDatabaseContext, type DatabasePool } from "@/lib/server/database";
import type { SqlExecutor } from "@/lib/server/data";

export interface QuoteDocument {
  quote: { id: string; version: number; status: string; purchaseType: string; currency: string; subtotalCents: number; feeCents: number; taxCents: number; discountCents: number; totalCents: number; createdAt: string; expiresAt?: string; presentedAt?: string; acceptedAt?: string };
  deal: { id: string; dealNumber: string };
  customer: { id: string; displayName: string };
  vehicle: { label: string; vin: string; stockNumber?: string };
  location: { id: string; name: string };
  commercialTerms?: { tradeAllowanceCents: number; tradePayoffCents: number; tradeEquityCents: number; cashDownCents: number; amountFinancedCents?: number };
  financeTerms?: { aprBasisPoints: number; termMonths: number; estimatedPaymentCents: number };
  leaseTerms?: { adjustedCapCostCents: number; residualValueCents: number; termMonths: number; annualMileage?: number; acquisitionFeeCents: number; capCostReductionCents: number; rebateCents: number; basePaymentCents: number };
  verifiedIncentives: Array<{ name: string; code: string; amountCents: number }>;
  lines: readonly { id: string; position: number; category: string; description: string; quantity: number; unitAmountCents: number; totalCents: number }[];
}

export class QuoteDocumentReader {
  constructor(private readonly pool: DatabasePool) {}

  read(scope: { userId: string; organizationId: string; locationIds: readonly string[] | "all" }, quoteId: string): Promise<QuoteDocument | null> {
    return withTenantDatabaseContext(this.pool, { userId: scope.userId, organizationId: scope.organizationId }, async (client) => {
      const db = client as unknown as SqlExecutor;
      const all = scope.locationIds === "all";
      const locations = all ? [] : [...scope.locationIds];
      const result = await db.query<Row>(
        `SELECT q.id,q.version,q.status::text,q.purchase_type::text,q.currency,q.subtotal_cents,q.fee_cents,q.tax_cents,q.discount_cents,q.total_cents,q.created_at,q.expires_at,q.presented_at,q.accepted_at,
                d.id AS deal_id,d.deal_number,d.customer_id,c.display_name,v.vin,v.year,v.make,v.model,v.trim,i.stock_number,d.location_id,location.name AS location_name,
                ct.trade_allowance_cents,ct.trade_payoff_cents,ct.trade_equity_cents,ct.cash_down_cents,ct.amount_financed_cents,
                ft.apr_basis_points,ft.term_months,ft.estimated_payment_cents,
                lt.adjusted_cap_cost_cents AS lease_adjusted_cap_cost_cents,lt.residual_value_cents AS lease_residual_value_cents,
                lt.term_months AS lease_term_months,lt.annual_mileage AS lease_annual_mileage,
                lt.acquisition_fee_cents AS lease_acquisition_fee_cents,lt.cap_cost_reduction_cents AS lease_cap_cost_reduction_cents,
                lt.rebate_cents AS lease_rebate_cents,lt.base_payment_cents AS lease_base_payment_cents
         FROM deal_quotes q
         JOIN deals d ON d.organization_id=q.organization_id AND d.id=q.deal_id
         JOIN customers c ON c.organization_id=d.organization_id AND c.id=d.customer_id
         JOIN vehicles v ON v.organization_id=d.organization_id AND v.id=d.primary_vehicle_id
         JOIN locations location ON location.organization_id=d.organization_id AND location.id=d.location_id
         LEFT JOIN inventory_units i ON i.organization_id=d.organization_id AND i.id=d.inventory_unit_id
         LEFT JOIN quote_commercial_terms ct ON ct.organization_id=q.organization_id AND ct.quote_id=q.id
         LEFT JOIN quote_finance_terms ft ON ft.organization_id=q.organization_id AND ft.quote_id=q.id
         LEFT JOIN quote_lease_terms lt ON lt.organization_id=q.organization_id AND lt.quote_id=q.id
         WHERE q.organization_id=$1 AND q.id=$2 AND ($3::boolean OR d.location_id=ANY($4::text[])) LIMIT 1`,
        [scope.organizationId, quoteId, all, locations],
      );
      const row = result.rows[0];
      if (!row) return null;
      const lines = await db.query<Line>("SELECT id,position,category::text,description,quantity,unit_amount_cents,total_cents FROM deal_quote_lines WHERE organization_id=$1 AND quote_id=$2 ORDER BY position", [scope.organizationId, quoteId]);
      const verified = await db.query<{ name: string; code: string; amount_cents: number }>(
        `SELECT ip.name,ip.code,qia.amount_cents
         FROM quote_incentive_applications qia
         JOIN incentive_programs ip ON ip.organization_id=qia.organization_id AND ip.id=qia.program_id
         WHERE qia.organization_id=$1 AND qia.quote_id=$2 AND qia.eligibility_status='verified'
         ORDER BY ip.name`,
        [scope.organizationId, quoteId],
      );
      return {
        quote: { id: row.id, version: row.version, status: row.status, purchaseType: row.purchase_type, currency: row.currency, subtotalCents: row.subtotal_cents, feeCents: row.fee_cents, taxCents: row.tax_cents, discountCents: row.discount_cents, totalCents: row.total_cents, createdAt: row.created_at.toISOString(), ...(row.expires_at ? { expiresAt: row.expires_at.toISOString() } : {}), ...(row.presented_at ? { presentedAt: row.presented_at.toISOString() } : {}), ...(row.accepted_at ? { acceptedAt: row.accepted_at.toISOString() } : {}) },
        deal: { id: row.deal_id, dealNumber: row.deal_number },
        customer: { id: row.customer_id, displayName: row.display_name },
        vehicle: { label: `${row.year} ${row.make} ${row.model}${row.trim ? ` ${row.trim}` : ""}`, vin: row.vin, ...(row.stock_number ? { stockNumber: row.stock_number } : {}) },
        location: { id: row.location_id, name: row.location_name },
        ...(row.cash_down_cents !== null ? { commercialTerms: { tradeAllowanceCents: row.trade_allowance_cents ?? 0, tradePayoffCents: row.trade_payoff_cents ?? 0, tradeEquityCents: row.trade_equity_cents ?? 0, cashDownCents: row.cash_down_cents, ...(row.amount_financed_cents !== null ? { amountFinancedCents: row.amount_financed_cents } : {}) } } : {}),
        ...(row.apr_basis_points !== null && row.term_months !== null && row.estimated_payment_cents !== null ? { financeTerms: { aprBasisPoints: row.apr_basis_points, termMonths: row.term_months, estimatedPaymentCents: row.estimated_payment_cents } } : {}),
        ...(row.lease_adjusted_cap_cost_cents !== null && row.lease_residual_value_cents !== null && row.lease_term_months !== null && row.lease_acquisition_fee_cents !== null && row.lease_cap_cost_reduction_cents !== null && row.lease_rebate_cents !== null && row.lease_base_payment_cents !== null ? { leaseTerms: { adjustedCapCostCents: row.lease_adjusted_cap_cost_cents, residualValueCents: row.lease_residual_value_cents, termMonths: row.lease_term_months, ...(row.lease_annual_mileage !== null ? { annualMileage: row.lease_annual_mileage } : {}), acquisitionFeeCents: row.lease_acquisition_fee_cents, capCostReductionCents: row.lease_cap_cost_reduction_cents, rebateCents: row.lease_rebate_cents, basePaymentCents: row.lease_base_payment_cents } } : {}),
        verifiedIncentives: (verified.rows ?? []).map((item) => ({ name: item.name, code: item.code, amountCents: item.amount_cents })),
        lines: lines.rows.map((item) => ({ id: item.id, position: item.position, category: item.category, description: item.description, quantity: item.quantity, unitAmountCents: item.unit_amount_cents, totalCents: item.total_cents })),
      };
    });
  }
}

type Row = { id: string; version: number; status: string; purchase_type: string; currency: string; subtotal_cents: number; fee_cents: number; tax_cents: number; discount_cents: number; total_cents: number; created_at: Date; expires_at: Date | null; presented_at: Date | null; accepted_at: Date | null; deal_id: string; deal_number: string; customer_id: string; display_name: string; vin: string; year: number; make: string; model: string; trim: string | null; stock_number: string | null; location_id: string; location_name: string; trade_allowance_cents: number | null; trade_payoff_cents: number | null; trade_equity_cents: number | null; cash_down_cents: number | null; amount_financed_cents: number | null; apr_basis_points: number | null; term_months: number | null; estimated_payment_cents: number | null; lease_adjusted_cap_cost_cents: number | null; lease_residual_value_cents: number | null; lease_term_months: number | null; lease_annual_mileage: number | null; lease_acquisition_fee_cents: number | null; lease_cap_cost_reduction_cents: number | null; lease_rebate_cents: number | null; lease_base_payment_cents: number | null };
type Line = { id: string; position: number; category: string; description: string; quantity: number; unit_amount_cents: number; total_cents: number };
