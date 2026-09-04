import Link from "next/link";
import { ArrowRight, ReceiptText } from "lucide-react";

import { Button } from "@/components/ui/button";

type QuoteStatus = "draft" | "presented" | "accepted" | "rejected" | "expired";
type ApprovalStatus = "pending" | "approved" | "declined";

interface QuoteControlsProps {
  organizationId: string;
  deal?: { id: string; dealNumber: string; status: string };
  quote?: {
    id: string;
    version: number;
    status: QuoteStatus;
    purchaseType: "cash" | "finance" | "lease";
    currency: string;
    totalCents: number;
    approvalStatus?: ApprovalStatus;
  };
  canRead: boolean;
  canCreate: boolean;
}

/**
 * Customer-workspace summary for the canonical Deal Quote workspace.
 * Financial editing, versioning, approval, and proposal actions intentionally
 * remain in that workspace so the product has one desking authority.
 */
export function QuoteControls({ organizationId, deal, quote, canRead, canCreate }: QuoteControlsProps) {
  if (!deal) return null;

  const href = `/organizations/${organizationId}/deals/${deal.id}/quotes`;
  const closed = ["contracted", "delivered", "cancelled"].includes(deal.status);
  const action = quote ? "Open Quote workspace" : "Create Quote";

  return (
    <section aria-labelledby="quote-controls-heading" className="rounded-xl border bg-card p-4 text-card-foreground shadow-soft sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-muted">
            <ReceiptText aria-hidden="true" className="size-5 text-muted-foreground" />
          </span>
          <div className="min-w-0">
            <h2 id="quote-controls-heading" className="font-semibold tracking-tight">Deal &amp; Quote</h2>
            <p className="mt-1 break-words text-sm text-muted-foreground">
              {deal.dealNumber} · <span className="capitalize">{deal.status.replace("-", " ")}</span>
            </p>
          </div>
        </div>

        {canRead && (quote || (canCreate && !closed)) ? (
          <Button asChild>
            <Link href={href}>
              {action}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </Button>
        ) : null}
      </div>

      {quote ? (
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Current Quote" value={`Version ${quote.version}`} />
          <Fact label="Quote status" value={words(quote.status)} />
          <Fact label="Approval" value={quote.approvalStatus ? words(quote.approvalStatus) : "Not requested"} />
          <Fact label="Proposal" value={proposalStatus(quote.status)} />
          <Fact label="Purchase mode" value={words(quote.purchaseType)} />
          <Fact label="Customer total" value={formatMoney(quote.totalCents, quote.currency)} />
        </dl>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
          {closed
            ? "This Deal is closed and does not accept new Quote versions."
            : canCreate
              ? "No Quote exists yet. Continue in the canonical Quote workspace to create the first immutable version."
              : "No Quote exists, and your role cannot create one."}
        </p>
      )}

      {!canRead ? (
        <p className="mt-3 rounded-lg border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
          Your role cannot access Quote details.
        </p>
      ) : null}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border bg-muted/20 p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-medium capitalize">{value}</dd></div>;
}

function proposalStatus(status: QuoteStatus) {
  if (status === "draft") return "Draft — not presented";
  if (status === "presented") return "Presented";
  if (status === "accepted") return "Accepted";
  return words(status);
}

function words(value: string) {
  return value.replaceAll("-", " ");
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}
