import type { Pool } from "pg";

import { generateEntityId } from "@/lib/core/identifiers";
import type {
  CRMDataProvider,
  CRMDataSession,
  CreateCustomerInput,
  CreateAppointmentInput,
  CreateLeadInput,
  CreateTaskInput,
  CustomerIdentityQuery,
  CustomerQuery,
  CustomerRecord,
  LeadQuery,
  LeadRecord,
  OrganizationScope,
  PageResult,
  RequestContext,
  AppointmentRecord,
  TaskRecord,
} from "@/lib/platform/data";
import {
  withTenantDatabaseContext,
  type DatabaseClient,
  type TenantDatabaseContext,
} from "@/lib/server/database";

export interface QueryResult<Row> {
  rows: Row[];
}

export interface SqlExecutor {
  query<Row extends Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<Row>>;
}

type CustomerRow = {
  id: string;
  organization_id: string;
  location_id: string | null;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  created_at: Date;
  created_by: string | null;
  updated_at: Date;
  updated_by: string | null;
};

type LeadRow = {
  id: string;
  organization_id: string;
  location_id: string | null;
  customer_id: string;
  assigned_user_id: string | null;
  source: string;
  source_detail: string | null;
  stage: string;
  status: string;
  idempotency_key: string;
  created_at: Date;
  created_by: string | null;
  updated_at: Date;
  updated_by: string | null;
};

type AppointmentRow = {
  id: string; organization_id: string; location_id: string | null;
  customer_id: string; lead_id: string | null; assigned_user_id: string | null;
  type: string; status: string; starts_at: Date; ends_at: Date; timezone: string;
  notes: string | null; idempotency_key: string; created_at: Date;
  created_by: string | null; updated_at: Date; updated_by: string | null;
};

type TaskRow = {
  id: string; organization_id: string; location_id: string | null;
  customer_id: string; lead_id: string | null; appointment_id: string | null;
  assigned_user_id: string | null; title: string; status: string; priority: string;
  due_at: Date | null; idempotency_key: string; created_at: Date;
  created_by: string | null; updated_at: Date; updated_by: string | null;
};

const customerColumns = `id, organization_id, location_id, display_name,
  first_name, last_name, email, phone, status, created_at, created_by,
  updated_at, updated_by`;
const leadColumns = `id, organization_id, location_id, customer_id,
  assigned_user_id, source, source_detail, stage, status, idempotency_key,
  created_at, created_by, updated_at, updated_by`;
const appointmentColumns = `id, organization_id, location_id, customer_id,
  lead_id, assigned_user_id, type, status, starts_at, ends_at, timezone, notes,
  idempotency_key, created_at, created_by, updated_at, updated_by`;
const taskColumns = `id, organization_id, location_id, customer_id, lead_id,
  appointment_id, assigned_user_id, title, status, priority, due_at,
  idempotency_key, created_at, created_by, updated_at, updated_by`;

export class PostgresCRMDataProvider implements CRMDataProvider {
  constructor(
    private readonly pool: Pool,
    private readonly tenantContext: TenantDatabaseContext,
  ) {}

  transaction<Result>(
    operation: (session: CRMDataSession) => Promise<Result>,
  ): Promise<Result> {
    return withTenantDatabaseContext(this.pool, this.tenantContext, (client) =>
      operation(new PostgresCRMSession(asExecutor(client))),
    );
  }

  acquireIdempotencyLock(scope: OrganizationScope, idempotencyKey: string) {
    return this.transaction((session) =>
      session.acquireIdempotencyLock(scope, idempotencyKey),
    );
  }

  getCustomer(scope: OrganizationScope, customerId: string) {
    return this.read((session) => session.getCustomer(scope, customerId));
  }

  listCustomers(query: CustomerQuery) {
    return this.read((session) => session.listCustomers(query));
  }

  findCustomerByIdentity(query: CustomerIdentityQuery) {
    return this.read((session) => session.findCustomerByIdentity(query));
  }

