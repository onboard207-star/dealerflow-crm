import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { QuoteApprovalDecisionForm } from "@/components/desking/QuoteApprovalDecisionForm";
import { IncentiveEligibilityDecisionForm } from "@/components/desking/IncentiveEligibilityDecisionForm";
import { WorkspaceTabs } from "@/components/workspaces/WorkspaceTabs";
import {
  DealDeskingReader,
  DealDirectoryReader,
  QuoteApprovalQueueReader,
} from "@/lib/server/deals";
import { loadDirectoryContext } from "../_lib/load-directory-context";

export const dynamic = "force-dynamic";

export default async function DealDeskingPage({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  const context = await loadDirectoryContext(organizationId, "deal.read");
  const base = `/organizations/${organizationId}`;
  const canApproveQuote = context.membership.capabilities.includes("quote.approve");
  const canViewSensitive = context.membership.capabilities.includes("quote.view_sensitive_terms");
  const [summary, recent, approvals] = await Promise.all([
    new DealDeskingReader(context.pool).read({ userId: context.session.user.id, organizationId, locationIds: context.membership.locationIds }),
    new DealDirectoryReader(context.pool).list({ userId: context.session.user.id, organizationId, locationIds: context.membership.locationIds }, { limit: 8 }),
    new QuoteApprovalQueueReader(context.pool).read({
      userId: context.session.user.id,
      organizationId,
      locationIds: context.membership.locationIds,
    }),
  ]);
  const activeHref = `${base}/desking`;
  const tabs = [{ label: "Overview", href: activeHref }, { label: "Deals", href: `${base}/deals` }, { label: "Desk / Structure" }, { label: "Documents" }, { label: "Funding" }, { label: "Compliance" }];
  return (
    <AppShell organizationId={organizationId} navigationCapabilities={context.membership.capabilities} activeHref={activeHref} breadcrumbs={[{ label: context.organization.name }, { label: "Deal Desking" }]} user={{ name: context.session.user.name, email: context.session.user.email, ...(context.session.user.image ? { image: context.session.user.image } : {}) }}>
      <section aria-labelledby="desking-heading" className="mx-auto max-w-7xl">
        <WorkspaceTabs activeHref={activeHref} label="Deal Desking sections" tabs={tabs} />
        <header className="mt-6 border-b pb-6"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Finance operations</p><h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl" id="desking-heading">Deal Desking</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Verified Deal and Quote state across your authorized dealership locations. Manager Quote approvals are separated from Deal approval. Credit, lender, payment, and funding claims remain excluded.</p></header>
        <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric definition="Nonterminal Deals in authorized locations." label="Active Deals" value={summary.active} />
          <Metric definition="Draft Quote versions currently waiting on a manager decision." label="Quote Approvals" value={approvals.pending.length} />
          <Metric definition="Approved or contracted Deals ready for finance workflow." label="Ready for Finance" value={summary.readyForFinance} />
          <Metric definition="Active Deals unchanged for more than seven days." label="Aged Deals" value={summary.aged} />
        </dl>
        <section aria-labelledby="quote-approvals-heading" className="mt-6 overflow-hidden rounded-xl border bg-card shadow-soft">
          <div className="border-b p-4 sm:flex sm:items-start sm:justify-between sm:gap-4 sm:p-5">
            <div>
              <h2 className="font-semibold" id="quote-approvals-heading">Quote Approval Queue</h2>
              <p className="mt-1 text-sm text-muted-foreground">Oldest requests first. Only authorized managers can record a decision.</p>
            </div>
            <span className="mt-3 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold sm:mt-0">
              {approvals.pending.length} pending
            </span>
          </div>
          {approvals.pending.length ? (
            <ul className="divide-y" role="list">
              {approvals.pending.map((item) => (
                <li className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_18rem]" key={item.approvalId}>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link className="focus-ring rounded-sm font-semibold hover:underline" href={`${base}/customers/${item.customerId}`}>
                        {item.customerName}
                      </Link>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize">{item.purchaseType}</span>
                      <span className="text-xs text-muted-foreground">Quote v{item.quoteVersion}</span>
                    </div>
                    <p className="mt-1 break-words text-sm text-muted-foreground">{item.dealNumber} · {item.vehicleLabel}{item.stockNumber ? ` · Stock ${item.stockNumber}` : ""}</p>
                    <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <Financial label="Subtotal" value={item.subtotalCents} />
                      <Financial label="Discount" value={item.discountCents} />
                      <Financial label="Fees + tax" value={item.feeCents + item.taxCents} />
                      <Financial label="Quote total" value={item.totalCents} emphasis />
                      {canViewSensitive ? <Financial label="Backend gross" value={item.backendGrossCents} /> : null}
                    </dl>
                    <div className="mt-4 rounded-lg border bg-muted/20 p-3 text-xs leading-5 text-muted-foreground">
                      <p><strong className="font-semibold text-foreground">Requested by:</strong> {item.requestedByName}</p>
                      <p><strong className="font-semibold text-foreground">Dealership:</strong> {item.locationName}</p>
                      <p><strong className="font-semibold text-foreground">Requested:</strong> {formatDateTime(item.requestedAt)}</p>
                      {item.requestReason ? <p className="mt-1"><strong className="font-semibold text-foreground">Reason:</strong> {item.requestReason}</p> : null}
                    </div>
                  </div>
                  <aside aria-label={`Approval controls for ${item.customerName}`} className="rounded-xl border bg-background p-4">
                    {canApproveQuote ? (
                      <div className="space-y-4">
                        <QuoteApprovalDecisionForm approvalId={item.approvalId} decision="approved" organizationId={organizationId} />
                        <div className="border-t pt-4">
                          <QuoteApprovalDecisionForm approvalId={item.approvalId} decision="declined" organizationId={organizationId} />
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm leading-6 text-muted-foreground">You can review this request, but your current role does not include Quote approval authority.</p>
                    )}
                  </aside>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-6 text-sm text-muted-foreground">No Quote versions are awaiting manager approval in your authorized locations.</p>
          )}
        </section>
        <section className="mt-6 rounded-xl border bg-card shadow-soft" aria-labelledby="incentive-verification-heading">
          <div className="border-b p-4 sm:p-5">
            <h2 className="font-semibold" id="incentive-verification-heading">Incentive Eligibility Verification</h2>
            <p className="mt-1 text-sm text-muted-foreground">Programs attached to Quote discount lines remain pending until a manager records a documented eligibility decision.</p>
          </div>
          {approvals.pendingIncentives.length ? (
            <ul className="divide-y">
              {approvals.pendingIncentives.map((item) => (
                <li className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_18rem]" key={item.applicationId}>
                  <div>
                    <p className="font-semibold">{item.customerName}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.dealNumber} · {item.locationName}</p>
                    <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                      <Fact label="Program" value={`${item.programName} (${item.programCode})`} />
                      <Fact label="Amount" value={formatCurrency(item.amountCents)} />
                      <Fact label="Source" value={item.sourceLabel} />
                      {item.sourceReference ? <Fact label="Reference" value={item.sourceReference} /> : null}
                    </dl>
                  </div>
                  <aside className="space-y-4 rounded-xl border bg-background p-4">
                    {canApproveQuote ? <>
                      <IncentiveEligibilityDecisionForm organizationId={organizationId} applicationId={item.applicationId} decision="verified" />
                      <div className="border-t pt-4"><IncentiveEligibilityDecisionForm organizationId={organizationId} applicationId={item.applicationId} decision="ineligible" /></div>
                    </> : <p className="text-sm text-muted-foreground">Your role can review this program but cannot record eligibility.</p>}
                  </aside>
                </li>
              ))}
            </ul>
          ) : <p className="p-6 text-sm text-muted-foreground">No incentive eligibility decisions are waiting.</p>}
        </section>
        <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
          <section aria-labelledby="recent-deals-heading" className="overflow-hidden rounded-xl border bg-card shadow-soft"><div className="border-b p-4 sm:p-5"><h2 className="font-semibold" id="recent-deals-heading">Recent Deals</h2><p className="mt-1 text-sm text-muted-foreground">Most recently updated Deals in scope.</p></div>{recent.records.length ? <ul className="divide-y" role="list">{recent.records.map((deal) => <li key={deal.id}><Link className="focus-ring grid min-h-16 gap-1 p-4 hover:bg-muted/30 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5" href={`${base}/customers/${deal.customerId}`}><span className="min-w-0"><span className="block break-words text-sm font-medium">{deal.customerName}</span><span className="mt-1 block break-words text-xs text-muted-foreground">{deal.dealNumber} · {deal.vehicleLabel}</span></span><span className="text-xs font-medium capitalize text-muted-foreground">{deal.status.replace("-", " ")}</span></Link></li>)}</ul> : <p className="p-6 text-sm text-muted-foreground">No Deals are currently available in your authorized locations.</p>}</section>
          <aside aria-labelledby="pipeline-heading" className="rounded-xl border bg-card p-5 shadow-soft"><h2 className="font-semibold" id="pipeline-heading">Pipeline by Status</h2><ul className="mt-4 space-y-3" role="list">{summary.byStatus.length ? summary.byStatus.map((item) => <li className="flex items-center justify-between gap-3 rounded-lg border p-3" key={item.status}><span className="text-sm capitalize">{item.status.replace("-", " ")}</span><strong className="tabular-nums">{item.count}</strong></li>) : <li className="text-sm text-muted-foreground">No active pipeline stages.</li>}</ul><p className="mt-4 text-xs leading-5 text-muted-foreground">Counts come directly from nonterminal Deal records under tenant and location scope.</p></aside>
        </div>
        <section aria-labelledby="recent-decisions-heading" className="mt-6 rounded-xl border bg-card p-5 shadow-soft">
          <h2 className="font-semibold" id="recent-decisions-heading">Recent Quote Decisions</h2>
          <p className="mt-1 text-sm text-muted-foreground">A scoped audit-oriented view of recent manager decisions.</p>
          {approvals.recentDecisions.length ? (
            <ul className="mt-4 divide-y rounded-lg border" role="list">
              {approvals.recentDecisions.map((item) => (
                <li className="grid gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" key={item.approvalId}>
                  <span className="min-w-0 text-sm">
                    <span className="font-medium">{item.customerName}</span>
                    <span className="text-muted-foreground"> · {item.dealNumber} · Quote v{item.quoteVersion}</span>
                    {item.decisionReason ? <span className="mt-1 block text-xs text-muted-foreground">{item.decisionReason}</span> : null}
                  </span>
                  <span className="text-left text-xs sm:text-right">
                    <span className="block font-semibold capitalize">{item.status}</span>
                    <span className="block text-muted-foreground">{formatCurrency(item.totalCents)} · {formatDateTime(item.decidedAt)}</span>
                    {item.decidedByName ? <span className="block text-muted-foreground">by {item.decidedByName}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-4 text-sm text-muted-foreground">No manager Quote decisions are available yet.</p>}
        </section>
      </section>
    </AppShell>
  );
}

function Metric({ definition, label, value }: { definition: string; label: string; value: number }) {
  return <div className="rounded-xl border bg-card p-4 shadow-soft"><dt className="text-xs font-medium text-muted-foreground">{label}</dt><dd className="mt-2 text-2xl font-semibold tabular-nums">{value}</dd><p className="mt-2 text-xs leading-5 text-muted-foreground">{definition}</p></div>;
}

function Financial({ label, value, emphasis = false }: { label: string; value: number; emphasis?: boolean }) {
  return <div><dt className="text-xs font-medium text-muted-foreground">{label}</dt><dd className={`mt-1 tabular-nums ${emphasis ? "text-lg font-semibold" : "text-sm font-medium"}`}>{formatCurrency(value)}</dd></div>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-sm font-medium">{value}</dd></div>;
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
