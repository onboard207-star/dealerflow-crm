import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { DealQuoteWorkspaceReader } from "@/lib/server/deals";
import { loadDirectoryContext } from "../../../_lib/load-directory-context";
import {
  createQuoteVersionAction,
  attachQuoteTermsAction,
  attachQuoteLeaseTermsAction,
  attachIncentiveProgramAction,
  attachBackendProductCostAction,
  captureQuoteProfitabilityAction,
  presentQuoteAction,
  requestQuoteApprovalAction,
} from "./actions";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ organizationId: string; dealId: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}

export default async function DealQuoteWorkspacePage({ params, searchParams }: Props) {
  const { organizationId, dealId } = await params;
  const feedback = await searchParams;
  const context = await loadDirectoryContext(organizationId, "deal.read");
  const workspace = await new DealQuoteWorkspaceReader(context.pool).read(
    {
      userId: context.session.user.id,
      organizationId,
      locationIds: context.membership.locationIds,
    },
    dealId,
  );
  if (!workspace) notFound();

  const canCreate = context.membership.capabilities.includes("quote.create");
  const canRequest = context.membership.capabilities.includes("quote.request_approval");
  const canIssue = context.membership.capabilities.includes("quote.issue");
  const canViewSensitive = context.membership.capabilities.includes("quote.view_sensitive_terms");
  const base = `/organizations/${organizationId}`;
  const latest = workspace.quotes[0];
  const closed = ["contracted", "delivered", "cancelled"].includes(workspace.deal.status);

  return (
    <AppShell
      organizationId={organizationId}
      navigationCapabilities={context.membership.capabilities}
      activeHref={`${base}/deals`}
      breadcrumbs={[
        { label: context.organization.name },
        { label: "Deals" },
        { label: workspace.deal.dealNumber },
        { label: "Quotes" },
      ]}
      user={{
        name: context.session.user.name,
        email: context.session.user.email,
        ...(context.session.user.image ? { image: context.session.user.image } : {}),
      }}
    >
      <section className="mx-auto max-w-7xl" aria-labelledby="quote-workspace-heading">
        <header className="border-b pb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Deal Quote workspace
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl" id="quote-workspace-heading">
                {workspace.deal.customerName}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {workspace.deal.dealNumber} · {workspace.deal.vehicleLabel}
                {workspace.deal.stockNumber ? ` · Stock ${workspace.deal.stockNumber}` : ""}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">VIN {workspace.deal.vin}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                className="focus-ring inline-flex min-h-10 items-center justify-center rounded-lg border px-3 text-sm font-medium hover:bg-muted"
                href={`${base}/customers/${workspace.deal.customerId}`}
              >
                Customer workspace
              </Link>
              <Link
                className="focus-ring inline-flex min-h-10 items-center justify-center rounded-lg border px-3 text-sm font-medium hover:bg-muted"
                href={`${base}/deals`}
              >
                All Deals
              </Link>
            </div>
          </div>
        </header>

        {feedback.notice ? (
          <p className="mt-4 rounded-lg border bg-muted p-3 text-sm" role="status">
            {feedback.notice}
          </p>
        ) : null}
        {feedback.error ? (
          <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
            {feedback.error}
          </p>
        ) : null}

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(22rem,0.8fr)]">
          <section aria-labelledby="quote-versions-heading" className="min-w-0">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="font-semibold" id="quote-versions-heading">Quote versions</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Every pricing revision creates a new immutable version.
                </p>
              </div>
              <span className="text-xs text-muted-foreground">
                {workspace.quotes.length} version{workspace.quotes.length === 1 ? "" : "s"}
              </span>
            </div>

            {workspace.quotes.length ? (
              <ul className="mt-4 space-y-4" role="list">
                {workspace.quotes.map((quote) => (
                  <li className="rounded-xl border bg-card p-4 shadow-soft sm:p-5" key={quote.id}>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">Quote v{quote.version}</h3>
                          <Status value={quote.status} />
                          {quote.approval ? <ApprovalStatus value={quote.approval.status} /> : null}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {quote.purchaseType} · created {formatDateTime(quote.createdAt)}
                        </p>
                      </div>
                      <strong className="text-xl tabular-nums">{money(quote.totalCents)}</strong>
                    </div>

                    <dl className="mt-4 grid gap-3 sm:grid-cols-4">
                      <Fact label="Subtotal" value={money(quote.subtotalCents)} />
                      <Fact label="Discount" value={money(quote.discountCents)} />
                      <Fact label="Fees + tax" value={money(quote.feeCents + quote.taxCents)} />
                      <Fact label="Total" value={money(quote.totalCents)} />
                    </dl>

                    {quote.approval ? (
                      <div className="mt-4 rounded-lg border bg-muted/20 p-3 text-xs leading-5 text-muted-foreground">
                        <p>
                          <strong className="text-foreground">Manager approval:</strong>{" "}
                          <span className="capitalize">{quote.approval.status}</span>
                        </p>
                        {quote.approval.requestReason ? <p>Request: {quote.approval.requestReason}</p> : null}
                        {quote.approval.decisionReason ? <p>Decision: {quote.approval.decisionReason}</p> : null}
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:flex-wrap sm:items-start">
                      <Link
                        className="focus-ring inline-flex min-h-10 items-center justify-center rounded-lg border px-3 text-sm font-medium hover:bg-muted"
                        href={`${base}/quotes/${quote.id}/print`}
                        target="_blank"
                      >
                        Preview proposal
                      </Link>

                      {quote.status === "draft" && !quote.approval && canRequest ? (
                        <form
                          action={requestQuoteApprovalAction.bind(null, organizationId, dealId, quote.id)}
                          className="flex min-w-0 flex-1 flex-col gap-2 sm:min-w-72"
                        >
                          <input
                            className="focus-ring h-10 rounded-lg border bg-background px-3 text-sm"
                            maxLength={1000}
                            name="reason"
                            placeholder="Manager note (optional)"
                          />
                          <button className="focus-ring min-h-10 rounded-lg border px-3 text-sm font-medium hover:bg-muted">
                            Request manager approval
                          </button>
                        </form>
                      ) : null}

                      {quote.status === "draft" &&
                      canIssue &&
                      quote.approval?.status !== "pending" &&
                      quote.approval?.status !== "declined" ? (
                        <form action={presentQuoteAction.bind(null, organizationId, dealId, quote.id)}>
                          <button className="focus-ring min-h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90">
                            Present Quote
                          </button>
                        </form>
                      ) : null}
                    </div>

                    {quote.status === "draft" && !quote.commercialTerms && context.membership.capabilities.includes("quote.revise") ? (
                      <details className="mt-4 border-t pt-4">
                        <summary className="focus-ring cursor-pointer rounded-sm text-sm font-semibold">
                          Add trade / down payment / finance terms
                        </summary>
                        <form
                          action={attachQuoteTermsAction.bind(null, organizationId, dealId, quote.id)}
                          className="mt-4 grid gap-4 sm:grid-cols-2"
                        >
                          <Field label="Accepted trade appraisal">
                            <select className="focus-ring h-10 w-full rounded-lg border bg-background px-3 text-sm" name="tradeAppraisalId" defaultValue="">
                              <option value="">No accepted trade</option>
                              {workspace.acceptedTrades.map((trade) => (
                                <option key={trade.id} value={trade.id}>
                                  {trade.vehicleLabel} · allowance {money(trade.allowanceCents)} · payoff {money(trade.payoffCents)} · equity {money(trade.equityCents)}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <MoneyField label="Cash down" name="cashDown" />
                          {quote.purchaseType === "finance" ? (
                            <>
                              <Field label="APR">
                                <div className="flex items-center rounded-lg border bg-background focus-within:ring-2 focus-within:ring-ring">
                                  <input className="h-10 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none" inputMode="decimal" name="apr" placeholder="5.99" />
                                  <span className="pr-3 text-sm text-muted-foreground">%</span>
                                </div>
                              </Field>
                              <Field label="Term">
                                <select className="focus-ring h-10 w-full rounded-lg border bg-background px-3 text-sm" name="termMonths" defaultValue="">
                                  <option value="">Choose term</option>
                                  {[24,36,48,60,72,84].map((term) => <option key={term} value={term}>{term} months</option>)}
                                </select>
                              </Field>
                              <Field label="Rate source type">
                                <select className="focus-ring h-10 w-full rounded-lg border bg-background px-3 text-sm" name="sourceType" defaultValue="">
                                  <option value="">Choose source</option>
                                  <option value="manual-entry">Manual entry</option>
                                  <option value="lender-quote">Lender quote</option>
                                  <option value="oem-program">OEM program</option>
                                  <option value="dealer-program">Dealer program</option>
                                </select>
                              </Field>
                              <Field label="Rate source">
                                <input className="focus-ring h-10 w-full rounded-lg border bg-background px-3 text-sm" maxLength={200} name="sourceLabel" placeholder="e.g. Honda Financial rate sheet" />
                              </Field>
                              <Field label="Source reference">
                                <input className="focus-ring h-10 w-full rounded-lg border bg-background px-3 text-sm" maxLength={500} name="sourceReference" placeholder="Program ID, lender quote ID, note, or URL reference" />
                              </Field>
                            </>
                          ) : null}
                          <div className="sm:col-span-2 rounded-lg border bg-muted/20 p-3 text-xs leading-5 text-muted-foreground">
                            DealerFlow snapshots an accepted trade appraisal. Finance payment is calculated only when a complete APR + term + source is supplied. Saving these terms is immutable for this Quote version.
                          </div>
                          <button className="focus-ring min-h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground sm:col-span-2">
                            Save commercial terms
                          </button>
                        </form>
                      </details>
                    ) : null}

                    {quote.leaseTerms ? (
                      <section className="mt-4 rounded-lg border bg-muted/20 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lease terms</p>
                        <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <Fact label="Adjusted cap cost" value={money(quote.leaseTerms.adjustedCapCostCents)} />
                          <Fact label="Residual value" value={money(quote.leaseTerms.residualValueCents)} />
                          <Fact label="Money factor" value={(quote.leaseTerms.moneyFactorPpm / 1_000_000).toFixed(6)} />
                          <Fact label="Term" value={`${quote.leaseTerms.termMonths} months`} />
                          <Fact label="Base payment" value={`${money(quote.leaseTerms.basePaymentCents)}/mo`} />
                        </dl>
                        <p className="mt-3 text-xs text-muted-foreground">Internal source: {quote.leaseTerms.sourceLabel}{quote.leaseTerms.sourceReference ? ` · ${quote.leaseTerms.sourceReference}` : ""}</p>
                      </section>
                    ) : null}

                    {quote.status === "draft" && quote.purchaseType === "lease" && !quote.leaseTerms && context.membership.capabilities.includes("quote.revise") ? (
                      <details className="mt-4 border-t pt-4">
                        <summary className="focus-ring cursor-pointer rounded-sm text-sm font-semibold">Add lease structure</summary>
                        <form action={attachQuoteLeaseTermsAction.bind(null, organizationId, dealId, quote.id)} className="mt-4 grid gap-4 sm:grid-cols-2">
                          <MoneyField label="Adjusted cap cost" name="adjustedCapCost" required />
                          <MoneyField label="Residual value" name="residualValue" required />
                          <Field label="Money factor"><input className="focus-ring h-10 w-full rounded-lg border bg-background px-3 text-sm" inputMode="decimal" name="moneyFactor" placeholder="0.002050" required /></Field>
                          <Field label="Lease term"><select className="focus-ring h-10 w-full rounded-lg border bg-background px-3 text-sm" name="leaseTermMonths" defaultValue="" required><option value="">Choose term</option>{[24,27,30,33,36,39,42,48,60].map((term) => <option key={term} value={term}>{term} months</option>)}</select></Field>
                          <Field label="Annual mileage"><select className="focus-ring h-10 w-full rounded-lg border bg-background px-3 text-sm" name="annualMileage" defaultValue=""><option value="">Not specified</option>{[7500,10000,12000,15000,18000].map((miles) => <option key={miles} value={miles}>{miles.toLocaleString("en-US")} miles/year</option>)}</select></Field>
                          <MoneyField label="Acquisition fee" name="acquisitionFee" />
                          <MoneyField label="Cap cost reduction" name="capCostReduction" />
                          <MoneyField label="Sourced rebate" name="rebate" />
                          <Field label="Lease source type"><select className="focus-ring h-10 w-full rounded-lg border bg-background px-3 text-sm" name="leaseSourceType" defaultValue="" required><option value="">Choose source</option><option value="manual-entry">Manual entry</option><option value="lender-quote">Lender quote</option><option value="oem-program">OEM program</option><option value="dealer-program">Dealer program</option></select></Field>
                          <Field label="Lease source"><input className="focus-ring h-10 w-full rounded-lg border bg-background px-3 text-sm" maxLength={200} name="leaseSourceLabel" required /></Field>
                          <Field label="Source reference"><input className="focus-ring h-10 w-full rounded-lg border bg-background px-3 text-sm" maxLength={500} name="leaseSourceReference" /></Field>
                          <button className="focus-ring min-h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground sm:col-span-2">Save lease structure</button>
                        </form>
                      </details>
                    ) : null}

                    {quote.incentives.length ? <section className="mt-4 rounded-lg border bg-muted/20 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Incentives</p><ul className="mt-3 space-y-2">{quote.incentives.map((item) => <li className="flex items-center justify-between rounded-md border bg-background p-3 text-sm" key={item.id}><span><span className="font-medium">{item.programName}</span><span className="ml-2 text-xs text-muted-foreground">{money(item.amountCents)}</span></span><span className="rounded-full border px-2 py-0.5 text-xs font-semibold capitalize">{item.eligibilityStatus}</span></li>)}</ul></section> : null}
                    {quote.status === "draft" && quote.discountLines.length > 0 && workspace.incentivePrograms.length > 0 && context.membership.capabilities.includes("quote.revise") ? (
                      <details className="mt-4 border-t pt-4"><summary className="focus-ring cursor-pointer rounded-sm text-sm font-semibold">Attach incentive provenance</summary><form action={attachIncentiveProgramAction.bind(null, organizationId, dealId, quote.id)} className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Quote discount line"><select className="focus-ring h-10 w-full rounded-lg border bg-background px-3 text-sm" name="quoteLineId" required><option value="">Choose discount line</option>{quote.discountLines.map((line) => <option key={line.id} value={line.id}>{line.description} · {money(line.amountCents)}</option>)}</select></Field><Field label="Incentive program"><select className="focus-ring h-10 w-full rounded-lg border bg-background px-3 text-sm" name="programId" required><option value="">Choose program</option>{workspace.incentivePrograms.map((program) => <option key={program.id} value={program.id}>{program.name} · {program.code}</option>)}</select></Field><Field label="Exact discount amount (cents)"><input className="focus-ring h-10 w-full rounded-lg border bg-background px-3 text-sm" inputMode="numeric" name="amountCents" required /></Field><button className="focus-ring min-h-10 rounded-lg border px-4 text-sm font-semibold sm:col-span-2">Attach for verification</button></form></details>
                    ) : null}

                    {canViewSensitive ? <section className="mt-4 rounded-lg border bg-muted/20 p-3"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Internal F&amp;I profitability</p><strong className="text-sm">Backend gross {money(quote.backendGrossCents)}</strong></div>{quote.backendSnapshots.length ? <ul className="mt-3 space-y-2">{quote.backendSnapshots.map((item) => <li className="grid gap-2 rounded-md border bg-background p-3 text-xs sm:grid-cols-4" key={item.id}><Fact label="Product" value={item.productName} /><Fact label="Sell" value={money(item.sellCents)} /><Fact label="Cost" value={money(item.costCents)} /><Fact label="Gross" value={money(item.grossCents)} /></li>)}</ul> : null}</section> : null}
                    {quote.status === "draft" && canViewSensitive && quote.productLines.length > 0 && workspace.backendProducts.length > 0 ? (
                      <details className="mt-4 border-t pt-4"><summary className="focus-ring cursor-pointer rounded-sm text-sm font-semibold">Attach internal F&amp;I product cost</summary><form action={attachBackendProductCostAction.bind(null, organizationId, dealId, quote.id)} className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Quote product line"><select className="focus-ring h-10 w-full rounded-lg border bg-background px-3 text-sm" name="quoteLineId" required><option value="">Choose Quote line</option>{quote.productLines.map((line) => <option key={line.id} value={line.id}>{line.description} · {money(line.amountCents)}</option>)}</select></Field><Field label="Backend product catalog"><select className="focus-ring h-10 w-full rounded-lg border bg-background px-3 text-sm" name="productId" required><option value="">Choose product</option>{workspace.backendProducts.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.code}</option>)}</select></Field><MoneyField label="Internal cost" name="cost" required /><button className="focus-ring min-h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground sm:col-span-2">Save internal cost snapshot</button></form></details>
                    ) : null}
                    {canViewSensitive && quote.profitability ? <section className="mt-4 rounded-lg border bg-muted/20 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Internal deal profitability</p><dl className="mt-3 grid gap-3 sm:grid-cols-3"><Fact label="Front gross" value={money(quote.profitability.frontGrossCents)} /><Fact label="Backend gross" value={money(quote.profitability.backendGrossCents)} /><Fact label="Total gross" value={money(quote.profitability.totalGrossCents)} /><Fact label="Vehicle cost" value={money(quote.profitability.vehicleCostCents)} /><Fact label="Pack" value={money(quote.profitability.packCents)} /><Fact label="Cost source" value={quote.profitability.costSourceLabel} /></dl></section> : null}
                    {quote.status === "draft" && canViewSensitive && !quote.profitability ? <form action={captureQuoteProfitabilityAction.bind(null, organizationId, dealId, quote.id)} className="mt-4 border-t pt-4"><p className="text-xs text-muted-foreground">Profitability uses the latest authoritative inventory cost and the effective pack policy. If either input is unavailable or invalid, capture fails closed.</p><button className="focus-ring mt-3 min-h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">Capture immutable profitability</button></form> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-4 rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
                No Quote versions exist for this Deal yet.
              </div>
            )}
          </section>

          <aside aria-labelledby="new-quote-heading" className="rounded-xl border bg-card p-4 shadow-soft sm:p-5">
            <h2 className="font-semibold" id="new-quote-heading">
              {latest ? "Create revised Quote" : "Create first Quote"}
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Enter only known pricing inputs. Payment, APR, term, lender, trade equity and F&I values are not inferred here.
            </p>

            {!canCreate ? (
              <p className="mt-4 rounded-lg border bg-muted p-3 text-sm text-muted-foreground">
                Your current role does not include Quote creation authority.
              </p>
            ) : closed ? (
              <p className="mt-4 rounded-lg border bg-muted p-3 text-sm text-muted-foreground">
                This Deal is {workspace.deal.status} and no longer accepts new Quote versions.
              </p>
            ) : (
              <form action={createQuoteVersionAction.bind(null, organizationId, dealId)} className="mt-5 space-y-4">
                <Field label="Purchase type">
                  <select
                    className="focus-ring h-10 w-full rounded-lg border bg-background px-3 text-sm"
                    defaultValue={workspace.deal.purchaseType ?? latest?.purchaseType ?? "finance"}
                    name="purchaseType"
                  >
                    <option value="cash">Cash</option>
                    <option value="finance">Finance</option>
                    <option value="lease">Lease</option>
                  </select>
                </Field>
                <MoneyField label="Vehicle selling price" name="vehiclePrice" required />
                <MoneyField label="Discount" name="discountAmount" />
                <Field label="Discount description">
                  <input className="focus-ring h-10 w-full rounded-lg border bg-background px-3 text-sm" maxLength={500} name="discountDescription" placeholder="Dealer discount" />
                </Field>
                <MoneyField label="Dealer fee" name="feeAmount" />
                <Field label="Fee description">
                  <input className="focus-ring h-10 w-full rounded-lg border bg-background px-3 text-sm" maxLength={500} name="feeDescription" placeholder="Documentation fee" />
                </Field>
                <MoneyField label="Estimated tax" name="taxAmount" />
                <MoneyField label="Product amount" name="productAmount" />
                <Field label="Product description">
                  <input className="focus-ring h-10 w-full rounded-lg border bg-background px-3 text-sm" maxLength={500} name="productDescription" placeholder="Service contract or product" />
                </Field>
                <MoneyField label="Accessory amount" name="accessoryAmount" />
                <Field label="Accessory description">
                  <input className="focus-ring h-10 w-full rounded-lg border bg-background px-3 text-sm" maxLength={500} name="accessoryDescription" placeholder="Accessory" />
                </Field>
                <Field label="Expires at">
                  <input className="focus-ring h-10 w-full rounded-lg border bg-background px-3 text-sm" name="expiresAt" type="datetime-local" />
                </Field>
                <p className="rounded-lg border bg-muted/20 p-3 text-xs leading-5 text-muted-foreground">
                  Saving creates a new immutable Quote version. Existing versions are never overwritten.
                </p>
                <button className="focus-ring min-h-11 w-full rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90">
                  Save new Quote version
                </button>
              </form>
            )}
          </aside>
        </div>
      </section>
    </AppShell>
  );
}

function Status({ value }: { value: string }) {
  return <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize">{value}</span>;
}
function ApprovalStatus({ value }: { value: "pending" | "approved" | "declined" }) {
  return <span className="rounded-full border px-2 py-0.5 text-xs font-semibold capitalize">Approval {value}</span>;
}
function Fact({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-sm font-medium tabular-nums">{value}</dd></div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs font-medium text-muted-foreground">{label}</span><span className="mt-1 block">{children}</span></label>;
}
function MoneyField({ label, name, required = false }: { label: string; name: string; required?: boolean }) {
  return <Field label={label}><div className="flex items-center rounded-lg border bg-background focus-within:ring-2 focus-within:ring-ring"><span className="pl-3 text-sm text-muted-foreground">$</span><input className="h-10 min-w-0 flex-1 bg-transparent px-2 text-sm outline-none" inputMode="decimal" name={name} placeholder="0.00" required={required} /></div></Field>;
}
function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}
function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
