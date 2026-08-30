import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { WorkspaceTabs } from "@/components/workspaces/WorkspaceTabs";
import { DealDeskingReader, DealDirectoryReader } from "@/lib/server/deals";
import { loadDirectoryContext } from "../_lib/load-directory-context";

export const dynamic = "force-dynamic";

export default async function DealDeskingPage({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  const context = await loadDirectoryContext(organizationId, "deal.read");
  const base = `/organizations/${organizationId}`;
  const [summary, recent] = await Promise.all([
    new DealDeskingReader(context.pool).read({ userId: context.session.user.id, organizationId, locationIds: context.membership.locationIds }),
    new DealDirectoryReader(context.pool).list({ userId: context.session.user.id, organizationId, locationIds: context.membership.locationIds }, { limit: 8 }),
  ]);
  const activeHref = `${base}/desking`;
  const tabs = [{ label: "Overview", href: activeHref }, { label: "Deals", href: `${base}/deals` }, { label: "Desk / Structure" }, { label: "Documents" }, { label: "Funding" }, { label: "Compliance" }];
  return (
    <AppShell organizationId={organizationId} navigationCapabilities={context.membership.capabilities} activeHref={activeHref} breadcrumbs={[{ label: context.organization.name }, { label: "Deal Desking" }]} user={{ name: context.session.user.name, email: context.session.user.email, ...(context.session.user.image ? { image: context.session.user.image } : {}) }}>
      <section aria-labelledby="desking-heading" className="mx-auto max-w-7xl">
        <WorkspaceTabs activeHref={activeHref} label="Deal Desking sections" tabs={tabs} />
        <header className="mt-6 border-b pb-6"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Finance operations</p><h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl" id="desking-heading">Deal Desking</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Verified active Deal state across your authorized dealership locations. Credit, lender, payment, and funding claims are intentionally excluded.</p></header>
        <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric definition="Nonterminal Deals in authorized locations." label="Active Deals" value={summary.active} />
          <Metric definition="Deals currently pending manager approval." label="Needs Approval" value={summary.needsApproval} />
          <Metric definition="Approved or contracted Deals ready for finance workflow." label="Ready for Finance" value={summary.readyForFinance} />
          <Metric definition="Active Deals unchanged for more than seven days." label="Aged Deals" value={summary.aged} />
        </dl>
        <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
          <section aria-labelledby="recent-deals-heading" className="overflow-hidden rounded-xl border bg-card shadow-soft"><div className="border-b p-4 sm:p-5"><h2 className="font-semibold" id="recent-deals-heading">Recent Deals</h2><p className="mt-1 text-sm text-muted-foreground">Most recently updated Deals in scope.</p></div>{recent.records.length ? <ul className="divide-y" role="list">{recent.records.map((deal) => <li key={deal.id}><Link className="focus-ring grid min-h-16 gap-1 p-4 hover:bg-muted/30 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5" href={`${base}/customers/${deal.customerId}`}><span className="min-w-0"><span className="block break-words text-sm font-medium">{deal.customerName}</span><span className="mt-1 block break-words text-xs text-muted-foreground">{deal.dealNumber} · {deal.vehicleLabel}</span></span><span className="text-xs font-medium capitalize text-muted-foreground">{deal.status.replace("-", " ")}</span></Link></li>)}</ul> : <p className="p-6 text-sm text-muted-foreground">No Deals are currently available in your authorized locations.</p>}</section>
          <aside aria-labelledby="pipeline-heading" className="rounded-xl border bg-card p-5 shadow-soft"><h2 className="font-semibold" id="pipeline-heading">Pipeline by Status</h2><ul className="mt-4 space-y-3" role="list">{summary.byStatus.length ? summary.byStatus.map((item) => <li className="flex items-center justify-between gap-3 rounded-lg border p-3" key={item.status}><span className="text-sm capitalize">{item.status.replace("-", " ")}</span><strong className="tabular-nums">{item.count}</strong></li>) : <li className="text-sm text-muted-foreground">No active pipeline stages.</li>}</ul><p className="mt-4 text-xs leading-5 text-muted-foreground">Counts come directly from nonterminal Deal records under tenant and location scope.</p></aside>
        </div>
      </section>
    </AppShell>
  );
}

function Metric({ definition, label, value }: { definition: string; label: string; value: number }) {
  return <div className="rounded-xl border bg-card p-4 shadow-soft"><dt className="text-xs font-medium text-muted-foreground">{label}</dt><dd className="mt-2 text-2xl font-semibold tabular-nums">{value}</dd><p className="mt-2 text-xs leading-5 text-muted-foreground">{definition}</p></div>;
}
