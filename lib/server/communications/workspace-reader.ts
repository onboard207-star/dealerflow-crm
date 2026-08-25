import { withTenantDatabaseContext, type DatabasePool } from "@/lib/server/database";

export interface CommunicationWorkspaceContext {
  integrationId?: string;
  consent?: { action: "granted" | "revoked"; basis: "express-written" | "customer-initiated" | "not-applicable"; evidenceReference: string; occurredAt: string };
}

export class CommunicationWorkspaceReader {
  constructor(private readonly pool: DatabasePool) {}

  read(context: { userId: string; organizationId: string; locationId: string; customerId: string; phone: string }): Promise<CommunicationWorkspaceContext> {
    return withTenantDatabaseContext(this.pool, context, async (client) => {
      const [integrationResult, consentResult] = await Promise.all([
        client.query(
          `SELECT id FROM integration_accounts WHERE organization_id=$1 AND provider='twilio'
           AND active=true AND default_from_address IS NOT NULL
           AND (location_id IS NULL OR location_id=$2)
           ORDER BY CASE WHEN location_id=$2 THEN 0 ELSE 1 END, updated_at DESC LIMIT 1`,
          [context.organizationId, context.locationId],
        ) as Promise<{ rows: Array<{ id: string }> }>,
        client.query(
          `SELECT action,basis,evidence_reference,occurred_at FROM communication_consent_events
           WHERE organization_id=$1 AND customer_id=$2 AND location_id=$3
             AND channel='sms' AND purpose='operational' AND address=$4
           ORDER BY occurred_at DESC,created_at DESC LIMIT 1`,
          [context.organizationId, context.customerId, context.locationId, context.phone],
        ) as Promise<{ rows: Array<{ action: "granted" | "revoked"; basis: "express-written" | "customer-initiated" | "not-applicable"; evidence_reference: string; occurred_at: Date }> }>,
      ]);
      const integration = integrationResult.rows[0]; const consent = consentResult.rows[0];
      return { ...(integration ? { integrationId: integration.id } : {}), ...(consent ? { consent: { action: consent.action, basis: consent.basis, evidenceReference: consent.evidence_reference, occurredAt: consent.occurred_at.toISOString() } } : {}) };
    });
  }
}
