import { withTenantDatabaseContext, type DatabasePool } from "@/lib/server/database";
import type { SqlExecutor } from "@/lib/server/data";

export interface QuoteApprovalQueueItem {
  approvalId: string;
  quoteId: string;
  quoteVersion: number;
  dealId: string;
  dealNumber: string;
  locationId: string;
  locationName: string;
  customerId: string;
  customerName: string;
  vehicleLabel: string;
  stockNumber?: string;
  purchaseType: "cash" | "finance" | "lease";
  subtotalCents: number;
  feeCents: number;
  taxCents: number;
  discountCents: number;
  totalCents: number;
  requestReason?: string;
  requestedBy: string;
  requestedByName: string;
  requestedAt: string;
  backendGrossCents: number;
}

export interface QuoteApprovalDecisionItem {
  approvalId: string;
  quoteId: string;
  quoteVersion: number;
  dealNumber: string;
  customerName: string;
  status: "approved" | "declined";
  totalCents: number;
  discountCents: number;
  decidedByName?: string;
  decisionReason?: string;
  decidedAt: string;
}

export interface QuoteApprovalQueueSnapshot {
  pending: QuoteApprovalQueueItem[];
  recentDecisions: QuoteApprovalDecisionItem[];
  pendingIncentives: Array<{ applicationId: string; quoteId: string; dealNumber: string; customerName: string; locationId: string; locationName: string; programName: string; programCode: string; amountCents: number; sourceLabel: string; sourceReference?: string }>;
}

export class QuoteApprovalQueueReader {
  constructor(private readonly pool: DatabasePool) {}

