"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, RefreshCw, X } from "lucide-react";

import { Button } from "@/components/ui/button";

interface AIRecommendationControlsProps {
  organizationId: string;
  customerId: string;
  runId?: string;
  canReview: boolean;
  reviewed: boolean;
}

export function AIRecommendationControls({
  organizationId,
  customerId,
  runId,
  canReview,
  reviewed,
}: AIRecommendationControlsProps) {
  const router = useRouter();
  const [pending, setPending] = useState<"generate" | "accepted" | "dismissed">();
  const [message, setMessage] = useState<string>();

  async function generate() {
    setPending("generate");
    setMessage(undefined);
    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/customers/${customerId}/ai-recommendations`,
        {
          method: "POST",
          headers: { "idempotency-key": `ai:${crypto.randomUUID()}` },
        },
      );
      if (!response.ok) throw new Error(await readProblem(response));
      setMessage("Recommendation refreshed.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Recommendation generation failed.");
    } finally {
      setPending(undefined);
    }
  }

  async function review(decision: "accepted" | "dismissed") {
    if (!runId) return;
    setPending(decision);
    setMessage(undefined);
    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/ai-recommendations/${runId}/review`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ decision }),
        },
      );
      if (!response.ok) throw new Error(await readProblem(response));
      setMessage(decision === "accepted" ? "Recommendation accepted." : "Recommendation dismissed.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Review could not be saved.");
    } finally {
      setPending(undefined);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground shadow-soft sm:flex-row sm:items-center sm:justify-between">
      <p aria-live="polite" className="text-sm text-muted-foreground" role="status">
        {message ?? "AI guidance uses current DealerFlow records and always requires human judgment."}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        {runId && canReview && !reviewed ? (
          <>
            <Button disabled={Boolean(pending)} onClick={() => review("accepted")} type="button" variant="outline">
              <Check aria-hidden="true" className="size-4" /> Accept
            </Button>
            <Button disabled={Boolean(pending)} onClick={() => review("dismissed")} type="button" variant="outline">
              <X aria-hidden="true" className="size-4" /> Dismiss
            </Button>
          </>
        ) : null}
        <Button disabled={Boolean(pending)} onClick={generate} type="button">
          <RefreshCw aria-hidden="true" className={pending === "generate" ? "size-4 animate-spin" : "size-4"} />
          {pending === "generate" ? "Generating" : runId ? "Refresh guidance" : "Generate guidance"}
        </Button>
      </div>
    </div>
  );
}

async function readProblem(response: Response) {
  const payload = (await response.json().catch(() => undefined)) as { message?: unknown } | undefined;
  return typeof payload?.message === "string" ? payload.message : "The request could not be completed.";
}
