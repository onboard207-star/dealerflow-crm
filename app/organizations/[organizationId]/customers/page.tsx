import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { CRMDirectoryReader } from "@/lib/server/crm";
import { loadDirectoryContext } from "../_lib/load-directory-context";

export const dynamic = "force-dynamic";
interface PageProps { params: Promise<{ organizationId: string }>; searchParams: Promise<{ q?: string; cursor?: string }> }

export default async function CustomerDirectoryPage({ params, searchParams }: PageProps) {
  const { organizationId } = await params; const filters = await searchParams;
  const context = await loadDirectoryContext(organizationId, "customer.read");
  const page = await new CRMDirectoryReader(context.pool).listCustomers({
    userId: context.session.user.id, organizationId, locationIds: context.membership.locationIds,
  }, { search: filters.q, cursor: filters.cursor, limit: 25 });
  const base = `/organizations/${organizationId}/customers`;
  return <AppShell organizationId={organizationId} navigationCapabilities={context.membership.capabilities} activeHref={base}
    breadcrumbs={[{ label: context.organization.name }, { label: "Customers" }]}
    user={{ name: context.session.user.name, email: context.session.user.email, ...(context.session.user.image ? { image: context.session.user.image } : {}) }}>
    <section className="mx-auto max-w-7xl" aria-labelledby="customer-directory-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 id="customer-directory-heading" className="text-2xl font-semibold tracking-tight">Customers</h1><p className="mt-1 text-sm text-muted-foreground">Search customer records available to your locations.</p></div>
        <Link className="focus-ring inline-flex h-10 items-center justify-center rounded-lg border bg-background px-4 text-sm font-medium hover:bg-muted" href={`/organizations/${organizationId}/leads`}>Open lead queue</Link></div>
      <form action={base} className="mt-5 flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-end">
        <label className="flex-1 space-y-1 text-xs font-medium text-muted-foreground">Customer search<input name="q" defaultValue={filters.q} maxLength={100} placeholder="Name, email, or phone" className="focus-ring block h-10 w-full rounded-lg border bg-background px-3 text-sm text-foreground" /></label>
        <button className="focus-ring h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">Search</button>
      </form>
      <div className="mt-5 overflow-hidden rounded-xl border bg-card shadow-soft">
        {page.records.length ? <ul className="divide-y" role="list">{page.records.map((customer) => <li key={customer.id}>
          <Link href={`${base}/${customer.id}`} className="focus-ring grid gap-3 p-4 hover:bg-muted/40 sm:grid-cols-[minmax(12rem,2fr)_repeat(3,minmax(8rem,1fr))] sm:items-center sm:p-5">
            <span className="min-w-0"><span className="block truncate text-sm font-medium">{customer.displayName}</span><span className="block truncate text-xs text-muted-foreground">{customer.email ?? customer.phone ?? "No contact method"}</span></span>
            <Fact label="Customer status" value={customer.status} /><Fact label="Lead stage" value={customer.activeLead?.stage ?? "No active lead"} /><Fact label="Location" value={customer.locationName ?? "Shared"} />
          </Link></li>)}</ul> : <div className="p-8 text-center text-sm text-muted-foreground">No customers match this search.</div>}
      </div>
      {page.nextCursor ? <Link className="focus-ring mt-4 inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium hover:bg-muted" href={`${base}?${new URLSearchParams({ ...(filters.q ? { q: filters.q } : {}), cursor: page.nextCursor }).toString()}`}>Next page</Link> : null}
    </section>
  </AppShell>;
}

function Fact({ label, value }: { label: string; value: string }) { return <span><span className="block text-[11px] text-muted-foreground sm:sr-only">{label}</span><span className="block truncate text-sm capitalize">{value}</span></span>; }
