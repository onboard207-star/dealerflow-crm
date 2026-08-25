import type { Pool } from "pg";
import type { IntegrationConfigurationProvider, IntegrationConfigurationSession,
  TwilioIntegrationInput, TwilioIntegrationRecord } from "@/lib/application/integrations";
import { generateEntityId } from "@/lib/core/identifiers";
import type { RequestContext } from "@/lib/platform/data";
import { withTenantDatabaseContext } from "@/lib/server/database";

export class PostgresIntegrationConfigurationProvider implements IntegrationConfigurationProvider {
  constructor(private readonly pool: Pool, private readonly context: { userId: string; organizationId: string }) {}
  transaction<Result>(operation: (session: IntegrationConfigurationSession) => Promise<Result>) {
    return withTenantDatabaseContext(this.pool, this.context, (client) => operation({
      createTwilio: async (context: RequestContext, input: TwilioIntegrationInput & { id: string; webhookKeyHash: string }) => {
        if (context.organizationId !== input.organizationId) throw new Error("Integration tenant context does not match.");
        const result = (await client.query(
          `INSERT INTO integration_accounts (id, organization_id, location_id, provider,
           provider_account_id, credential_reference, webhook_key_hash, public_base_url,
           default_from_address) VALUES ($1,$2,$3,'twilio',$4,$5,$6,$7,$8)
           RETURNING id, organization_id, location_id, provider_account_id,
            credential_reference, public_base_url, default_from_address, active`,
          [input.id, input.organizationId, input.locationId ?? null, input.providerAccountId,
           input.credentialReference, input.webhookKeyHash, input.publicBaseUrl,
           input.defaultFromAddress ?? null],
        )) as { rows: Array<{ id: string; organization_id: string; location_id: string | null;
          provider_account_id: string; credential_reference: string; public_base_url: string;
          default_from_address: string | null; active: boolean }> };
        const row = result.rows[0]; if (!row) throw new Error("Database did not return the integration.");
        await client.query(`INSERT INTO audit_logs (id, organization_id, actor_id, action,
          entity_type, entity_id, source, correlation_id) VALUES ($1,$2,$3,'integration.created',
          'integration',$4,'application',$5)`, [generateEntityId("aud"), context.organizationId,
          context.actorId, input.id, context.correlationId]);
        const record: TwilioIntegrationRecord = { id: row.id, organizationId: row.organization_id,
          ...(row.location_id ? { locationId: row.location_id } : {}),
          providerAccountId: row.provider_account_id, credentialReference: row.credential_reference,
          publicBaseUrl: row.public_base_url,
          ...(row.default_from_address ? { defaultFromAddress: row.default_from_address } : {}), active: row.active };
        return record;
      },
    }));
  }
}