  createCustomer(context: RequestContext, input: CreateCustomerInput) {
    return this.transaction((session) => session.createCustomer(context, input));
  }

  getLead(scope: OrganizationScope, leadId: string) {
    return this.read((session) => session.getLead(scope, leadId));
  }

  listLeads(query: LeadQuery) {
    return this.read((session) => session.listLeads(query));
  }

  findLeadByIdempotencyKey(
    scope: OrganizationScope,
    idempotencyKey: string,
  ) {
    return this.read((session) =>
      session.findLeadByIdempotencyKey(scope, idempotencyKey),
    );
  }

  createLead(context: RequestContext, input: CreateLeadInput) {
    return this.transaction((session) => session.createLead(context, input));
  }

  getAppointment(scope: OrganizationScope, appointmentId: string) {
    return this.read((session) => session.getAppointment(scope, appointmentId));
  }
  findAppointmentByIdempotencyKey(scope: OrganizationScope, key: string) {
    return this.read((session) => session.findAppointmentByIdempotencyKey(scope, key));
  }
  createAppointment(context: RequestContext, input: CreateAppointmentInput) {
    return this.transaction((session) => session.createAppointment(context, input));
  }
  findTaskByIdempotencyKey(scope: OrganizationScope, key: string) {
    return this.read((session) => session.findTaskByIdempotencyKey(scope, key));
  }
  createTask(context: RequestContext, input: CreateTaskInput) {
    return this.transaction((session) => session.createTask(context, input));
  }

  private read<Result>(
    operation: (session: CRMDataSession) => Promise<Result>,
  ): Promise<Result> {
    return this.transaction(operation);
  }
}

export class PostgresCRMSession implements CRMDataSession {
  constructor(private readonly database: SqlExecutor) {}