  read(context: {
    userId: string;
    organizationId: string;
    locationIds: readonly string[] | "all";
    pendingLimit?: number;
    recentLimit?: number;
  }): Promise<QuoteApprovalQueueSnapshot> {
    const pendingLimit = context.pendingLimit ?? 30;
    const recentLimit = context.recentLimit ?? 12;
    for (const [label, value] of [
      ["pendingLimit", pendingLimit],
      ["recentLimit", recentLimit],
    ] as const) {
      if (!Number.isInteger(value) || value < 1 || value > 100) {
        throw new Error(`${label} must be between 1 and 100.`);
      }
    }

    return withTenantDatabaseContext(this.pool, context, async (client) => {
      const db = client as unknown as SqlExecutor;
      const all = context.locationIds === "all";
      const locations = all ? [] : [...context.locationIds];
      const pending = await db.query<{
        approval_id: string;
        quote_id: string;
        quote_version: number;
        deal_id: string;
        deal_number: string;
        location_id: string;
        location_name: string;
        customer_id: string;
        customer_name: string;
        vehicle_label: string;
        stock_number: string | null;
        purchase_type: "cash" | "finance" | "lease";
        subtotal_cents: number;
        fee_cents: number;
        tax_cents: number;
        discount_cents: number;
        total_cents: number;
        request_reason: string | null;
        requested_by: string;
        requested_by_name: string;
        requested_at: Date;
        backend_gross_cents: number;
      }>(
        `SELECT
           a.id AS approval_id,
           q.id AS quote_id,
           q.version AS quote_version,
           d.id AS deal_id,
           d.deal_number,
           d.location_id,
           l.name AS location_name,
           c.id AS customer_id,
           c.display_name AS customer_name,
           v.year::text || ' ' || v.make || ' ' || v.model ||
             CASE WHEN v.trim IS NULL THEN '' ELSE ' ' || v.trim END AS vehicle_label,
           i.stock_number,
           q.purchase_type,
           q.subtotal_cents,
           q.fee_cents,
           q.tax_cents,
           q.discount_cents,
           q.total_cents,
           a.request_reason,
           a.requested_by,
           requester.display_name AS requested_by_name,
           a.requested_at
           ,COALESCE((SELECT SUM(s.gross_cents) FROM quote_backend_product_snapshots s WHERE s.organization_id=q.organization_id AND s.quote_id=q.id),0)::int AS backend_gross_cents
         FROM deal_quote_approvals a
         JOIN deal_quotes q
           ON q.organization_id = a.organization_id AND q.id = a.quote_id
         JOIN deals d
           ON d.organization_id = q.organization_id AND d.id = q.deal_id
         JOIN locations l
           ON l.organization_id = d.organization_id AND l.id = d.location_id
         JOIN customers c
           ON c.organization_id = d.organization_id AND c.id = d.customer_id
         JOIN vehicles v
           ON v.organization_id = d.organization_id AND v.id = d.primary_vehicle_id
         LEFT JOIN inventory_units i
           ON i.organization_id = d.organization_id AND i.id = d.inventory_unit_id
         JOIN users requester
           ON requester.id = a.requested_by
         WHERE a.organization_id = $1
           AND a.status = 'pending'
           AND q.status = 'draft'
           AND d.status NOT IN ('contracted','delivered','cancelled')
           AND ($2::boolean OR d.location_id = ANY($3::text[]))
         ORDER BY a.requested_at ASC, a.id ASC
         LIMIT $4`,
        [context.organizationId, all, locations, pendingLimit],
      );

      const recent = await db.query<{
        approval_id: string;
        quote_id: string;
        quote_version: number;
        deal_number: string;
        customer_name: string;
        status: "approved" | "declined";
        total_cents: number;
        discount_cents: number;
        decided_by_name: string | null;
        decision_reason: string | null;
        decided_at: Date;
      }>(
        `SELECT
           a.id AS approval_id,
           q.id AS quote_id,
           q.version AS quote_version,
           d.deal_number,
           c.display_name AS customer_name,
           a.status,
           q.total_cents,
           q.discount_cents,
           decider.display_name AS decided_by_name,
           a.decision_reason,
           a.decided_at
         FROM deal_quote_approvals a
         JOIN deal_quotes q
           ON q.organization_id = a.organization_id AND q.id = a.quote_id
         JOIN deals d
           ON d.organization_id = q.organization_id AND d.id = q.deal_id
         JOIN customers c
           ON c.organization_id = d.organization_id AND c.id = d.customer_id
         LEFT JOIN users decider
           ON decider.id = a.decided_by
         WHERE a.organization_id = $1
           AND a.status IN ('approved','declined')
           AND a.decided_at IS NOT NULL
           AND ($2::boolean OR d.location_id = ANY($3::text[]))
         ORDER BY a.decided_at DESC, a.id DESC
         LIMIT $4`,
        [context.organizationId, all, locations, recentLimit],
      );

      const pendingIncentives = await db.query<{ application_id: string; quote_id: string; deal_number: string; customer_name: string; location_id: string; location_name: string; program_name: string; program_code: string; amount_cents: number; source_label: string; source_reference: string | null }>(
        `SELECT qia.id AS application_id,q.id AS quote_id,d.deal_number,c.display_name AS customer_name,
                d.location_id,l.name AS location_name,ip.name AS program_name,ip.code AS program_code,
                qia.amount_cents,ip.source_label,ip.source_reference
         FROM quote_incentive_applications qia
         JOIN deal_quotes q ON q.organization_id=qia.organization_id AND q.id=qia.quote_id
         JOIN deals d ON d.organization_id=q.organization_id AND d.id=q.deal_id
         JOIN customers c ON c.organization_id=d.organization_id AND c.id=d.customer_id
         JOIN locations l ON l.organization_id=d.organization_id AND l.id=d.location_id
         JOIN incentive_programs ip ON ip.organization_id=qia.organization_id AND ip.id=qia.program_id
         WHERE qia.organization_id=$1 AND qia.eligibility_status='pending' AND q.status='draft'
           AND ($2::boolean OR d.location_id=ANY($3::text[]))
         ORDER BY qia.created_at ASC LIMIT 50`,
        [context.organizationId, all, locations],
      );

      return {
        pending: pending.rows.map((row) => ({
          approvalId: row.approval_id,
          quoteId: row.quote_id,
          quoteVersion: row.quote_version,
          dealId: row.deal_id,
          dealNumber: row.deal_number,
          locationId: row.location_id,
          locationName: row.location_name,
          customerId: row.customer_id,
          customerName: row.customer_name,
          vehicleLabel: row.vehicle_label,
          ...(row.stock_number ? { stockNumber: row.stock_number } : {}),
          purchaseType: row.purchase_type,
          subtotalCents: row.subtotal_cents,
          feeCents: row.fee_cents,
          taxCents: row.tax_cents,
          discountCents: row.discount_cents,
          totalCents: row.total_cents,
          ...(row.request_reason ? { requestReason: row.request_reason } : {}),
          requestedBy: row.requested_by,
          requestedByName: row.requested_by_name,
          requestedAt: row.requested_at.toISOString(),
          backendGrossCents: row.backend_gross_cents,
        })),
        recentDecisions: recent.rows.map((row) => ({
          approvalId: row.approval_id,
          quoteId: row.quote_id,
          quoteVersion: row.quote_version,
          dealNumber: row.deal_number,
          customerName: row.customer_name,
          status: row.status,
          totalCents: row.total_cents,
          discountCents: row.discount_cents,
          ...(row.decided_by_name ? { decidedByName: row.decided_by_name } : {}),
          ...(row.decision_reason ? { decisionReason: row.decision_reason } : {}),
          decidedAt: row.decided_at.toISOString(),
        })),
        pendingIncentives: pendingIncentives.rows.map((row) => ({
          applicationId: row.application_id, quoteId: row.quote_id, dealNumber: row.deal_number,
          customerName: row.customer_name, locationId: row.location_id, locationName: row.location_name,
          programName: row.program_name, programCode: row.program_code, amountCents: row.amount_cents,
          sourceLabel: row.source_label, ...(row.source_reference ? { sourceReference: row.source_reference } : {}),
        })),
      };
    });
  }
}
