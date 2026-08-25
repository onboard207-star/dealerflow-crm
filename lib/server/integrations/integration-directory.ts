import { withTenantDatabaseContext, type DatabasePool } from "@/lib/server/database";

export interface TwilioIntegrationSummary {
  id: string;
  locationId?: string;
  locationName?: string;
  accountSuffix: string;
  publicBaseUrl: string;
  defaultFromAddress?: string;
  active: boolean;
  updatedAt: string;
}

export class IntegrationDirectoryReader {
  constructor(private readonly pool: DatabasePool) {}

  listTwilio(context: { userId: string; organizationId: string; locationIds: readonly string[] | "all" }): Promise<readonly TwilioIntegrationSummary[]> {
    return withTenantDatabaseContext(this.pool, context, async (client) => {
      const allLocations = context.locationIds === "all";
      const locationIds = allLocations ? [] : [...context.locationIds];
      const result = (await client.query(
        `SELECT integration.id, integration.location_id, location.name AS location_name,
          right(integration.provider_account_id, 4) AS account_suffix,
          integration.public_base_url, integration.default_from_address,
          integration.active, integration.updated_at
         FROM integration_accounts integration
         LEFT JOIN locations location ON location.organization_id=integration.organization_id
          AND location.id=integration.location_id
         WHERE integration.organization_id=$1 AND integration.provider='twilio'
          AND ($2::boolean OR integration.location_id=ANY($3::text[]))
         ORDER BY integration.active DESC, location.name NULLS FIRST, integration.updated_at DESC`,
        [context.organizationId, allLocations, locationIds],
      )) as { rows: Array<{ id: string; location_id: string | null; location_name: string | null;
        account_suffix: string; public_base_url: string; default_from_address: string | null;
        active: boolean; updated_at: Date | string }> };
      return result.rows.map((row) => ({ id: row.id,
        ...(row.location_id ? { locationId: row.location_id } : {}),
        ...(row.location_name ? { locationName: row.location_name } : {}),
        accountSuffix: row.account_suffix, publicBaseUrl: row.public_base_url,
        ...(row.default_from_address ? { defaultFromAddress: row.default_from_address } : {}),
        active: row.active, updatedAt: new Date(row.updated_at).toISOString() }));
    });
  }
}
