"use client";

import { useActionState } from "react";
import type { QuoteApprovalDecision } from "@/lib/application/deals";
import {
  decideQuoteApprovalAction,
  type QuoteApprovalActionState,
} from "@/app/organizations/[organizationId]/desking/actions";

const initialState: QuoteApprovalActionState = { ok: false, message: "" };

export function QuoteApprovalDecisionForm({
  organizationId,
  approvalId,
  decision,
}: {
  organizationId: string;
  approvalId: string;
  decision: QuoteApprovalDecision;
}) {
  const action = decideQuoteApprovalAction.bind(
    null,
    organizationId,
    approvalId,
    decision,
  );
  const [state, formAction, pending] = useActionState(action, initialState);
  const decline = decision === "declined";

  return (
    <form action={formAction} className="space-y-2">
      {decline ? (
        <label className="block">
          <span className="sr-only">Decline reason</span>
          <textarea
            className="focus-ring min-h-20 w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm"
            maxLength={1000}
            name="reason"
            placeholder="Reason required to decline"
            required
          />
        </label>
      ) : null}
      <button
        className={
          decline
            ? "focus-ring inline-flex min-h-10 w-full items-center justify-center rounded-lg border px-3 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            : "focus-ring inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        }
        disabled={pending}
        type="submit"
      >
        {pending
          ? "Saving…"
          : decline
            ? "Decline quote"
            : "Approve quote"}
      </button>
      {state.message ? (
        <p
          aria-live="polite"
          className={`text-xs leading-5 ${state.ok ? "text-muted-foreground" : "font-medium text-destructive"}`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
