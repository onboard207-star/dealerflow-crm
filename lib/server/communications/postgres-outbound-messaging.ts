import type { Pool } from "pg";

import type {
  ConsentEvent, ConsentPurpose, DeliveryResolution, OutboundGatewayResolver, OutboundMessagingProvider,
  OutboundMessagingSession, SendAttempt,
} from "@/lib/application/communications";
import { generateEntityId } from "@/lib/core/identifiers";
import { TwilioMessagingGateway } from "@/lib/integrations/twilio";
import type { OutboundMessageReceipt } from "@/lib/integrations/communications";
import type { OrganizationScope, RequestContext } from "@/lib/platform/data";
import { withTenantDatabaseContext } from "@/lib/server/database";
import { EnvironmentIntegrationCredentialResolver, type IntegrationCredentialResolver } from "@/lib/server/integrations";
import type { SqlExecutor } from "@/lib/server/data";

type ConsentRow = { id: string; organization_id: string; location_id: string | null; customer_id: string;
  channel: "call" | "sms" | "email"; purpose: ConsentPurpose; address: string;
  action: "granted" | "revoked"; basis: "express-written" | "customer-initiated" | "not-applicable";
  evidence_reference: string; occurred_at: Date; idempotency_key: string; created_by: string | null };
type AttemptRow = { id: string; organization_id: string; location_id: string | null; customer_id: string;
  lead_id: string | null; integration_id: string; consent_event_id: string; destination: string; body: string;
  purpose: ConsentPurpose; status: SendAttempt["status"]; not_before: Date; provider_message_id: string | null;
  provider_status: string | null; failure_code: string | null; idempotency_key: string;
  consent_basis: "express-written" | "customer-initiated"; consent_occurred_at: Date; consent_evidence_reference: string };
const attemptColumns = `a.id, a.organization_id, a.location_id, a.customer_id, a.lead_id,
 a.integration_id, a.consent_event_id, a.destination, a.body, a.purpose, a.status,
 a.not_before, a.provider_message_id, a.provider_status, a.failure_code, a.idempotency_key,
 c.basis AS consent_basis, c.occurred_at AS consent_occurred_at,
 c.evidence_reference AS consent_evidence_reference`;