  async acquireIdempotencyLock(scope: OrganizationScope, idempotencyKey: string) {
    await this.database.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`${scope.organizationId}:${idempotencyKey}`],
    );
  }

  async getCustomer(scope: OrganizationScope, customerId: string) {
    const result = await this.database.query<CustomerRow>(
      `SELECT ${customerColumns} FROM customers
       WHERE organization_id = $1 AND id = $2 LIMIT 1`,
      [scope.organizationId, customerId],
    );
    return result.rows[0] ? mapCustomer(result.rows[0]) : null;
  }

  async listCustomers(query: CustomerQuery): Promise<PageResult<CustomerRecord>> {
    const limit = normalizeLimit(query.limit);
    const result = await this.database.query<CustomerRow>(
      `SELECT ${customerColumns} FROM customers
       WHERE organization_id = $1
         AND ($2::text IS NULL OR id > $2)
         AND ($3::text IS NULL OR display_name ILIKE '%' || $3 || '%'
           OR email ILIKE '%' || $3 || '%' OR phone ILIKE '%' || $3 || '%')
       ORDER BY id LIMIT $4`,
      [query.organizationId, query.cursor ?? null, query.search?.trim() || null, limit + 1],
    );
    return page(result.rows.map(mapCustomer), limit);
  }

  async findCustomerByIdentity(query: CustomerIdentityQuery) {
    if (!query.normalizedEmail && !query.normalizedPhone) return null;
    const result = await this.database.query<CustomerRow>(
      `SELECT ${customerColumns} FROM customers
       WHERE organization_id = $1
         AND (($2::text IS NOT NULL AND normalized_email = $2)
           OR ($3::text IS NOT NULL AND normalized_phone = $3))
       ORDER BY updated_at DESC LIMIT 2`,
      [query.organizationId, query.normalizedEmail ?? null, query.normalizedPhone ?? null],
    );
    if (result.rows.length > 1) {
      throw new Error("Customer identity resolves to multiple records.");
    }
    return result.rows[0] ? mapCustomer(result.rows[0]) : null;
  }

  async createCustomer(context: RequestContext, input: CreateCustomerInput) {
    assertSameTenant(context, input);
    const result = await this.database.query<CustomerRow>(
      `INSERT INTO customers (id, organization_id, location_id, display_name,
        first_name, last_name, email, normalized_email, phone, normalized_phone,
        created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)
       RETURNING ${customerColumns}`,
      [input.id, input.organizationId, input.locationId ?? null, input.displayName,
        input.firstName ?? null, input.lastName ?? null, input.email ?? null,
        input.normalizedEmail ?? null, input.phone ?? null,
        input.normalizedPhone ?? null, context.actorId],
    );
    const customer = requireRow(result.rows[0], "customer");
    await this.writeAudit(context, "customer.created", "customer", input.id, input);
    return mapCustomer(customer);
  }

  async getLead(scope: OrganizationScope, leadId: string) {
    const result = await this.database.query<LeadRow>(
      `SELECT ${leadColumns} FROM leads
       WHERE organization_id = $1 AND id = $2 LIMIT 1`,
      [scope.organizationId, leadId],
    );
    return result.rows[0] ? mapLead(result.rows[0]) : null;
  }

  async listLeads(query: LeadQuery): Promise<PageResult<LeadRecord>> {
    const limit = normalizeLimit(query.limit);
    const result = await this.database.query<LeadRow>(
      `SELECT ${leadColumns} FROM leads
       WHERE organization_id = $1 AND ($2::text IS NULL OR id > $2)
         AND ($3::text IS NULL OR customer_id = $3)
         AND ($4::text IS NULL OR assigned_user_id = $4)
         AND ($5::text IS NULL OR stage = $5)
         AND ($6::text IS NULL OR status = $6)
       ORDER BY id LIMIT $7`,
      [query.organizationId, query.cursor ?? null, query.customerId ?? null,
        query.assignedUserId ?? null, query.stage ?? null, query.status ?? null,
        limit + 1],
    );
    return page(result.rows.map(mapLead), limit);
  }

  async findLeadByIdempotencyKey(
    scope: OrganizationScope,
    idempotencyKey: string,
  ) {
    const result = await this.database.query<LeadRow>(
      `SELECT ${leadColumns} FROM leads
       WHERE organization_id = $1 AND idempotency_key = $2 LIMIT 1`,
      [scope.organizationId, idempotencyKey],
    );
    return result.rows[0] ? mapLead(result.rows[0]) : null;
  }

  async createLead(context: RequestContext, input: CreateLeadInput) {
    assertSameTenant(context, input);
    const result = await this.database.query<LeadRow>(
      `INSERT INTO leads (id, organization_id, location_id, customer_id,
        assigned_user_id, source, source_detail, stage, idempotency_key,
        created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)
       RETURNING ${leadColumns}`,
      [input.id, input.organizationId, input.locationId ?? null, input.customerId,
        input.assignedUserId ?? null, input.source, input.sourceDetail ?? null,
        input.stage, input.idempotencyKey, context.actorId],
    );
    const lead = requireRow(result.rows[0], "lead");
    await this.database.query(
      `INSERT INTO lead_status_events(id,organization_id,lead_id,from_status,to_status,
       idempotency_key,created_by) VALUES($1,$2,$3,NULL,'open',$4,$5)`,
      [generateEntityId("lse"),input.organizationId,input.id,
       `create:${input.idempotencyKey}`,context.actorId],
    );
    await this.writeAudit(context, "lead.created", "lead", input.id, input);
    return mapLead(lead);
  }

  async getAppointment(scope: OrganizationScope, appointmentId: string) {
    const result = await this.database.query<AppointmentRow>(
      `SELECT ${appointmentColumns} FROM appointments WHERE organization_id = $1 AND id = $2 LIMIT 1`,
      [scope.organizationId, appointmentId],
    );
    return result.rows[0] ? mapAppointment(result.rows[0]) : null;
  }

  async findAppointmentByIdempotencyKey(scope: OrganizationScope, key: string) {
    const result = await this.database.query<AppointmentRow>(
      `SELECT ${appointmentColumns} FROM appointments WHERE organization_id = $1 AND idempotency_key = $2 LIMIT 1`,
      [scope.organizationId, key],
    );
    return result.rows[0] ? mapAppointment(result.rows[0]) : null;
  }

  async createAppointment(context: RequestContext, input: CreateAppointmentInput) {
    assertSameTenant(context, input);
    const result = await this.database.query<AppointmentRow>(
      `INSERT INTO appointments (id, organization_id, location_id, customer_id, lead_id,
       assigned_user_id, type, starts_at, ends_at, timezone, notes, idempotency_key,
       created_by, updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13)
       RETURNING ${appointmentColumns}`,
      [input.id, input.organizationId, input.locationId ?? null, input.customerId,
       input.leadId ?? null, input.assignedUserId ?? null, input.type, input.startsAt,
       input.endsAt, input.timezone, input.notes ?? null, input.idempotencyKey, context.actorId],
    );
    const row = requireRow(result.rows[0], "appointment");
    await this.database.query(
      `INSERT INTO appointment_status_events (id, organization_id, appointment_id,
       from_status, to_status, idempotency_key, created_by)
       VALUES ($1,$2,$3,NULL,'scheduled',$4,$5)`,
      [generateEntityId("ase"), input.organizationId, input.id,
       `create:${input.idempotencyKey}`, context.actorId],
    );
    await this.writeAudit(context, "appointment.created", "appointment", input.id, input);
    return mapAppointment(row);
  }

  async findTaskByIdempotencyKey(scope: OrganizationScope, key: string) {
    const result = await this.database.query<TaskRow>(
      `SELECT ${taskColumns} FROM tasks WHERE organization_id = $1 AND idempotency_key = $2 LIMIT 1`,
      [scope.organizationId, key],
    );
    return result.rows[0] ? mapTask(result.rows[0]) : null;
  }

  async createTask(context: RequestContext, input: CreateTaskInput) {
    assertSameTenant(context, input);
    const result = await this.database.query<TaskRow>(
      `INSERT INTO tasks (id, organization_id, location_id, customer_id, lead_id,
       appointment_id, assigned_user_id, title, priority, due_at, idempotency_key,
       created_by, updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)
       RETURNING ${taskColumns}`,
      [input.id, input.organizationId, input.locationId ?? null, input.customerId,
       input.leadId ?? null, input.appointmentId ?? null, input.assignedUserId ?? null,
       input.title, input.priority, input.dueAt ?? null, input.idempotencyKey, context.actorId],
    );
    const row = requireRow(result.rows[0], "task");
    await this.database.query(
      `INSERT INTO task_status_events (id, organization_id, task_id, from_status,
       to_status, idempotency_key, created_by) VALUES ($1,$2,$3,NULL,'open',$4,$5)`,
      [generateEntityId("tse"), input.organizationId, input.id,
       `create:${input.idempotencyKey}`, context.actorId],
    );
    await this.writeAudit(context, "task.created", "task", input.id, input);
    return mapTask(row);
  }

  private async writeAudit(
    context: RequestContext,
    action: string,
    entityType: string,
    entityId: string,
    newValues: object,
  ) {
    await this.database.query(
      `INSERT INTO audit_logs (id, organization_id, actor_id, action,
        entity_type, entity_id, source, correlation_id, new_values)
       VALUES ($1,$2,$3,$4,$5,$6,'application',$7,$8::jsonb)`,
      [generateEntityId("aud"), context.organizationId, context.actorId, action,
        entityType, entityId, context.correlationId, JSON.stringify(newValues)],
    );
  }
}

