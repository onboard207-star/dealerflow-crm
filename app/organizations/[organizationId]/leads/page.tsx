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
  const intakeCapabilities = ["lead.create", "lead.read", "customer.read", "task.create", "inventory.read"] as const;
  const canCreateLead = intakeCapabilities.every((capability) =>
    context.membership.capabilities.includes(capability),
  );
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
      {canCreateLead ? <LeadIntakeForm assignedUserId={context.session.user.id} organizationId={organizationId} locations={locations} /> : null}
      <DirectoryFilters action={base} query={filters.q} status={filters.status} />
      <div className="mt-5 overflow-hidden rounded-xl border bg-card shadow-soft">
        {page.records.length ? <ul className="divide-y" role="list">{page.records.map((lead) => <li className="p-4 sm:p-5" key={lead.id}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0"><Link href={`/organizations/${organizationId}/customers/${lead.customerId}`} className="focus-ring rounded-sm text-sm font-semibold hover:underline">{lead.customerName}</Link><p className="mt-1 truncate text-xs text-muted-foreground">{lead.customerEmail ?? lead.customerPhone ?? "No contact method"}</p></div>
            <dl className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"><QueueFact label="Source" value={lead.source} /><QueueFact label="Vehicle" value={lead.vehicleLabel ?? "Unresolved / not supplied"} /><QueueFact label="Received" value={formatDate(lead.receivedAt ?? lead.createdAt)} /><QueueFact label="Owner" value={lead.assignedUserName ?? "Unassigned"} /><QueueFact label="Next task" value={lead.nextTaskTitle ? `${lead.nextTaskTitle}${lead.nextTaskDueAt ? ` · ${formatDate(lead.nextTaskDueAt)}` : ""}` : "None"} /><QueueFact label="Communication" value={lead.communicationStatus ?? "Not sent"} /><QueueFact label="Appointment" value={lead.nextAppointmentAt ? formatDate(lead.nextAppointmentAt) : "None"} /><QueueFact label="Stage" value={lead.stage} /></dl>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 border-t pt-4"><Action href={`/organizations/${organizationId}/customers/${lead.customerId}`} label="View customer" />{lead.inventoryUnitId ? <Action href={`/organizations/${organizationId}/inventory/${lead.inventoryUnitId}`} label="View vehicle" /> : null}<Action href={`/organizations/${organizationId}/customers/${lead.customerId}#communications`} label="Contact" /><Action href={`/organizations/${organizationId}/customers/${lead.customerId}#appointments`} label="Schedule appointment" /><Action href={`/organizations/${organizationId}/customers/${lead.customerId}#deal`} label="Create / continue deal" /></div>
        </li>)}</ul> : <Empty message="No leads match these filters." />}
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
function QueueFact({ label, value }: { label: string; value: string }) { return <div><dt className="text-[11px] font-medium text-muted-foreground">{label}</dt><dd className="mt-0.5 truncate text-sm capitalize">{value}</dd></div>; }
function Action({ href, label }: { href: string; label: string }) { return <Link className="focus-ring inline-flex min-h-10 items-center rounded-lg border bg-background px-3 text-xs font-medium hover:bg-muted" href={href}>{label}</Link>; }
function Empty({ message }: { message: string }) { return <div className="p-8 text-center text-sm text-muted-foreground">{message}</div>; }
function formatDate(value: string) { return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
