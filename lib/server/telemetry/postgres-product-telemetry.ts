import { validateProductUsageEvent, type ProductUsageEventInput } from "@/lib/application/telemetry";
import { generateEntityId } from "@/lib/core/identifiers";
import { withTenantDatabaseContext, type DatabasePool } from "@/lib/server/database";

export class PostgresProductTelemetry {
  constructor(private readonly pool: DatabasePool) {}

  record(input: ProductUsageEventInput): Promise<{ id: string; created: boolean }> {
    const event = validateProductUsageEvent(input);
    return withTenantDatabaseContext(this.pool, { userId: event.userId ?? "usr_system_telemetry", organizationId: event.organizationId }, async (client) => {
      const id = generateEntityId("pue");
      const result = await client.query(
        `INSERT INTO product_usage_events(id,organization_id,user_id,location_id,event_name,actor_type,data_class,workspace,feature,action,role_key,release,device_class,request_id,feature_flags,attributes,idempotency_key,occurred_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16::jsonb,$17,$18)
         ON CONFLICT(organization_id,idempotency_key) DO NOTHING RETURNING id`,
        [id,event.organizationId,event.userId??null,event.locationId??null,event.eventName,event.actorType,event.dataClass,event.workspace,event.feature,event.action,event.roleKey??null,event.release,event.deviceClass,event.requestId??null,JSON.stringify(event.featureFlags??{}),JSON.stringify(event.attributes??{}),event.idempotencyKey,event.occurredAt],
      ) as { rows: Array<{ id: string }> };
      return result.rows[0] ? { id: result.rows[0].id, created: true } : { id, created: false };
    });
  }
}
