import { withTenantDatabaseContext, type DatabasePool } from "@/lib/server/database";

export interface CRMDirectoryScope {
  userId: string;
  organizationId: string;
  locationIds: readonly string[] | "all";
}

export interface CustomerDirectoryItem {
  id: string; displayName: string; email?: string; phone?: string; status: string;
  locationName?: string; activeLead?: { id: string; stage: string; status: string };
  createdAt: string;
}

export interface LeadQueueItem {
  id: string; customerId: string; customerName: string; customerEmail?: string;
  customerPhone?: string; locationName?: string; source: string; stage: string;
  status: string; assignedUserName?: string; nextAppointmentAt?: string;
  openTaskCount: number; createdAt: string;
}

export interface DirectoryPage<RecordType> {
  records: readonly RecordType[];
  nextCursor?: string;
}

export interface DirectoryQuery { search?: string; cursor?: string; limit?: number }
export interface LeadQueueQuery extends DirectoryQuery { status?: string; assignedUserId?: string }

export class CRMDirectoryQueryError extends Error {
  constructor(message: string) { super(message); this.name = "CRMDirectoryQueryError"; }
}

export class CRMDirectoryReader {
  constructor(private readonly pool: DatabasePool) {}

  listCustomers(scope: CRMDirectoryScope, query: DirectoryQuery): Promise<DirectoryPage<CustomerDirectoryItem>> {
    const input = normalize(query);
    return withTenantDatabaseContext(this.pool, scope, async (client) => {
      const result = (await client.query(
        `SELECT c.id, c.display_name, c.email, c.phone, c.status, c.created_at,
           loc.name AS location_name, lead.id AS lead_id, lead.stage AS lead_stage, lead.status AS lead_status
         FROM customers c LEFT JOIN locations loc ON loc.organization_id = c.organization_id AND loc.id = c.location_id
         LEFT JOIN LATERAL (SELECT id, stage, status FROM leads l WHERE l.organization_id = c.organization_id
           AND l.customer_id = c.id ORDER BY CASE WHEN status IN ('open','working','qualified') THEN 0 ELSE 1 END, created_at DESC LIMIT 1) lead ON true
         WHERE c.organization_id = $1 AND ($2::boolean OR c.location_id IS NULL OR c.location_id = ANY($3::text[]))
           AND ($4::text IS NULL OR lower(c.display_name) LIKE $4 || '%' OR c.normalized_email LIKE $4 || '%' OR ($5::text IS NOT NULL AND c.normalized_phone LIKE $5 || '%'))
           AND ($6::timestamptz IS NULL OR (c.created_at, c.id) < ($6, $7))
         ORDER BY c.created_at DESC, c.id DESC LIMIT $8`,
        [scope.organizationId, scope.locationIds === "all", scope.locationIds === "all" ? [] : scope.locationIds,
         input.search || null, input.phoneSearch || null, input.cursor?.createdAt ?? null,
         input.cursor?.id ?? null, input.limit + 1],
      )) as { rows: CustomerRow[] };
      return page(result.rows.map(mapCustomer), input.limit);
    });
  }

  listLeads(scope: CRMDirectoryScope, query: LeadQueueQuery): Promise<DirectoryPage<LeadQueueItem>> {
    const input = normalize(query);
    return withTenantDatabaseContext(this.pool, scope, async (client) => {
      const result = (await client.query(
        `SELECT l.id, l.customer_id, l.source, l.stage, l.status, l.created_at,
           c.display_name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
           loc.name AS location_name, u.display_name AS assigned_user_name,
           appt.starts_at AS next_appointment_at, COALESCE(task.open_count, 0)::int AS open_task_count
         FROM leads l JOIN customers c ON c.organization_id = l.organization_id AND c.id = l.customer_id
         LEFT JOIN locations loc ON loc.organization_id = c.organization_id AND loc.id = c.location_id
         LEFT JOIN users u ON u.id = l.assigned_user_id
         LEFT JOIN LATERAL (SELECT starts_at FROM appointments a WHERE a.organization_id = l.organization_id
           AND a.lead_id = l.id AND a.starts_at >= now() AND a.status IN ('scheduled','confirmed') ORDER BY starts_at LIMIT 1) appt ON true
         LEFT JOIN LATERAL (SELECT count(*) AS open_count FROM tasks t WHERE t.organization_id = l.organization_id
           AND t.lead_id = l.id AND t.status IN ('open','in-progress')) task ON true
         WHERE l.organization_id = $1 AND ($2::boolean OR c.location_id IS NULL OR c.location_id = ANY($3::text[]))
           AND ($4::text IS NULL OR lower(c.display_name) LIKE $4 || '%' OR c.normalized_email LIKE $4 || '%' OR ($5::text IS NOT NULL AND c.normalized_phone LIKE $5 || '%'))
           AND ($6::text IS NULL OR l.status = $6) AND ($7::text IS NULL OR l.assigned_user_id = $7)
           AND ($8::timestamptz IS NULL OR (l.created_at, l.id) < ($8, $9))
         ORDER BY l.created_at DESC, l.id DESC LIMIT $10`,
        [scope.organizationId, scope.locationIds === "all", scope.locationIds === "all" ? [] : scope.locationIds,
         input.search || null, input.phoneSearch || null, query.status?.trim() || null,
         query.assignedUserId?.trim() || null, input.cursor?.createdAt ?? null,
         input.cursor?.id ?? null, input.limit + 1],
      )) as { rows: LeadRow[] };
      return page(result.rows.map(mapLead), input.limit);
    });
  }
}

