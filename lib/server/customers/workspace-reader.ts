import { withTenantDatabaseContext, type DatabasePool } from "@/lib/server/database";

export type TimelineKind = "lead" | "communication" | "appointment" | "visit" | "task" | "vehicle" | "deal" | "quote" | "trade" | "delivery";
export interface TimelineEntry { id: string; kind: TimelineKind; title: string; description?: string; status?: string; occurredAt: string; }
export interface CustomerWorkspaceRecord {
  customer: { id: string; locationId?: string; displayName: string; firstName?:string;lastName?:string;email?: string; phone?: string; status: string; createdAt: string;updatedAt:string };
  lead?: { id: string; source: string; stage: string; status: "open"|"working"|"qualified"|"sold"|"lost"|"archived"; assignedUserName?: string; createdAt: string };
  nextAppointment?: { id: string; type: string; status: string; startsAt: string; timezone: string };
  currentVisit?: { id: string; locationId: string; status: "checked-in" | "active"; purpose: string; arrivedAt: string; startedAt?: string; appointmentId?: string };
  vehicleInterests: readonly { id: string; vehicleId: string; role: "primary" | "alternative" | "trade"; status: string; priority: number; year: number; make: string; model: string; trim?: string; exteriorColor?: string; vin: string; inventoryId?: string; inventoryLocationId?: string; stockNumber?: string; inventoryStatus?: string; listPriceCents?: number }[];
  deal?: { id: string; dealNumber: string; status: "draft" | "working" | "pending-approval" | "approved" | "contracted" | "delivered" | "cancelled"; purchaseType?: string; agreedPriceCents?: number };
  quote?: { id: string; version: number; status: "draft" | "presented" | "accepted" | "rejected" | "expired"; purchaseType: "cash" | "finance" | "lease"; currency: string; totalCents: number; expiresAt?: string };
  tradeAppraisal?: { id: string; vehicleId: string; version: number; status: "draft" | "presented" | "accepted" | "rejected" | "expired" | "acquired"; allowanceCents: number; payoffCents: number; equityCents: number; vehicleLabel: string };
  delivery?: { id: string; status: "scheduled" | "ready" | "completed" | "cancelled"; startsAt: string; endsAt: string; timezone: string; completedAt?: string };
  activeTasks: readonly { id:string;title:string;status:"open"|"in-progress";priority:"low"|"normal"|"high"|"urgent";dueAt?:string;assignedUserName?:string }[];
  openTaskCount: number;
  timeline: readonly TimelineEntry[];
}

export interface CustomerWorkspaceVisibility {
  locationIds: readonly string[] | "all";
  communications: boolean;
  appointments: boolean;
  tasks: boolean;
  inventory: boolean;
  deals: boolean;
}

export class CustomerWorkspaceReader {
  constructor(private readonly pool: DatabasePool) {}