function asExecutor(client: DatabaseClient): SqlExecutor {
  return client as unknown as SqlExecutor;
}

function assertSameTenant(context: RequestContext, input: OrganizationScope) {
  if (context.organizationId !== input.organizationId) {
    throw new Error("Write context and record organization do not match.");
  }
  if (context.locationId && input.locationId && context.locationId !== input.locationId) {
    throw new Error("Write context and record location do not match.");
  }
}

function normalizeLimit(limit: number) {
  if (!Number.isInteger(limit) || limit < 1) throw new Error("Page limit must be positive.");
  return Math.min(limit, 100);
}

function page<RecordType extends { id: string }>(records: RecordType[], limit: number) {
  const hasNext = records.length > limit;
  const visible = hasNext ? records.slice(0, limit) : records;
  return {
    records: visible,
    ...(hasNext ? { nextCursor: visible.at(-1)?.id } : {}),
  };
}

function requireRow<Row>(row: Row | undefined, entity: string): Row {
  if (!row) throw new Error(`Database did not return the created ${entity}.`);
  return row;
}

function mapCustomer(row: CustomerRow): CustomerRecord {
  return {
    id: row.id, organizationId: row.organization_id,
    ...(row.location_id ? { locationId: row.location_id } : {}),
    displayName: row.display_name,
    ...(row.first_name ? { firstName: row.first_name } : {}),
    ...(row.last_name ? { lastName: row.last_name } : {}),
    ...(row.email ? { email: row.email } : {}),
    ...(row.phone ? { phone: row.phone } : {}), status: row.status,
    createdAt: row.created_at.toISOString(), createdBy: row.created_by ?? "system",
    updatedAt: row.updated_at.toISOString(), updatedBy: row.updated_by ?? "system",
  };
}