type CustomerRow = { id: string; display_name: string; email: string | null; phone: string | null; status: string;
  location_name: string | null; lead_id: string | null; lead_stage: string | null; lead_status: string | null; created_at: Date };
type LeadRow = { id: string; customer_id: string; source: string; stage: string; status: string; created_at: Date;
  customer_name: string; customer_email: string | null; customer_phone: string | null; location_name: string | null;
  assigned_user_name: string | null; next_appointment_at: Date | null; open_task_count: number };

function normalize(query: DirectoryQuery) {
  const search = query.search?.trim().toLowerCase() ?? "";
  if (search.length > 100) throw new CRMDirectoryQueryError("Search cannot exceed 100 characters.");
  const limit = query.limit ?? 25;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new CRMDirectoryQueryError("Limit must be between 1 and 100.");
  const phoneSearch = search.replace(/[^+\d]/g, "");
  return { search, phoneSearch: phoneSearch || null, limit, cursor: query.cursor ? decodeCursor(query.cursor) : undefined };
}

function decodeCursor(cursor: string): { createdAt: string; id: string } {
  try { const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as unknown;
    if (parsed && typeof parsed === "object" && "createdAt" in parsed && "id" in parsed &&
      typeof parsed.createdAt === "string" && !Number.isNaN(new Date(parsed.createdAt).valueOf()) && typeof parsed.id === "string") {
      return { createdAt: parsed.createdAt, id: parsed.id };
    }
  } catch { /* handled below */ }
  throw new CRMDirectoryQueryError("Cursor is invalid.");
}
function encodeCursor(record: { createdAt: string; id: string }) { return Buffer.from(JSON.stringify(record)).toString("base64url"); }
function page<RecordType extends { id: string; createdAt: string }>(records: RecordType[], limit: number): DirectoryPage<RecordType> {
  const hasNext = records.length > limit; const visible = hasNext ? records.slice(0, limit) : records;
  return { records: visible, ...(hasNext && visible.length ? { nextCursor: encodeCursor(visible[visible.length - 1]!) } : {}) };
}
function mapCustomer(row: CustomerRow): CustomerDirectoryItem { return { id: row.id, displayName: row.display_name,
  ...(row.email ? { email: row.email } : {}), ...(row.phone ? { phone: row.phone } : {}), status: row.status,
  ...(row.location_name ? { locationName: row.location_name } : {}),
  ...(row.lead_id && row.lead_stage && row.lead_status ? { activeLead: { id: row.lead_id, stage: row.lead_stage, status: row.lead_status } } : {}),
  createdAt: row.created_at.toISOString() }; }
function mapLead(row: LeadRow): LeadQueueItem { return { id: row.id, customerId: row.customer_id,
  customerName: row.customer_name, ...(row.customer_email ? { customerEmail: row.customer_email } : {}),
  ...(row.customer_phone ? { customerPhone: row.customer_phone } : {}), ...(row.location_name ? { locationName: row.location_name } : {}),
  source: row.source, stage: row.stage, status: row.status,
  ...(row.assigned_user_name ? { assignedUserName: row.assigned_user_name } : {}),
  ...(row.next_appointment_at ? { nextAppointmentAt: row.next_appointment_at.toISOString() } : {}),
  openTaskCount: row.open_task_count, createdAt: row.created_at.toISOString() }; }
