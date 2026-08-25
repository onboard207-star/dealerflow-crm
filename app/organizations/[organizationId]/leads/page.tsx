import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { LeadIntakeForm } from "@/components/leads/LeadIntakeForm";
import { CRMDirectoryReader } from "@/lib/server/crm";
import { LocationDirectoryReader } from "@/lib/server/organizations/location-directory";
import { loadDirectoryContext } from "../_lib/load-directory-context";

export const dynamic = "force-dynamic";
interface PageProps { params: Promise<{ organizationId: string }>; searchParams: Promise<{ q?: string; status?: string; cursor?: string }> }

export default async function LeadQueuePage({ params, searchParams }: PageProps) {
  const { organizationId } = await params; const filters = await searchParams;
  const context = await loadDirectoryContext(organizationId, "lead.read");
  const page = await new CRMDirectoryReader(context.pool).listLeads({
    userId: context.session.user.id, organizationId, locationIds: context.membership.locationIds,
  }, { search: filters.q, status: filters.status, cursor: filters.cursor, limit: 25 });
  const canCreateLead = context.membership.capabilities.includes("lead.create");
  const locations = canCreateLead ? await new LocationDirectoryReader(context.pool).listActive({
    userId: context.session.user.id, organizationId, locationIds: context.membership.locationIds,
  }) : [];
  const base = `/organizations/${organizationId}/leads`;
  return <AppShell organizationId={organizationId} navigationCapabilities={context.membership.capabilities} activeHref={base}
    breadcrumbs={[{ label: context.organization.name }, { label: "Leads" }]}
    user={{ name: context.session.user.name, email: context.session.user.email, ...(context.session.user.image ? { image: context.session.user.image } : {}) }}>
    <section className="mx-auto max-w-7xl" aria-labelledby="lead-queue-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 id="lead-queue-heading" className="text-2xl font-semibold tracking-tight">Lead Queue</h1><p className="mt-1 text-sm text-muted-foreground">Active opportunities within your assigned locations.</p></div>
        <Link className="focus-ring inline-flex min-h-11 items-center justify-center rounded-lg border bg-background px-4 text-sm font-medium hover:bg-muted" href={`/organizations/${organizationId}/customers`}>Find customers</Link></div>
      {canCreateLead ? <LeadIntakeForm organizationId={organizationId} locations={locations} /> : null}
      <DirectoryFilters action={base} query={filters.q} status={filters.status} />
      <div className="mt-5 overflow-hidden rounded-xl border bg-card shadow-soft">
        {page.records.length ? <ul className="divide-y" role="list">{page.records.map((lead) => <li key={lead.id}>
          <Link href={`/organizations/${organizationId}/customers/${lead.customerId}`} className="focus-ring grid gap-3 p-4 hover:bg-muted/40 sm:grid-cols-[minmax(12rem,2fr)_repeat(4,minmax(7rem,1fr))] sm:items-center sm:p-5">
            <span className="min-w-0"><span className="block truncate text-sm font-medium">{lead.customerName}</span><span className="block truncate text-xs text-muted-foreground">{lead.customerEmail ?? lead.customerPhone ?? "No contact method"}</span></span>
            <QueueFact label="Stage" value={lead.stage} /><QueueFact label="Owner" value={lead.assignedUserName ?? "Unassigned"} />
            <QueueFact label="Next appointment" value={lead.nextAppointmentAt ? formatDate(lead.nextAppointmentAt) : "None"} />
            <QueueFact label="Tasks" value={String(lead.openTaskCount)} />
          </Link></li>)}</ul> : <Empty message="No leads match these filters." />}
      </div>
      {page.nextCursor ? <Link className="focus-ring mt-4 inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium hover:bg-muted" href={`${base}?${new URLSearchParams({ ...(filters.q ? { q: filters.q } : {}), ...(filters.status ? { status: filters.status } : {}), cursor: page.nextCursor }).toString()}`}>Next page</Link> : null}
    </section>
  </AppShell>;
}

function DirectoryFilters({ action, query, status }: { action: string; query?: string; status?: string }) {
  return <form action={action} className="mt-5 grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_12rem_auto]">
    <label className="space-y-1 text-xs font-medium text-muted-foreground">Customer search<input name="q" defaultValue={query} maxLength={100} placeholder="Name, email, or phone" className="focus-ring block h-10 w-full rounded-lg border bg-background px-3 text-sm text-foreground" /></label>
    <label className="space-y-1 text-xs font-medium text-muted-foreground">Status<select name="status" defaultValue={status ?? ""} className="focus-ring block h-10 w-full rounded-lg border bg-background px-3 text-sm text-foreground"><option value="">All statuses</option><option value="open">Open</option><option value="working">Working</option><option value="qualified">Qualified</option><option value="sold">Sold</option><option value="lost">Lost</option></select></label>
    <button className="focus-ring h-10 self-end rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">Apply</button></form>;
}
function QueueFact({ label, value }: { label: string; value: string }) { return <span><span className="block text-[11px] text-muted-foreground sm:sr-only">{label}</span><span className="block truncate text-sm capitalize">{value}</span></span>; }
function Empty({ message }: { message: string }) { return <div className="p-8 text-center text-sm text-muted-foreground">{message}</div>; }
function formatDate(value: string) { return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