function mapLead(row: LeadRow): LeadRecord {
  return {
    id: row.id, organizationId: row.organization_id,
    ...(row.location_id ? { locationId: row.location_id } : {}),
    customerId: row.customer_id,
    ...(row.assigned_user_id ? { assignedUserId: row.assigned_user_id } : {}),
    source: row.source,
    ...(row.source_detail ? { sourceDetail: row.source_detail } : {}),
    stage: row.stage, status: row.status, idempotencyKey: row.idempotency_key,
    createdAt: row.created_at.toISOString(), createdBy: row.created_by ?? "system",
    updatedAt: row.updated_at.toISOString(), updatedBy: row.updated_by ?? "system",
  };
}

function mapAppointment(row: AppointmentRow): AppointmentRecord {
  return { id: row.id, organizationId: row.organization_id,
    ...(row.location_id ? { locationId: row.location_id } : {}), customerId: row.customer_id,
    ...(row.lead_id ? { leadId: row.lead_id } : {}),
    ...(row.assigned_user_id ? { assignedUserId: row.assigned_user_id } : {}),
    type: row.type, status: row.status, startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at.toISOString(), timezone: row.timezone,
    ...(row.notes ? { notes: row.notes } : {}), idempotencyKey: row.idempotency_key,
    createdAt: row.created_at.toISOString(), createdBy: row.created_by ?? "system",
    updatedAt: row.updated_at.toISOString(), updatedBy: row.updated_by ?? "system" };
}

function mapTask(row: TaskRow): TaskRecord {
  return { id: row.id, organizationId: row.organization_id,
    ...(row.location_id ? { locationId: row.location_id } : {}), customerId: row.customer_id,
    ...(row.lead_id ? { leadId: row.lead_id } : {}),
    ...(row.appointment_id ? { appointmentId: row.appointment_id } : {}),
    ...(row.assigned_user_id ? { assignedUserId: row.assigned_user_id } : {}),
    title: row.title, status: row.status, priority: row.priority,
    ...(row.due_at ? { dueAt: row.due_at.toISOString() } : {}),
    idempotencyKey: row.idempotency_key, createdAt: row.created_at.toISOString(),
    createdBy: row.created_by ?? "system", updatedAt: row.updated_at.toISOString(),
    updatedBy: row.updated_by ?? "system" };
}
