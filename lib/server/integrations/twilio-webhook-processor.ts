import type { TwilioEvent, TwilioFormParameters, TwilioWebhookRoute } from "@/lib/integrations/twilio";
import { generateEntityId } from "@/lib/core/identifiers";
import { withTenantDatabaseContext, type DatabasePool } from "@/lib/server/database";

export type WebhookProcessResult = "processed" | "duplicate" | "unmatched";

export class TwilioWebhookProcessor {
  constructor(private readonly pool: DatabasePool) {}

  process(route: TwilioWebhookRoute, event: TwilioEvent, payload: TwilioFormParameters): Promise<WebhookProcessResult> {
    return withTenantDatabaseContext(this.pool, {
      userId: "usr_webhook_system",
      organizationId: route.organizationId,
    }, async (client) => {
      const eventInsert = (await client.query(
        `INSERT INTO integration_events (id, organization_id, integration_id, provider,
         provider_event_id, event_type, payload) VALUES ($1,$2,$3,'twilio',$4,$5,$6::jsonb)
         ON CONFLICT (organization_id, provider, provider_event_id, event_type) DO NOTHING
         RETURNING id`,
        [generateEntityId("evt"), route.organizationId, route.integrationId, event.eventId,
         event.kind, JSON.stringify(payload)],
      )) as { rows: Array<{ id: string }> };
      const inboxId = eventInsert.rows[0]?.id;
      if (!inboxId) return "duplicate";

      if (event.kind === "inbound-message") {
        const customerResult = (await client.query(
          `SELECT id FROM customers WHERE organization_id = $1 AND normalized_phone = $2
           AND ($3::text IS NULL OR location_id = $3) ORDER BY updated_at DESC LIMIT 2`,
          [route.organizationId, event.from, route.locationId ?? null],
        )) as { rows: Array<{ id: string }> };
        if (customerResult.rows.length !== 1) return this.finish(client, inboxId, "unmatched", "customer_not_unique");
        const communicationId = generateEntityId("com");
        await client.query(
          `INSERT INTO communications (id, organization_id, location_id, customer_id,
           channel, direction, status, occurred_at, summary, external_message_id,
           idempotency_key) VALUES ($1,$2,$3,$4,'sms','inbound','received',$5,$6,$7,$8)
           ON CONFLICT (organization_id, idempotency_key) DO NOTHING`,
          [communicationId, route.organizationId, route.locationId ?? null,
           customerResult.rows[0]!.id, event.occurredAt, event.body, event.eventId,
           `twilio:inbound:${event.eventId}`],
        );
        await this.audit(client, route.organizationId, "communication.received", communicationId, event.eventId);
        return this.finish(client, inboxId, "processed");
      }

      const update = (await client.query(
        `UPDATE communications SET status = $3, updated_at = now()
         WHERE organization_id = $1 AND external_message_id = $2
           AND status NOT IN ('delivered','failed')
         RETURNING id`,
        [route.organizationId, event.eventId, event.status],
      )) as { rows: Array<{ id: string }> };
      const attemptUpdate = (await client.query(
        `UPDATE communication_send_attempts SET provider_status = $3,
          status = CASE WHEN $3 = 'failed' THEN 'rejected' ELSE 'accepted' END,
          failure_code = CASE WHEN $3 = 'failed' THEN 'provider_rejected' ELSE NULL END,
          updated_at = now()
         WHERE organization_id = $1 AND provider_message_id = $2
           AND (provider_status IS NULL OR provider_status NOT IN ('delivered','failed'))
         RETURNING id`,
        [route.organizationId, event.eventId, event.status],
      )) as { rows: Array<{ id: string }> };
      if (!update.rows[0] && !attemptUpdate.rows[0]) {
        return this.finish(client, inboxId, "unmatched", "message_not_found");
      }
      if (attemptUpdate.rows[0]) {
        await this.audit(client, route.organizationId, "message_attempt.status_changed", attemptUpdate.rows[0].id, event.eventId);
      }
      if (!update.rows[0]) return this.finish(client, inboxId, "processed");
      await this.audit(client, route.organizationId, "communication.status_changed", update.rows[0].id, event.eventId);
      return this.finish(client, inboxId, "processed");
    });
  }

  private async finish(client: { query(text: string, values?: readonly unknown[]): Promise<unknown> }, id: string,
    status: "processed" | "unmatched", failureCode?: string): Promise<WebhookProcessResult> {
    await client.query(`UPDATE integration_events SET status = $2, failure_code = $3,
      processed_at = now() WHERE id = $1`, [id, status, failureCode ?? null]);
    return status;
  }

  private async audit(client: { query(text: string, values?: readonly unknown[]): Promise<unknown> },
    organizationId: string, action: string, entityId: string, correlationId: string) {
    await client.query(`INSERT INTO audit_logs (id, organization_id, action, entity_type,
      entity_id, source, correlation_id) VALUES ($1,$2,$3,'communication',$4,'twilio',$5)`,
      [generateEntityId("aud"), organizationId, action, entityId, correlationId]);
  }
}
