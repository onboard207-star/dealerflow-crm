import { withTenantDatabaseContext, type DatabasePool } from "@/lib/server/database";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const supportedStatuses = ["scheduled", "confirmed", "arrived", "completed", "cancelled", "no-show"] as const;

export type CalendarAppointmentStatus = (typeof supportedStatuses)[number];

export interface CalendarAppointment {
  id: string;
  locationId?: string;
  locationName?: string;
  customerId: string;
  customerName: string;
  assignedUserName?: string;
  type: string;
  status: CalendarAppointmentStatus;
  startsAt: string;
  endsAt: string;
  timezone: string;
  localDate: string;
}

export class CalendarQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalendarQueryError";
  }
}

export class AppointmentCalendarReader {
  constructor(private readonly pool: DatabasePool) {}

  list(
    context: { userId: string; organizationId: string; locationIds: readonly string[] | "all" },
    query: { from: string; to: string; status?: string },
  ): Promise<readonly CalendarAppointment[]> {
    const range = validateRange(query.from, query.to);
    if (query.status && !supportedStatuses.includes(query.status as CalendarAppointmentStatus)) {
      throw new CalendarQueryError("Appointment status is invalid.");
    }

    return withTenantDatabaseContext(this.pool, context, async (client) => {
      const allLocations = context.locationIds === "all";
      const locationIds = allLocations ? [] : [...context.locationIds];
      const result = await client.query(
        `SELECT appointment.id, appointment.location_id, location.name location_name,
          appointment.customer_id, customer.display_name customer_name,
          assigned.display_name assigned_user_name, appointment.type, appointment.status,
          appointment.starts_at, appointment.ends_at, appointment.timezone,
          to_char(appointment.starts_at AT TIME ZONE appointment.timezone, 'YYYY-MM-DD') local_date
        FROM appointments appointment
        JOIN customers customer ON customer.organization_id=appointment.organization_id AND customer.id=appointment.customer_id
        LEFT JOIN locations location ON location.organization_id=appointment.organization_id AND location.id=appointment.location_id
        LEFT JOIN users assigned ON assigned.id=appointment.assigned_user_id
        WHERE appointment.organization_id=$1
          AND ($2::boolean OR appointment.location_id=ANY($3::text[]))
          AND (appointment.starts_at AT TIME ZONE appointment.timezone)::date BETWEEN $4::date AND $5::date
          AND ($6::text IS NULL OR appointment.status::text=$6)
        ORDER BY appointment.starts_at, appointment.id`,
        [context.organizationId, allLocations, locationIds, range.from, range.to, query.status ?? null],
      ) as { rows: Array<{ id: string; location_id: string | null; location_name: string | null; customer_id: string; customer_name: string; assigned_user_name: string | null; type: string; status: CalendarAppointmentStatus; starts_at: Date; ends_at: Date; timezone: string; local_date: string }> };

      return result.rows.map((row) => ({
        id: row.id,
        ...(row.location_id ? { locationId: row.location_id } : {}),
        ...(row.location_name ? { locationName: row.location_name } : {}),
        customerId: row.customer_id,
        customerName: row.customer_name,
        ...(row.assigned_user_name ? { assignedUserName: row.assigned_user_name } : {}),
        type: row.type,
        status: row.status,
        startsAt: row.starts_at.toISOString(),
        endsAt: row.ends_at.toISOString(),
        timezone: row.timezone,
        localDate: row.local_date,
      }));
    });
  }
}

function validateRange(from: string, to: string): { from: string; to: string } {
  if (!datePattern.test(from) || !datePattern.test(to)) throw new CalendarQueryError("A valid calendar date range is required.");
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  if (start.toISOString().slice(0, 10) !== from || end.toISOString().slice(0, 10) !== to || end < start) throw new CalendarQueryError("A valid calendar date range is required.");
  const days = Math.round((end.valueOf() - start.valueOf()) / 86_400_000) + 1;
  if (days > 31) throw new CalendarQueryError("Calendar ranges cannot exceed 31 days.");
  return { from, to };
}
