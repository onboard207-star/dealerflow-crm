import type { Pool } from "pg";
import type { TwilioWebhookRoute } from "@/lib/integrations/twilio";

export class TwilioRouteResolver {
  constructor(private readonly pool: Pool) {}
  async resolve(webhookKey: string, accountSid: string): Promise<TwilioWebhookRoute | null> {
    if (!/^[A-Za-z0-9_-]{32,128}$/.test(webhookKey) || !/^AC[a-fA-F0-9]{32}$/.test(accountSid)) return null;
    const result = await this.pool.query<{
      integration_id: string; organization_id: string; location_id: string | null;
      credential_reference: string; public_base_url: string;
    }>("SELECT * FROM resolve_twilio_webhook_account($1, $2)", [webhookKey, accountSid]);
    const row = result.rows[0];
    return row ? { integrationId: row.integration_id, organizationId: row.organization_id,
      ...(row.location_id ? { locationId: row.location_id } : {}),
      credentialReference: row.credential_reference, publicBaseUrl: row.public_base_url } : null;
  }
}
