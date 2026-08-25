import type { Pool } from "pg";

import type {
  CommunicationProvider, CommunicationRecord, CommunicationSession,
  CreateCommunicationInput,
} from "@/lib/application/communications";
import { generateEntityId } from "@/lib/core/identifiers";
import type { OrganizationScope, RequestContext } from "@/lib/platform/data";
import { withTenantDatabaseContext } from "@/lib/server/database";
import type { SqlExecutor } from "./postgres-crm-provider";

type Row = { id: string; organization_id: string; location_id: string | null;
  customer_id: string; lead_id: string | null; actor_user_id: string | null;
  channel: "call" | "sms" | "email"; direction: "inbound" | "outbound";
  status: "attempted" | "sent" | "delivered" | "received" | "failed";
  occurred_at: Date; summary: string; external_message_id: string | null;
  idempotency_key: string; created_at: Date; created_by: string | null };
const columns = `id, organization_id, location_id, customer_id, lead_id,
 actor_user_id, channel, direction, status, occurred_at, summary,
 external_message_id, idempotency_key, created_at, created_by`;

export class PostgresCommunicationProvider implements CommunicationProvider {
  constructor(private readonly pool: Pool, private readonly context: { userId: string; organizationId: string }) {}
  transaction<Result>(operation: (session: CommunicationSession) => Promise<Result>) {
    return withTenantDatabaseContext(this.pool, this.context, (client) =>
      operation(new PostgresCommunicationSession(client as unknown as SqlExecutor)));
  }
}

export class PostgresCommunicationSession implements CommunicationSession {
  constructor(private readonly db: SqlExecutor) {}
  async acquireIdempotencyLock(scope: OrganizationScope, key: string) {
    await this.db.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`${scope.organizationId}:${key}`]);
  }
  async targetExists(scope: OrganizationScope, customerId: string, leadId?: string) {
    const result = await this.db.query<{ exists: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM customers c
       WHERE c.organization_id = $1 AND c.id = $2
       AND ($3::text IS NULL OR EXISTS (SELECT 1 FROM leads l WHERE l.organization_id = c.organization_id AND l.id = $3 AND l.customer_id = c.id))) AS exists`,
      [scope.organizationId, customerId, leadId ?? null]);
    return result.rows[0]?.exists === true;
  }
  async findByIdempotencyKey(scope: OrganizationScope, key: string) {
    const result = await this.db.query<Row>(`SELECT ${columns} FROM communications WHERE organization_id = $1 AND idempotency_key = $2 LIMIT 1`, [scope.organizationId, key]);
    return result.rows[0] ? map(result.rows[0]) : null;
  }
  async create(context: RequestContext, input: CreateCommunicationInput) {
    if (context.organizationId !== input.organizationId) throw new Error("Write context and record organization do not match.");
    const result = await this.db.query<Row>(
      `INSERT INTO communications (id, organization_id, location_id, customer_id, lead_id,
       actor_user_id, channel, direction, status, occurred_at, summary, external_message_id,
       idempotency_key, created_by, updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14)
       RETURNING ${columns}`,
      [input.id, input.organizationId, input.locationId ?? null, input.customerId,
       input.leadId ?? null, input.actorUserId ?? null, input.channel, input.direction,
       input.status, input.occurredAt, input.summary, input.externalMessageId ?? null,
       input.idempotencyKey, context.actorId]);
    const row = result.rows[0]; if (!row) throw new Error("Database did not return the created communication.");
    await this.db.query(
      `INSERT INTO audit_logs (id, organization_id, actor_id, action, entity_type,
       entity_id, source, correlation_id, new_values) VALUES ($1,$2,$3,'communication.created','communication',$4,'application',$5,$6::jsonb)`,
      [generateEntityId("aud"), context.organizationId, context.actorId, input.id,
       context.correlationId, JSON.stringify(input)]);
    return map(row);
  }
}

function map(row: Row): CommunicationRecord {
  return { id: row.id, organizationId: row.organization_id,
    ...(row.location_id ? { locationId: row.location_id } : {}), customerId: row.customer_id,
    ...(row.lead_id ? { leadId: row.lead_id } : {}),
    ...(row.actor_user_id ? { actorUserId: row.actor_user_id } : {}),
    channel: row.channel, direction: row.direction, status: row.status,
    occurredAt: row.occurred_at.toISOString(), summary: row.summary,
    ...(row.external_message_id ? { externalMessageId: row.external_message_id } : {}),
    idempotencyKey: row.idempotency_key, createdAt: row.created_at.toISOString(),
    createdBy: row.created_by ?? "system" };
}
