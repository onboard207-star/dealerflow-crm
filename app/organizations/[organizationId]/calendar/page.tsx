import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { AppointmentCalendarReader, type CalendarAppointment } from "@/lib/server/appointments";
import { loadDirectoryContext } from "../_lib/load-directory-context";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ date?: string; status?: string }>;
}

export default async function CalendarPage({ params, searchParams }: PageProps) {
  const { organizationId } = await params;
  const query = await searchParams;
  const selectedDate = validDate(query.date) ? query.date! : isoDate(new Date());
  const endDate = shiftDate(selectedDate, 6);
  const selectedStatus = validStatus(query.status) ? query.status : undefined;
  const context = await loadDirectoryContext(organizationId, "appointment.read");
  const appointments = await new AppointmentCalendarReader(context.pool).list(
    { userId: context.session.user.id, organizationId, locationIds: context.membership.locationIds },
    { from: selectedDate, to: endDate, ...(selectedStatus ? { status: selectedStatus } : {}) },
  );
  const base = `/organizations/${organizationId}/calendar`;
  const days = Array.from({ length: 7 }, (_, index) => shiftDate(selectedDate, index));

  return <AppShell organizationId={organizationId} navigationCapabilities={context.membership.capabilities} activeHref={base} breadcrumbs={[{ label: context.organization.name }, { label: "Calendar" }]} user={{ name: context.session.user.name, email: context.session.user.email, ...(context.session.user.image ? { image: context.session.user.image } : {}) }}>
    <section aria-labelledby="calendar-heading" className="mx-auto max-w-7xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><h1 className="text-2xl font-semibold tracking-tight" id="calendar-heading">Appointment Calendar</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">A location-scoped operating view of customer appointments. Open a customer to schedule or update an appointment.</p></div>
        <form action={base} className="grid gap-3 rounded-xl border bg-card p-3 sm:grid-cols-[10rem_11rem_auto] sm:items-end">
          <label className="text-xs font-medium text-muted-foreground">Week starting<input className="focus-ring mt-1 block h-11 w-full rounded-lg border bg-background px-3 text-sm text-foreground" defaultValue={selectedDate} name="date" type="date" /></label>
          <label className="text-xs font-medium text-muted-foreground">Status<select className="focus-ring mt-1 block h-11 w-full rounded-lg border bg-background px-3 text-sm text-foreground" defaultValue={selectedStatus ?? ""} name="status"><option value="">All statuses</option>{["scheduled", "confirmed", "arrived", "completed", "cancelled", "no-show"].map((status) => <option key={status} value={status}>{label(status)}</option>)}</select></label>
          <button className="focus-ring min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">Apply</button>
        </form>
      </div>
      <nav aria-label="Calendar range" className="mt-4 flex flex-wrap items-center gap-2"><Link className="focus-ring min-h-11 rounded-lg border bg-background px-4 py-2.5 text-sm font-medium hover:bg-muted" href={`${base}?date=${shiftDate(selectedDate, -7)}`}>Previous week</Link><Link className="focus-ring min-h-11 rounded-lg border bg-background px-4 py-2.5 text-sm font-medium hover:bg-muted" href={base}>This week</Link><Link className="focus-ring min-h-11 rounded-lg border bg-background px-4 py-2.5 text-sm font-medium hover:bg-muted" href={`${base}?date=${shiftDate(selectedDate, 7)}`}>Next week</Link></nav>
      <div className="mt-6 grid gap-4 lg:grid-cols-7">
        {days.map((day) => <Day key={day} day={day} organizationId={organizationId} appointments={appointments.filter((appointment) => appointment.localDate === day)} />)}
      </div>
      {!appointments.length ? <p className="mt-6 rounded-xl border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">No appointments match this week and status. Appointments are scheduled from the Customer Workspace.</p> : null}
    </section>
  </AppShell>;
}

function Day({ day, appointments, organizationId }: { day: string; appointments: readonly CalendarAppointment[]; organizationId: string }) {
  const date = new Date(`${day}T12:00:00Z`);
  return <section aria-labelledby={`day-${day}`} className="min-w-0 rounded-xl border bg-card shadow-soft lg:min-h-72">
    <header className="border-b p-3"><h2 className="text-sm font-semibold" id={`day-${day}`}>{new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(date)}</h2><p className="text-xs text-muted-foreground">{appointments.length} {appointments.length === 1 ? "appointment" : "appointments"}</p></header>
    {appointments.length ? <ul className="divide-y" role="list">{appointments.map((appointment) => <li key={appointment.id}><Link className="focus-ring block min-h-11 p-3 hover:bg-muted/40" href={`/organizations/${organizationId}/customers/${appointment.customerId}`}><span className="block text-xs font-semibold text-primary">{time(appointment.startsAt, appointment.timezone)}</span><span className="mt-1 block break-words text-sm font-medium">{appointment.customerName}</span><span className="mt-1 block break-words text-xs text-muted-foreground">{appointment.type} · {label(appointment.status)}</span><span className="mt-1 block break-words text-xs text-muted-foreground">{appointment.locationName ?? "Location not assigned"}{appointment.assignedUserName ? ` · ${appointment.assignedUserName}` : " · Unassigned"}</span></Link></li>)}</ul> : <p className="p-3 text-xs text-muted-foreground">No scheduled customer time.</p>}
  </section>;
}

function validDate(value: string | undefined): boolean { if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; return isoDate(new Date(`${value}T00:00:00Z`)) === value; }
function validStatus(value: string | undefined): value is "scheduled" | "confirmed" | "arrived" | "completed" | "cancelled" | "no-show" { return Boolean(value && ["scheduled", "confirmed", "arrived", "completed", "cancelled", "no-show"].includes(value)); }
function isoDate(value: Date): string { return value.toISOString().slice(0, 10); }
function shiftDate(value: string, days: number): string { const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return isoDate(date); }
function time(value: string, timezone: string): string { return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: timezone }).format(new Date(value)); }
function label(value: string): string { return value.replaceAll("-", " ").replace(/\b\w/g, (character) => character.toUpperCase()); }