export class PostgresOutboundMessagingProvider implements OutboundMessagingProvider {
  constructor(private readonly pool: Pool, private readonly context: { userId: string; organizationId: string }) {}
  transaction<Result>(operation: (session: OutboundMessagingSession) => Promise<Result>) {
    return withTenantDatabaseContext(this.pool, this.context, (client) => operation(new Session(client as unknown as SqlExecutor)));
  }
  claim(scope: OrganizationScope, attemptId: string, now: string) { return this.mutate(scope, `UPDATE communication_send_attempts SET status = 'dispatching', updated_at = now()
    WHERE organization_id = $1 AND id = $2 AND status = 'queued' AND not_before <= $3 RETURNING id`, attemptId, now); }
  markAccepted(scope: OrganizationScope, attemptId: string, receipt: OutboundMessageReceipt) {
    return withTenantDatabaseContext(this.pool, this.context, async (client) => {
      const update = (await client.query(`UPDATE communication_send_attempts SET status = 'accepted',
        provider_message_id = $3, provider_status = $4, updated_at = now()
        WHERE organization_id = $1 AND id = $2 AND status = 'dispatching'
        RETURNING id, organization_id, location_id, customer_id, lead_id, destination, body,
          requested_by, idempotency_key`, [scope.organizationId, attemptId,
        receipt.providerMessageId, receipt.providerStatus])) as { rows: Array<{
          id: string; organization_id: string; location_id: string | null; customer_id: string;
          lead_id: string | null; body: string; requested_by: string | null; idempotency_key: string;
        }> };
      const row = update.rows[0];
      if (!row) throw new Error("Send attempt state transition was rejected.");
      await client.query(`INSERT INTO communications (id, organization_id, location_id, customer_id,
        lead_id, actor_user_id, channel, direction, status, occurred_at, summary,
        external_message_id, idempotency_key, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,'sms','outbound','sent',now(),left($7,1000),$8,$9,$6)
        ON CONFLICT (organization_id, idempotency_key) DO NOTHING`,
      [generateEntityId("com"), row.organization_id, row.location_id, row.customer_id,
        row.lead_id, row.requested_by, row.body, receipt.providerMessageId,
        `send-attempt:${row.idempotency_key}`]);
      const session = new Session(client as unknown as SqlExecutor);
      const result = await session.findAttemptById(scope, attemptId);
      if (!result) throw new Error("Send attempt is unavailable after transition.");
      return result;
    });
  }
  markDeliveryUnknown(scope: OrganizationScope, attemptId: string) { return this.mutate(scope,
    `UPDATE communication_send_attempts SET status = 'delivery-unknown', failure_code = 'provider_result_unknown',
      updated_at = now() WHERE organization_id = $1 AND id = $2 AND status = 'dispatching' RETURNING id`, attemptId); }
  markRejected(scope: OrganizationScope, attemptId: string, failureCode: string) { return this.mutate(scope,
    `UPDATE communication_send_attempts SET status = 'rejected', failure_code = $3, updated_at = now()
      WHERE organization_id = $1 AND id = $2 AND status = 'queued' RETURNING id`, attemptId, failureCode); }
  resolveDeliveryUnknown(context: RequestContext, attemptRecord: SendAttempt, input: {
    resolution: DeliveryResolution; providerMessageId?: string; evidenceReference: string;
  }): Promise<SendAttempt> {
    return withTenantDatabaseContext(this.pool, this.context, async (client) => {
      const update = (await client.query(`UPDATE communication_send_attempts SET status = $3,
        provider_message_id = COALESCE($4, provider_message_id), provider_status = $5,
        failure_code = CASE WHEN $3 = 'rejected' THEN 'provider_rejected_manual' ELSE NULL END,
        resolution_evidence_reference = $6, resolved_at = now(), resolved_by = $7, updated_at = now()
        WHERE organization_id = $1 AND id = $2 AND status = 'delivery-unknown'
        RETURNING id`, [context.organizationId, attemptRecord.id,
        input.resolution === "failed" ? "rejected" : "accepted", input.providerMessageId ?? null,
        input.resolution, input.evidenceReference, context.actorId])) as { rows: Array<{ id: string }> };
      if (!update.rows[0]) throw new Error("Delivery-unknown resolution was rejected.");
      if (input.resolution !== "failed" && input.providerMessageId) {
        await client.query(`INSERT INTO communications (id, organization_id, location_id, customer_id,
          lead_id, actor_user_id, channel, direction, status, occurred_at, summary,
          external_message_id, idempotency_key, created_by)
          VALUES ($1,$2,$3,$4,$5,$6,'sms','outbound',$7,now(),left($8,1000),$9,$10,$6)
          ON CONFLICT (organization_id, idempotency_key) DO NOTHING`,
        [generateEntityId("com"), context.organizationId, attemptRecord.locationId ?? null,
          attemptRecord.customerId, attemptRecord.leadId ?? null, context.actorId, input.resolution,
          attemptRecord.body, input.providerMessageId, `manual-resolution:${attemptRecord.id}`]);
      }
      await audit(client as unknown as SqlExecutor, context, "message_attempt.resolved", "communication_send_attempt", attemptRecord.id);
      const resolved = await new Session(client as unknown as SqlExecutor).findAttemptById(context, attemptRecord.id);
      if (!resolved) throw new Error("Resolved attempt is unavailable."); return resolved;
    });
  }
  private async mutate(scope: OrganizationScope, sql: string, ...values: unknown[]): Promise<SendAttempt> {
    await withTenantDatabaseContext(this.pool, this.context, async (client) => {
      const result = (await client.query(sql, [scope.organizationId, ...values])) as { rows: Array<{ id: string }> };
      if (!result.rows[0]) throw new Error("Send attempt state transition was rejected.");
    });
    const attempt = await this.transaction(async (session) => {
      const result = await (session as Session).findAttemptById(scope, values[0] as string);
      return result;
    });
    if (!attempt) throw new Error("Send attempt is unavailable after transition.");
    return attempt;
  }
}

