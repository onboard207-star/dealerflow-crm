import { withTenantDatabaseContext, type DatabasePool } from "@/lib/server/database";
import type { SqlExecutor } from "@/lib/server/data";

export interface DealQuoteWorkspace {
  incentivePrograms: Array<{ id: string; code: string; name: string; sourceType: string; sourceLabel: string; sourceReference?: string }>;
  backendProducts: Array<{ id: string; code: string; name: string; productType: string; quoteLineCategory: "product" | "accessory"; providerName?: string; defaultCostCents?: number }>;
  deal: {
    id: string;
    dealNumber: string;
    status: string;
    locationId: string;
    customerId: string;
    customerName: string;
    purchaseType?: string;
    vehicleLabel: string;
    vin: string;
    stockNumber?: string;
  };
  quotes: Array<{
    id: string;
    version: number;
    status: string;
    purchaseType: "cash" | "finance" | "lease";
    subtotalCents: number;
    feeCents: number;
    taxCents: number;
    discountCents: number;
    totalCents: number;
    createdAt: string;
    expiresAt?: string;
    presentedAt?: string;
    acceptedAt?: string;
    approval?: {
      id: string;
      status: "pending" | "approved" | "declined";
      requestReason?: string;
      requestedAt: string;
      decisionReason?: string;
      decidedAt?: string;
    };
    commercialTerms?: {
      tradeAppraisalId?: string;
      tradeAllowanceCents: number;
      tradePayoffCents: number;
      tradeEquityCents: number;
      cashDownCents: number;
      amountFinancedCents?: number;
    };
    financeTerms?: {
      aprBasisPoints: number;
      termMonths: number;
      estimatedPaymentCents: number;
      sourceType: string;
      sourceLabel: string;
      sourceReference?: string;
      capturedAt: string;
    };
    leaseTerms?: {
      adjustedCapCostCents: number;
      residualValueCents: number;
      moneyFactorPpm: number;
      termMonths: number;
      annualMileage?: number;
      acquisitionFeeCents: number;
      capCostReductionCents: number;
      rebateCents: number;
      basePaymentCents: number;
      sourceType: string;
      sourceLabel: string;
      sourceReference?: string;
      capturedAt: string;
    };
    discountLines: Array<{ id: string; description: string; amountCents: number }>;
    incentives: Array<{ id: string; programId: string; programCode: string; programName: string; amountCents: number; eligibilityStatus: "pending" | "verified" | "ineligible"; sourceLabel: string }>;
    backendSnapshots: Array<{ id: string; quoteLineId: string; productId: string; productName: string; sellCents: number; costCents: number; grossCents: number }>;
    backendGrossCents: number;
    productLines: Array<{ id: string; category: "product" | "accessory"; description: string; amountCents: number }>;
    profitability?: { vehicleSellCents: number; vehicleCostCents: number; packCents: number; frontGrossCents: number; backendGrossCents: number; totalGrossCents: number; costSourceType: string; costSourceLabel: string; costSourceReference?: string; costEffectiveAt: string; capturedAt: string };
  }>;
  acceptedTrades: Array<{
    id: string;
    version: number;
    allowanceCents: number;
    payoffCents: number;
    equityCents: number;
    vehicleLabel: string;
  }>;
}

export class DealQuoteWorkspaceReader {
  constructor(private readonly pool: DatabasePool) {}