  read(userId: string, organizationId: string, customerId: string, visibility: CustomerWorkspaceVisibility): Promise<CustomerWorkspaceRecord | null> {
    return withTenantDatabaseContext(this.pool, { userId, organizationId }, async (client) => {
      const allLocations = visibility.locationIds === "all";
      const locationIds = allLocations ? [] : [...visibility.locationIds];
      const customerResult = (await client.query(
        `SELECT id, location_id, display_name, first_name, last_name, email, phone, status, created_at,updated_at
         FROM customers WHERE organization_id = $1 AND id = $2
         AND ($3::boolean OR location_id IS NULL OR location_id = ANY($4::text[])) LIMIT 1`,
        [organizationId, customerId, allLocations, locationIds],
      )) as { rows: Array<{ id: string; location_id: string | null; display_name: string;first_name:string|null;last_name:string|null;email: string | null; phone: string | null; status: string; created_at: Date;updated_at:Date }> };
      const customer = customerResult.rows[0]; if (!customer) return null;
      const leadResult = (await client.query(
        `SELECT l.id, l.source, l.stage, l.status, l.created_at, u.display_name AS assigned_user_name
         FROM leads l LEFT JOIN users u ON u.id = l.assigned_user_id
         WHERE l.organization_id = $1 AND l.customer_id = $2
         ORDER BY CASE WHEN l.status IN ('open','working','qualified') THEN 0 ELSE 1 END, l.created_at DESC LIMIT 1`,
        [organizationId, customerId],
      )) as { rows: Array<{ id: string; source: string; stage: string; status: "open"|"working"|"qualified"|"sold"|"lost"|"archived"; created_at: Date; assigned_user_name: string | null }> };
      const lead = leadResult.rows[0];
      const vehicleResult = visibility.inventory && lead ? (await client.query(
        `SELECT vi.id, vi.vehicle_id, vi.role, vi.status, vi.priority, v.year, v.make, v.model,
           v.trim, v.exterior_color, v.vin, inventory.id AS inventory_id,
           inventory.location_id AS inventory_location_id, inventory.stock_number,
           inventory.status AS inventory_status, inventory.list_price_cents
         FROM lead_vehicle_interests vi
         JOIN vehicles v ON v.organization_id = vi.organization_id AND v.id = vi.vehicle_id
         LEFT JOIN LATERAL (SELECT id, location_id, stock_number, status, list_price_cents FROM inventory_units i
           WHERE i.organization_id = vi.organization_id AND i.vehicle_id = vi.vehicle_id
             AND ($4::boolean OR i.location_id = ANY($5::text[]))
           ORDER BY CASE i.status WHEN 'available' THEN 0 WHEN 'hold' THEN 1 ELSE 2 END, i.updated_at DESC LIMIT 1) inventory ON true
         WHERE vi.organization_id = $1 AND vi.customer_id = $2 AND vi.lead_id = $3 AND vi.status = 'active'
         ORDER BY CASE vi.role WHEN 'primary' THEN 0 WHEN 'alternative' THEN 1 ELSE 2 END, vi.priority, vi.created_at`,
        [organizationId, customerId, lead.id, allLocations, locationIds],
      )) as { rows: Array<{ id: string; vehicle_id: string; role: "primary" | "alternative" | "trade"; status: string; priority: number; year: number; make: string; model: string; trim: string | null; exterior_color: string | null; vin: string; inventory_id: string | null; inventory_location_id: string | null; stock_number: string | null; inventory_status: string | null; list_price_cents: number | null }> } : { rows: [] };
      const dealResult = visibility.deals && lead ? (await client.query(
        `SELECT id, deal_number, status, purchase_type, agreed_price_cents FROM deals
         WHERE organization_id = $1 AND customer_id = $2 AND lead_id = $3
         ORDER BY updated_at DESC LIMIT 1`,
        [organizationId, customerId, lead.id],
      )) as { rows: Array<{ id: string; deal_number: string; status: "draft" | "working" | "pending-approval" | "approved" | "contracted" | "delivered" | "cancelled"; purchase_type: string | null; agreed_price_cents: number | null }> } : { rows: [] };
      const currentDealForQuote = dealResult.rows[0];
      const quoteResult = visibility.deals && currentDealForQuote ? (await client.query(
        `SELECT id, version, status, purchase_type, currency, total_cents, expires_at FROM deal_quotes
         WHERE organization_id = $1 AND deal_id = $2
         ORDER BY CASE status WHEN 'accepted' THEN 0 WHEN 'presented' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END, version DESC LIMIT 1`,
        [organizationId, currentDealForQuote.id],
      )) as { rows: Array<{ id: string; version: number; status: "draft" | "presented" | "accepted" | "rejected" | "expired"; purchase_type: "cash" | "finance" | "lease"; currency: string; total_cents: number; expires_at: Date | null }> } : { rows: [] };
      const tradeResult = visibility.deals && currentDealForQuote ? (await client.query(
        `SELECT a.id, a.vehicle_id, a.version, a.status, a.allowance_cents, a.payoff_cents, a.equity_cents,
           v.year::text || ' ' || v.make || ' ' || v.model AS vehicle_label
         FROM trade_appraisals a JOIN vehicles v ON v.organization_id=a.organization_id AND v.id=a.vehicle_id
         WHERE a.organization_id=$1 AND a.deal_id=$2
         ORDER BY CASE a.status WHEN 'acquired' THEN 0 WHEN 'accepted' THEN 1 WHEN 'presented' THEN 2 ELSE 3 END, a.version DESC LIMIT 1`,
        [organizationId, currentDealForQuote.id],
      )) as { rows: Array<{ id: string; vehicle_id: string; version: number; status: "draft" | "presented" | "accepted" | "rejected" | "expired" | "acquired"; allowance_cents: number; payoff_cents: number; equity_cents: number; vehicle_label: string }> } : { rows: [] };
      const deliveryResult = visibility.deals && currentDealForQuote ? (await client.query(
        "SELECT id,status,starts_at,ends_at,timezone,completed_at FROM deal_deliveries WHERE organization_id=$1 AND deal_id=$2 LIMIT 1",
        [organizationId, currentDealForQuote.id],
      )) as { rows: Array<{ id: string; status: "scheduled" | "ready" | "completed" | "cancelled"; starts_at: Date; ends_at: Date; timezone: string; completed_at: Date | null }> } : { rows: [] };
      const appointmentResult = visibility.appointments ? (await client.query(
        `SELECT id, type, status, starts_at, timezone FROM appointments
         WHERE organization_id = $1 AND customer_id = $2
         AND (starts_at >= now() OR status='arrived')
         AND status IN ('scheduled','confirmed','arrived')
         ORDER BY CASE WHEN status='arrived' THEN 0 ELSE 1 END, starts_at LIMIT 1`,
        [organizationId, customerId],
      )) as { rows: Array<{ id: string; type: string; status: string; starts_at: Date; timezone: string }> } : { rows: [] };
      const visitResult = visibility.appointments ? (await client.query(
        `SELECT id, location_id, appointment_id, status, purpose, arrived_at, started_at
         FROM showroom_visits WHERE organization_id = $1 AND customer_id = $2
         AND status IN ('checked-in','active')
         AND ($3::boolean OR location_id = ANY($4::text[]))
         ORDER BY arrived_at DESC LIMIT 1`,
        [organizationId, customerId, allLocations, locationIds],
      )) as { rows: Array<{ id: string; location_id: string; appointment_id: string | null; status: "checked-in" | "active"; purpose: string; arrived_at: Date; started_at: Date | null }> } : { rows: [] };
      const taskResult = visibility.tasks ? (await client.query(
        `SELECT task.id,task.title,task.status,task.priority,task.due_at,user_account.display_name AS assigned_user_name
         FROM tasks task LEFT JOIN users user_account ON user_account.id=task.assigned_user_id
         WHERE task.organization_id=$1 AND task.customer_id=$2 AND task.status IN ('open','in-progress')
         AND ($3::boolean OR task.location_id=ANY($4::text[]))
         ORDER BY CASE task.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
          task.due_at NULLS LAST,task.created_at,task.id LIMIT 25`,
        [organizationId, customerId, allLocations, locationIds],
      )) as { rows: Array<{ id:string;title:string;status:"open"|"in-progress";priority:"low"|"normal"|"high"|"urgent";due_at:Date|null;assigned_user_name:string|null }> } : { rows: [] };
      const timelineResult = (await client.query(
        `SELECT * FROM (
          SELECT event.id, 'lead' AS kind, 'Lead ' || replace(event.to_status::text,'-',' ') AS title,
            event.reason AS description,event.to_status::text AS status,event.occurred_at
            FROM lead_status_events event JOIN leads lead ON lead.organization_id=event.organization_id AND lead.id=event.lead_id
            WHERE lead.organization_id=$1 AND lead.customer_id=$2
          UNION ALL SELECT lead.id,'lead','Lead ' || replace(lead.status::text,'-',' '),lead.source,lead.status::text,lead.created_at
            FROM leads lead WHERE lead.organization_id=$1 AND lead.customer_id=$2
            AND NOT EXISTS(SELECT 1 FROM lead_status_events event WHERE event.organization_id=lead.organization_id AND event.lead_id=lead.id)
          UNION ALL SELECT id, 'communication', initcap(direction::text) || ' ' || channel::text, summary, status::text, occurred_at
            FROM communications WHERE organization_id = $1 AND customer_id = $2 AND $3::boolean
          UNION ALL SELECT event.id, 'appointment', appointment.type || ' appointment',
            event.reason, event.to_status::text, event.occurred_at
            FROM appointment_status_events event JOIN appointments appointment
              ON appointment.organization_id=event.organization_id AND appointment.id=event.appointment_id
            WHERE appointment.organization_id=$1 AND appointment.customer_id=$2 AND $4::boolean
          UNION ALL SELECT appointment.id, 'appointment', appointment.type || ' appointment',
            NULL, appointment.status::text, appointment.starts_at
            FROM appointments appointment WHERE appointment.organization_id=$1 AND appointment.customer_id=$2 AND $4::boolean
            AND NOT EXISTS(SELECT 1 FROM appointment_status_events event WHERE event.organization_id=appointment.organization_id AND event.appointment_id=appointment.id)
          UNION ALL SELECT e.id, 'visit', 'Showroom visit ' || replace(e.to_status::text, '-', ' '),
            v.purpose, e.to_status::text, e.occurred_at
            FROM showroom_visit_status_events e
            JOIN showroom_visits v ON v.organization_id=e.organization_id AND v.id=e.visit_id
            WHERE v.organization_id=$1 AND v.customer_id=$2 AND $4::boolean
            AND ($8::boolean OR v.location_id=ANY($9::text[]))
          UNION ALL SELECT event.id, 'task', 'Task ' || replace(event.to_status::text, '-', ' '),
            task.title, event.to_status::text, event.occurred_at
            FROM task_status_events event JOIN tasks task ON task.organization_id=event.organization_id AND task.id=event.task_id
            WHERE task.organization_id = $1 AND task.customer_id = $2 AND $5::boolean
          UNION ALL SELECT task.id, 'task', task.title, NULL, task.status::text, COALESCE(task.due_at,task.created_at)
            FROM tasks task WHERE task.organization_id=$1 AND task.customer_id=$2 AND $5::boolean
            AND NOT EXISTS(SELECT 1 FROM task_status_events event WHERE event.organization_id=task.organization_id AND event.task_id=task.id)
          UNION ALL SELECT vi.id, 'vehicle', initcap(vi.role::text) || ' vehicle',
            v.year::text || ' ' || v.make || ' ' || v.model, vi.status::text, vi.created_at
            FROM lead_vehicle_interests vi JOIN vehicles v ON v.organization_id = vi.organization_id AND v.id = vi.vehicle_id
            WHERE vi.organization_id = $1 AND vi.customer_id = $2 AND $6::boolean
          UNION ALL SELECT e.id, 'deal', 'Deal status changed', d.deal_number, e.to_status::text, e.occurred_at
            FROM deal_status_events e JOIN deals d ON d.organization_id = e.organization_id AND d.id = e.deal_id
            WHERE d.organization_id = $1 AND d.customer_id = $2 AND $7::boolean
          UNION ALL SELECT e.id, 'quote', 'Quote status changed', 'Version ' || q.version::text, e.to_status::text, e.occurred_at
            FROM deal_quote_status_events e JOIN deal_quotes q ON q.organization_id = e.organization_id AND q.id = e.quote_id
            JOIN deals d ON d.organization_id = q.organization_id AND d.id = q.deal_id
            WHERE d.organization_id = $1 AND d.customer_id = $2 AND $7::boolean
          UNION ALL SELECT e.id, 'trade', 'Trade appraisal status changed', 'Version ' || a.version::text, e.to_status::text, e.occurred_at
            FROM trade_appraisal_status_events e JOIN trade_appraisals a ON a.organization_id=e.organization_id AND a.id=e.appraisal_id
            JOIN deals d ON d.organization_id=a.organization_id AND d.id=a.deal_id
            WHERE d.organization_id=$1 AND d.customer_id=$2 AND $7::boolean
          UNION ALL SELECT e.id, 'delivery', 'Delivery status changed', NULL, e.to_status::text, e.occurred_at
            FROM deal_delivery_status_events e JOIN deal_deliveries delivery ON delivery.organization_id=e.organization_id AND delivery.id=e.delivery_id
            JOIN deals d ON d.organization_id=delivery.organization_id AND d.id=delivery.deal_id
            WHERE d.organization_id=$1 AND d.customer_id=$2 AND $7::boolean
         ) events ORDER BY occurred_at DESC, id DESC LIMIT 50`,
        [organizationId, customerId, visibility.communications, visibility.appointments, visibility.tasks, visibility.inventory, visibility.deals, allLocations, locationIds],
      )) as { rows: Array<{ id: string; kind: TimelineKind; title: string; description: string | null; status: string | null; occurred_at: Date }> };
      const appointment = appointmentResult.rows[0];
      const currentVisit = visitResult.rows[0];
      const currentDeal = dealResult.rows[0];
      const currentQuote = quoteResult.rows[0];
      const currentTrade = tradeResult.rows[0]; const currentDelivery = deliveryResult.rows[0];
      return {
        customer: { id: customer.id, ...(customer.location_id ? { locationId: customer.location_id } : {}), displayName: customer.display_name,
          ...(customer.first_name?{firstName:customer.first_name}:{}),...(customer.last_name?{lastName:customer.last_name}:{}),
          ...(customer.email ? { email: customer.email } : {}), ...(customer.phone ? { phone: customer.phone } : {}),
          status: customer.status, createdAt: customer.created_at.toISOString(),updatedAt:customer.updated_at.toISOString() },
        ...(lead ? { lead: { id: lead.id, source: lead.source, stage: lead.stage, status: lead.status,
          ...(lead.assigned_user_name ? { assignedUserName: lead.assigned_user_name } : {}), createdAt: lead.created_at.toISOString() } } : {}),
        ...(appointment ? { nextAppointment: { id: appointment.id, type: appointment.type, status: appointment.status,
          startsAt: appointment.starts_at.toISOString(), timezone: appointment.timezone } } : {}),
        ...(currentVisit ? { currentVisit: { id: currentVisit.id, locationId: currentVisit.location_id,
          status: currentVisit.status, purpose: currentVisit.purpose, arrivedAt: currentVisit.arrived_at.toISOString(),
          ...(currentVisit.started_at ? { startedAt: currentVisit.started_at.toISOString() } : {}),
          ...(currentVisit.appointment_id ? { appointmentId: currentVisit.appointment_id } : {}) } } : {}),
        vehicleInterests: vehicleResult.rows.map((row) => ({ id: row.id, vehicleId: row.vehicle_id, role: row.role,
          status: row.status, priority: row.priority, year: row.year, make: row.make, model: row.model,
          ...(row.trim ? { trim: row.trim } : {}), ...(row.exterior_color ? { exteriorColor: row.exterior_color } : {}),
          vin: row.vin, ...(row.inventory_id ? { inventoryId: row.inventory_id } : {}),
          ...(row.inventory_location_id ? { inventoryLocationId: row.inventory_location_id } : {}),
          ...(row.stock_number ? { stockNumber: row.stock_number } : {}),
          ...(row.inventory_status ? { inventoryStatus: row.inventory_status } : {}),
          ...(row.list_price_cents !== null ? { listPriceCents: row.list_price_cents } : {}) })),
        ...(currentDeal ? { deal: { id: currentDeal.id, dealNumber: currentDeal.deal_number, status: currentDeal.status,
          ...(currentDeal.purchase_type ? { purchaseType: currentDeal.purchase_type } : {}),
          ...(currentDeal.agreed_price_cents !== null ? { agreedPriceCents: currentDeal.agreed_price_cents } : {}) } } : {}),
        ...(currentQuote ? { quote: { id: currentQuote.id, version: currentQuote.version, status: currentQuote.status,
          purchaseType: currentQuote.purchase_type, currency: currentQuote.currency, totalCents: currentQuote.total_cents,
          ...(currentQuote.expires_at ? { expiresAt: currentQuote.expires_at.toISOString() } : {}) } } : {}),
        ...(currentTrade ? { tradeAppraisal: { id: currentTrade.id, vehicleId: currentTrade.vehicle_id, version: currentTrade.version, status: currentTrade.status,
          allowanceCents: currentTrade.allowance_cents, payoffCents: currentTrade.payoff_cents, equityCents: currentTrade.equity_cents,
          vehicleLabel: currentTrade.vehicle_label } } : {}),
        ...(currentDelivery ? { delivery: { id: currentDelivery.id, status: currentDelivery.status,
          startsAt: currentDelivery.starts_at.toISOString(), endsAt: currentDelivery.ends_at.toISOString(), timezone: currentDelivery.timezone,
          ...(currentDelivery.completed_at ? { completedAt: currentDelivery.completed_at.toISOString() } : {}) } } : {}),
        activeTasks: taskResult.rows.map((row)=>({id:row.id,title:row.title,status:row.status,priority:row.priority,...(row.due_at?{dueAt:row.due_at.toISOString()}:{}),...(row.assigned_user_name?{assignedUserName:row.assigned_user_name}:{})})),
        openTaskCount: taskResult.rows.length,
        timeline: timelineResult.rows.map((row) => ({ id: row.id, kind: row.kind, title: row.title,
          ...(row.description ? { description: row.description } : {}), ...(row.status ? { status: row.status } : {}),
          occurredAt: row.occurred_at.toISOString() })),
      };
    });
  }
}