class Session implements OutboundMessagingSession {
  constructor(private readonly db: SqlExecutor) {}
  async acquireIdempotencyLock(scope: OrganizationScope, key: string) { await this.db.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`${scope.organizationId}:${key}`]); }
  async findConsentByIdempotency(scope: OrganizationScope, key: string) {
    const result = await this.db.query<ConsentRow>(`SELECT * FROM communication_consent_events WHERE organization_id = $1 AND idempotency_key = $2 LIMIT 1`, [scope.organizationId, key]);
    return result.rows[0] ? consent(result.rows[0]) : null;
  }
  async customerAddressMatches(scope: OrganizationScope, customerId: string, channel: "call" | "sms" | "email", address: string) {
    const column = channel === "email" ? "normalized_email" : "normalized_phone";
    const result = await this.db.query<{ matches: boolean }>(`SELECT EXISTS (SELECT 1 FROM customers WHERE organization_id = $1 AND id = $2 AND ${column} = $3 AND location_id=$4) AS matches`, [scope.organizationId, customerId, address, scope.locationId ?? null]);
    return result.rows[0]?.matches === true;
  }
  async createConsent(context: RequestContext, input: Omit<ConsentEvent, "createdBy">) {
    const result = await this.db.query<ConsentRow>(`INSERT INTO communication_consent_events
      (id, organization_id, location_id, customer_id, channel, purpose, address, action,
       basis, evidence_reference, occurred_at, idempotency_key, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [input.id, input.organizationId, input.locationId ?? null, input.customerId, input.channel,
       input.purpose, input.address, input.action, input.basis, input.evidenceReference,
       input.occurredAt, input.idempotencyKey, context.actorId]);
    const row = result.rows[0]; if (!row) throw new Error("Database did not return consent.");
    await audit(this.db, context, "consent.recorded", "communication_consent", input.id);
    return consent(row);
  }
  async findAttemptByIdempotency(scope: OrganizationScope, key: string) {
    return this.findAttempt(scope, "a.idempotency_key = $2", key);
  }
  findAttemptById(scope: OrganizationScope, id: string) { return this.findAttempt(scope, "a.id = $2", id); }
  private async findAttempt(scope: OrganizationScope, condition: string, value: string) {
    const result = await this.db.query<AttemptRow>(`SELECT ${attemptColumns} FROM communication_send_attempts a
      JOIN communication_consent_events c ON c.organization_id = a.organization_id AND c.id = a.consent_event_id
      WHERE a.organization_id = $1 AND ${condition} LIMIT 1`, [scope.organizationId, value]);
    return result.rows[0] ? attempt(result.rows[0]) : null;
  }
  async resolveEligibility(scope: OrganizationScope, customerId: string, integrationId: string,
    destination: string, purpose: ConsentPurpose, leadId?: string) {
    const result = await this.db.query<ConsentRow & { timezone: string }>(`SELECT ce.*, loc.timezone
      FROM customers customer JOIN locations loc ON loc.organization_id = customer.organization_id AND loc.id = customer.location_id
      JOIN integration_accounts ia ON ia.organization_id = customer.organization_id AND ia.id = $3 AND ia.active = true
      JOIN LATERAL (SELECT * FROM communication_consent_events event WHERE event.organization_id = customer.organization_id
        AND event.customer_id = customer.id AND event.channel = 'sms' AND event.purpose = $5 AND event.address = $4
        ORDER BY event.occurred_at DESC, event.created_at DESC LIMIT 1) ce ON true
      WHERE customer.organization_id = $1 AND customer.id = $2 AND customer.normalized_phone = $4
        AND customer.location_id = $7
        AND (ia.location_id IS NULL OR ia.location_id = customer.location_id)
        AND ($6::text IS NULL OR EXISTS (SELECT 1 FROM leads l WHERE l.organization_id = customer.organization_id AND l.id = $6 AND l.customer_id = customer.id)) LIMIT 1`,
      [scope.organizationId, customerId, integrationId, destination, purpose, leadId ?? null, scope.locationId ?? null]);
    const row = result.rows[0]; return row ? { consent: consent(row), timezone: row.timezone } : null;
  }
  async createAttempt(context: RequestContext, input: Omit<SendAttempt, "status">) {
    await this.db.query(`INSERT INTO communication_send_attempts (id, organization_id, location_id,
      customer_id, lead_id, integration_id, consent_event_id, channel, purpose, destination,
      body, not_before, idempotency_key, requested_by) VALUES ($1,$2,$3,$4,$5,$6,$7,'sms',$8,$9,$10,$11,$12,$13)`,
      [input.id, input.organizationId, input.locationId ?? null, input.customerId, input.leadId ?? null,
       input.integrationId, input.consentEventId, input.purpose, input.destination, input.body,
       input.notBefore, input.idempotencyKey, context.actorId]);
    await audit(this.db, context, "message.queued", "communication_send_attempt", input.id);
    const record = await this.findAttemptById(context, input.id); if (!record) throw new Error("Queued send attempt is unavailable.");
    return record;
  }
}

export class PostgresOutboundGatewayResolver implements OutboundGatewayResolver {
  constructor(private readonly pool: Pool, private readonly context: { userId: string; organizationId: string },
    private readonly credentials: IntegrationCredentialResolver = new EnvironmentIntegrationCredentialResolver()) {}
  async resolve(scope: OrganizationScope, integrationId: string) {
    const config = await withTenantDatabaseContext(this.pool, this.context, async (client) => {
      const result = (await client.query(`SELECT provider_account_id, credential_reference,
        default_from_address FROM integration_accounts WHERE organization_id = $1 AND id = $2
        AND provider = 'twilio' AND active = true LIMIT 1`, [scope.organizationId, integrationId])) as {
        rows: Array<{ provider_account_id: string; credential_reference: string; default_from_address: string | null }> };
      return result.rows[0];
    });
    if (!config?.default_from_address) throw new Error("Active Twilio sender is unavailable.");
    const [authToken, statusCallbackUrl] = await Promise.all([
      this.credentials.resolve(config.credential_reference),
      this.credentials.resolve(`${config.credential_reference}_WEBHOOK_URL`),
    ]);
    return new TwilioMessagingGateway({ accountSid: config.provider_account_id, authToken,
      from: config.default_from_address, statusCallbackUrl });
  }
}

function consent(row: ConsentRow): ConsentEvent { return { id: row.id, organizationId: row.organization_id,
  ...(row.location_id ? { locationId: row.location_id } : {}), customerId: row.customer_id,
  channel: row.channel, purpose: row.purpose, address: row.address, action: row.action,
  basis: row.basis, evidenceReference: row.evidence_reference, occurredAt: row.occurred_at.toISOString(),
  idempotencyKey: row.idempotency_key, createdBy: row.created_by ?? "system" }; }
function attempt(row: AttemptRow): SendAttempt { return { id: row.id, organizationId: row.organization_id,
  ...(row.location_id ? { locationId: row.location_id } : {}), customerId: row.customer_id,
  ...(row.lead_id ? { leadId: row.lead_id } : {}), integrationId: row.integration_id,
  consentEventId: row.consent_event_id, consentBasis: row.consent_basis,
  consentOccurredAt: row.consent_occurred_at.toISOString(), consentEvidenceReference: row.consent_evidence_reference,
  destination: row.destination, body: row.body, purpose: row.purpose, status: row.status,
  notBefore: row.not_before.toISOString(), ...(row.provider_message_id ? { providerMessageId: row.provider_message_id } : {}),
  ...(row.provider_status ? { providerStatus: row.provider_status } : {}),
  ...(row.failure_code ? { failureCode: row.failure_code } : {}), idempotencyKey: row.idempotency_key }; }
async function audit(db: SqlExecutor, context: RequestContext, action: string, entityType: string, entityId: string) {
  await db.query(`INSERT INTO audit_logs (id, organization_id, actor_id, action, entity_type,
    entity_id, source, correlation_id) VALUES ($1,$2,$3,$4,$5,$6,'application',$7)`,
    [generateEntityId("aud"), context.organizationId, context.actorId, action, entityType, entityId, context.correlationId]); }