  read(
    context: {
      userId: string;
      organizationId: string;
      locationIds: readonly string[] | "all";
    },
    dealId: string,
  ): Promise<DealQuoteWorkspace | null> {
    return withTenantDatabaseContext(
      this.pool,
      { userId: context.userId, organizationId: context.organizationId },
      async (client) => {
        const db = client as unknown as SqlExecutor;
        const all = context.locationIds === "all";
        const locations = all ? [] : [...context.locationIds];
        const deal = await db.query<{
          id: string;
          deal_number: string;
          status: string;
          location_id: string;
          customer_id: string;
          customer_name: string;
          purchase_type: string | null;
          vin: string;
          year: number;
          make: string;
          model: string;
          trim: string | null;
          stock_number: string | null;
        }>(
          `SELECT
             d.id,
             d.deal_number,
             d.status::text,
             d.location_id,
             d.customer_id,
             c.display_name AS customer_name,
             d.purchase_type::text,
             v.vin,
             v.year,
             v.make,
             v.model,
             v.trim,
             i.stock_number
           FROM deals d
           JOIN customers c
             ON c.organization_id = d.organization_id AND c.id = d.customer_id
           JOIN vehicles v
             ON v.organization_id = d.organization_id AND v.id = d.primary_vehicle_id
           LEFT JOIN inventory_units i
             ON i.organization_id = d.organization_id AND i.id = d.inventory_unit_id
           WHERE d.organization_id = $1
             AND d.id = $2
             AND ($3::boolean OR d.location_id = ANY($4::text[]))
           LIMIT 1`,
          [context.organizationId, dealId, all, locations],
        );
        const row = deal.rows[0];
        if (!row) return null;

        const quotes = await db.query<{
          id: string;
          version: number;
          status: string;
          purchase_type: "cash" | "finance" | "lease";
          subtotal_cents: number;
          fee_cents: number;
          tax_cents: number;
          discount_cents: number;
          total_cents: number;
          created_at: Date;
          expires_at: Date | null;
          presented_at: Date | null;
          accepted_at: Date | null;
          approval_id: string | null;
          approval_status: "pending" | "approved" | "declined" | null;
          request_reason: string | null;
          requested_at: Date | null;
          decision_reason: string | null;
          decided_at: Date | null;
          trade_appraisal_id: string | null;
          trade_allowance_cents: number | null;
          trade_payoff_cents: number | null;
          trade_equity_cents: number | null;
          cash_down_cents: number | null;
          amount_financed_cents: number | null;
          apr_basis_points: number | null;
          term_months: number | null;
          estimated_payment_cents: number | null;
          finance_source_type: string | null;
          finance_source_label: string | null;
          finance_source_reference: string | null;
          finance_captured_at: Date | null;
          lease_adjusted_cap_cost_cents: number | null;
          lease_residual_value_cents: number | null;
          lease_money_factor_ppm: number | null;
          lease_term_months: number | null;
          lease_annual_mileage: number | null;
          lease_acquisition_fee_cents: number | null;
          lease_cap_cost_reduction_cents: number | null;
          lease_rebate_cents: number | null;
          lease_base_payment_cents: number | null;
          lease_source_type: string | null;
          lease_source_label: string | null;
          lease_source_reference: string | null;
          lease_captured_at: Date | null;
          profit_vehicle_sell_cents: number | null;
          profit_vehicle_cost_cents: number | null;
          profit_pack_cents: number | null;
          profit_front_gross_cents: number | null;
          profit_backend_gross_cents: number | null;
          profit_total_gross_cents: number | null;
          cost_source_type: string | null;
          cost_source_label: string | null;
          cost_source_reference: string | null;
          cost_effective_at: Date | null;
          profit_captured_at: Date | null;
        }>(
          `SELECT
             q.id,
             q.version,
             q.status::text,
             q.purchase_type,
             q.subtotal_cents,
             q.fee_cents,
             q.tax_cents,
             q.discount_cents,
             q.total_cents,
             q.created_at,
             q.expires_at,
             q.presented_at,
             q.accepted_at,
             a.id AS approval_id,
             a.status AS approval_status,
             a.request_reason,
             a.requested_at,
             a.decision_reason,
             a.decided_at,
             ct.trade_appraisal_id,
             ct.trade_allowance_cents,
             ct.trade_payoff_cents,
             ct.trade_equity_cents,
             ct.cash_down_cents,
             ct.amount_financed_cents,
             ft.apr_basis_points,
             ft.term_months,
             ft.estimated_payment_cents,
             ft.source_type::text AS finance_source_type,
             ft.source_label AS finance_source_label,
             ft.source_reference AS finance_source_reference,
             ft.captured_at AS finance_captured_at,
             lt.adjusted_cap_cost_cents AS lease_adjusted_cap_cost_cents,
             lt.residual_value_cents AS lease_residual_value_cents,
             lt.money_factor_ppm AS lease_money_factor_ppm,
             lt.term_months AS lease_term_months,
             lt.annual_mileage AS lease_annual_mileage,
             lt.acquisition_fee_cents AS lease_acquisition_fee_cents,
             lt.cap_cost_reduction_cents AS lease_cap_cost_reduction_cents,
             lt.rebate_cents AS lease_rebate_cents,
             lt.base_payment_cents AS lease_base_payment_cents,
             lt.source_type::text AS lease_source_type,
             lt.source_label AS lease_source_label,
             lt.source_reference AS lease_source_reference,
             lt.captured_at AS lease_captured_at
             ,pfs.vehicle_sell_cents AS profit_vehicle_sell_cents
             ,pfs.vehicle_cost_cents AS profit_vehicle_cost_cents
             ,pfs.pack_cents AS profit_pack_cents
             ,pfs.front_gross_cents AS profit_front_gross_cents
             ,pfs.backend_gross_cents AS profit_backend_gross_cents
             ,pfs.total_gross_cents AS profit_total_gross_cents
             ,ics.source_type AS cost_source_type
             ,ics.source_label AS cost_source_label
             ,ics.source_reference AS cost_source_reference
             ,ics.effective_at AS cost_effective_at
             ,pfs.captured_at AS profit_captured_at
           FROM deal_quotes q
           LEFT JOIN deal_quote_approvals a
             ON a.organization_id = q.organization_id AND a.quote_id = q.id
           LEFT JOIN quote_commercial_terms ct
             ON ct.organization_id = q.organization_id AND ct.quote_id = q.id
           LEFT JOIN quote_finance_terms ft
             ON ft.organization_id = q.organization_id AND ft.quote_id = q.id
           LEFT JOIN quote_lease_terms lt
             ON lt.organization_id = q.organization_id AND lt.quote_id = q.id
           LEFT JOIN quote_profitability_snapshots pfs
             ON pfs.organization_id = q.organization_id AND pfs.quote_id = q.id
           LEFT JOIN inventory_cost_snapshots ics
             ON ics.organization_id = pfs.organization_id AND ics.id = pfs.inventory_cost_snapshot_id
           WHERE q.organization_id = $1
             AND q.deal_id = $2
           ORDER BY q.version DESC`,
          [context.organizationId, dealId],
        );

        const trades = await db.query<{
          id: string;
          version: number;
          allowance_cents: number;
          payoff_cents: number;
          equity_cents: number;
          year: number;
          make: string;
          model: string;
          trim: string | null;
        }>(
          `SELECT ta.id, ta.version, ta.allowance_cents, ta.payoff_cents, ta.equity_cents,
                  v.year, v.make, v.model, v.trim
           FROM trade_appraisals ta
           JOIN vehicles v
             ON v.organization_id = ta.organization_id AND v.id = ta.vehicle_id
           WHERE ta.organization_id = $1
             AND ta.deal_id = $2
             AND ta.status IN ('accepted','acquired')
           ORDER BY ta.version DESC`,
          [context.organizationId, dealId],
        );

        const incentives = await db.query<{ id: string; quote_id: string; program_id: string; program_code: string; program_name: string; amount_cents: number; eligibility_status: "pending" | "verified" | "ineligible"; source_label: string }>(
          `SELECT qia.id,qia.quote_id,qia.program_id,ip.code AS program_code,ip.name AS program_name,
                  qia.amount_cents,qia.eligibility_status,ip.source_label
           FROM quote_incentive_applications qia
           JOIN incentive_programs ip ON ip.organization_id=qia.organization_id AND ip.id=qia.program_id
           JOIN deal_quotes q ON q.organization_id=qia.organization_id AND q.id=qia.quote_id
           WHERE qia.organization_id=$1 AND q.deal_id=$2
           ORDER BY q.version DESC, ip.name`,
          [context.organizationId, dealId],
        );
        const programs = await db.query<{ id: string; code: string; name: string; source_type: string; source_label: string; source_reference: string | null }>(
          `SELECT id,code,name,source_type::text,source_label,source_reference
           FROM incentive_programs
           WHERE organization_id=$1 AND active=true
             AND (location_id IS NULL OR location_id=$2)
             AND (starts_at IS NULL OR starts_at<=now())
             AND (ends_at IS NULL OR ends_at>=now())
           ORDER BY name`,
          [context.organizationId, row.location_id],
        );
        const quoteLines = await db.query<{ id: string; quote_id: string; category: "product" | "accessory" | "discount"; description: string; total_cents: number }>(
          `SELECT l.id,l.quote_id,l.category,l.description,l.total_cents
           FROM deal_quote_lines l JOIN deal_quotes q ON q.organization_id=l.organization_id AND q.id=l.quote_id
           WHERE l.organization_id=$1 AND q.deal_id=$2 AND l.category IN ('product','accessory','discount')
           ORDER BY q.version DESC,l.position`,
          [context.organizationId, dealId],
        );
        const backendProducts = await db.query<{ id: string; code: string; name: string; product_type: string; quote_line_category: "product" | "accessory"; provider_name: string | null; default_cost_cents: number | null }>(
          `SELECT id,code,name,product_type::text,quote_line_category,provider_name,default_cost_cents
           FROM backend_product_catalog
           WHERE organization_id=$1 AND active=true AND (location_id IS NULL OR location_id=$2)
           ORDER BY name`,
          [context.organizationId, row.location_id],
        );
        const backendSnapshots = await db.query<{ id: string; quote_id: string; quote_line_id: string; product_id: string; product_name: string; sell_cents: number; cost_cents: number; gross_cents: number }>(
          `SELECT s.id,s.quote_id,s.quote_line_id,s.product_id,p.name AS product_name,s.sell_cents,s.cost_cents,s.gross_cents
           FROM quote_backend_product_snapshots s
           JOIN backend_product_catalog p ON p.organization_id=s.organization_id AND p.id=s.product_id
           JOIN deal_quotes q ON q.organization_id=s.organization_id AND q.id=s.quote_id
           WHERE s.organization_id=$1 AND q.deal_id=$2
           ORDER BY q.version DESC,p.name`,
          [context.organizationId, dealId],
        );

        return {
          incentivePrograms: programs.rows.map((program) => ({
            id: program.id, code: program.code, name: program.name, sourceType: program.source_type,
            sourceLabel: program.source_label, ...(program.source_reference ? { sourceReference: program.source_reference } : {}),
          })),
          backendProducts: backendProducts.rows.map((product) => ({
            id: product.id, code: product.code, name: product.name, productType: product.product_type,
            quoteLineCategory: product.quote_line_category,
            ...(product.provider_name ? { providerName: product.provider_name } : {}),
            ...(product.default_cost_cents !== null ? { defaultCostCents: product.default_cost_cents } : {}),
          })),
          deal: {
            id: row.id,
            dealNumber: row.deal_number,
            status: row.status,
            locationId: row.location_id,
            customerId: row.customer_id,
            customerName: row.customer_name,
            ...(row.purchase_type ? { purchaseType: row.purchase_type } : {}),
            vehicleLabel: `${row.year} ${row.make} ${row.model}${row.trim ? ` ${row.trim}` : ""}`,
            vin: row.vin,
            ...(row.stock_number ? { stockNumber: row.stock_number } : {}),
          },
          quotes: quotes.rows.map((quote) => ({
            id: quote.id,
            version: quote.version,
            status: quote.status,
            purchaseType: quote.purchase_type,
            subtotalCents: quote.subtotal_cents,
            feeCents: quote.fee_cents,
            taxCents: quote.tax_cents,
            discountCents: quote.discount_cents,
            totalCents: quote.total_cents,
            createdAt: quote.created_at.toISOString(),
            ...(quote.expires_at ? { expiresAt: quote.expires_at.toISOString() } : {}),
            ...(quote.presented_at ? { presentedAt: quote.presented_at.toISOString() } : {}),
            ...(quote.accepted_at ? { acceptedAt: quote.accepted_at.toISOString() } : {}),
            ...(quote.approval_id && quote.approval_status && quote.requested_at
              ? {
                  approval: {
                    id: quote.approval_id,
                    status: quote.approval_status,
                    ...(quote.request_reason ? { requestReason: quote.request_reason } : {}),
                    requestedAt: quote.requested_at.toISOString(),
                    ...(quote.decision_reason
                      ? { decisionReason: quote.decision_reason }
                      : {}),
                    ...(quote.decided_at ? { decidedAt: quote.decided_at.toISOString() } : {}),
                  },
                }
              : {}),
            ...(quote.cash_down_cents !== null
              ? {
                  commercialTerms: {
                    ...(quote.trade_appraisal_id
                      ? { tradeAppraisalId: quote.trade_appraisal_id }
                      : {}),
                    tradeAllowanceCents: quote.trade_allowance_cents ?? 0,
                    tradePayoffCents: quote.trade_payoff_cents ?? 0,
                    tradeEquityCents: quote.trade_equity_cents ?? 0,
                    cashDownCents: quote.cash_down_cents,
                    ...(quote.amount_financed_cents !== null
                      ? { amountFinancedCents: quote.amount_financed_cents }
                      : {}),
                  },
                }
              : {}),
            ...(quote.apr_basis_points !== null &&
            quote.term_months !== null &&
            quote.estimated_payment_cents !== null &&
            quote.finance_source_type &&
            quote.finance_source_label &&
            quote.finance_captured_at
              ? {
                  financeTerms: {
                    aprBasisPoints: quote.apr_basis_points,
                    termMonths: quote.term_months,
                    estimatedPaymentCents: quote.estimated_payment_cents,
                    sourceType: quote.finance_source_type,
                    sourceLabel: quote.finance_source_label,
                    ...(quote.finance_source_reference
                      ? { sourceReference: quote.finance_source_reference }
                      : {}),
                    capturedAt: quote.finance_captured_at.toISOString(),
                  },
                }
              : {}),
            ...(quote.lease_adjusted_cap_cost_cents !== null &&
            quote.lease_residual_value_cents !== null &&
            quote.lease_money_factor_ppm !== null &&
            quote.lease_term_months !== null &&
            quote.lease_acquisition_fee_cents !== null &&
            quote.lease_cap_cost_reduction_cents !== null &&
            quote.lease_rebate_cents !== null &&
            quote.lease_base_payment_cents !== null &&
            quote.lease_source_type &&
            quote.lease_source_label &&
            quote.lease_captured_at
              ? {
                  leaseTerms: {
                    adjustedCapCostCents: quote.lease_adjusted_cap_cost_cents,
                    residualValueCents: quote.lease_residual_value_cents,
                    moneyFactorPpm: quote.lease_money_factor_ppm,
                    termMonths: quote.lease_term_months,
                    ...(quote.lease_annual_mileage !== null
                      ? { annualMileage: quote.lease_annual_mileage }
                      : {}),
                    acquisitionFeeCents: quote.lease_acquisition_fee_cents,
                    capCostReductionCents: quote.lease_cap_cost_reduction_cents,
                    rebateCents: quote.lease_rebate_cents,
                    basePaymentCents: quote.lease_base_payment_cents,
                    sourceType: quote.lease_source_type,
                    sourceLabel: quote.lease_source_label,
                    ...(quote.lease_source_reference
                      ? { sourceReference: quote.lease_source_reference }
                      : {}),
                    capturedAt: quote.lease_captured_at.toISOString(),
                  },
                }
              : {}),
            discountLines: quoteLines.rows.filter((line) => line.quote_id === quote.id && line.category === "discount").map((line) => ({ id: line.id, description: line.description, amountCents: Math.abs(line.total_cents) })),
            incentives: incentives.rows.filter((item) => item.quote_id === quote.id).map((item) => ({
              id: item.id, programId: item.program_id, programCode: item.program_code, programName: item.program_name,
              amountCents: item.amount_cents, eligibilityStatus: item.eligibility_status, sourceLabel: item.source_label,
            })),
            backendSnapshots: backendSnapshots.rows.filter((item) => item.quote_id === quote.id).map((item) => ({
              id: item.id, quoteLineId: item.quote_line_id, productId: item.product_id, productName: item.product_name,
              sellCents: item.sell_cents, costCents: item.cost_cents, grossCents: item.gross_cents,
            })),
            backendGrossCents: backendSnapshots.rows.filter((item) => item.quote_id === quote.id).reduce((sum, item) => sum + item.gross_cents, 0),
            productLines: quoteLines.rows.filter((line) => line.quote_id === quote.id && (line.category === "product" || line.category === "accessory")).map((line) => ({
              id: line.id, category: line.category as "product" | "accessory", description: line.description, amountCents: line.total_cents,
            })),
            ...(quote.profit_vehicle_sell_cents !== null && quote.profit_vehicle_cost_cents !== null && quote.profit_pack_cents !== null && quote.profit_front_gross_cents !== null && quote.profit_backend_gross_cents !== null && quote.profit_total_gross_cents !== null && quote.cost_source_type && quote.cost_source_label && quote.cost_effective_at && quote.profit_captured_at ? { profitability: {
              vehicleSellCents: quote.profit_vehicle_sell_cents, vehicleCostCents: quote.profit_vehicle_cost_cents, packCents: quote.profit_pack_cents,
              frontGrossCents: quote.profit_front_gross_cents, backendGrossCents: quote.profit_backend_gross_cents, totalGrossCents: quote.profit_total_gross_cents,
              costSourceType: quote.cost_source_type, costSourceLabel: quote.cost_source_label,
              ...(quote.cost_source_reference ? { costSourceReference: quote.cost_source_reference } : {}),
              costEffectiveAt: quote.cost_effective_at.toISOString(), capturedAt: quote.profit_captured_at.toISOString(),
            } } : {}),
          })),
          acceptedTrades: trades.rows.map((trade) => ({
            id: trade.id,
            version: trade.version,
            allowanceCents: trade.allowance_cents,
            payoffCents: trade.payoff_cents,
            equityCents: trade.equity_cents,
            vehicleLabel: `${trade.year} ${trade.make} ${trade.model}${trade.trim ? ` ${trade.trim}` : ""}`,
          })),
        };
      },
    );
  }
}
