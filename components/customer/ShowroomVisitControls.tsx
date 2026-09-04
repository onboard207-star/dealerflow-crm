"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CircleStop, Play, Store } from "lucide-react";

import { Button } from "@/components/ui/button";

interface CurrentVisit {
  id: string;
  status: "checked-in" | "active";
  purpose: string;
  arrivedAt: string;
}

interface ShowroomVisitControlsProps {
  organizationId: string;
  customerId: string;
  leadId?: string;
  locationId?: string;
  appointmentId?: string;
  assignedUserId?: string;
  currentVisit?: CurrentVisit;
  canCreate: boolean;
  canUpdate: boolean;
}

type PendingAction = "check-in" | "start" | "complete" | "cancel";

export function ShowroomVisitControls({ organizationId, customerId, leadId, locationId, appointmentId, assignedUserId, currentVisit, canCreate, canUpdate }: ShowroomVisitControlsProps) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingAction>();
  const [message, setMessage] = useState<string>();

  async function checkIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!leadId || !locationId) return;
    const data = new FormData(event.currentTarget);
    await request("check-in", `/api/organizations/${organizationId}/showroom-visits`, {
      locationId, customerId, leadId, purpose: String(data.get("purpose") ?? ""), ...(appointmentId ? { appointmentId } : {}), ...(assignedUserId ? { assignedUserId } : {}),
    });
  }

  async function transition(action: Exclude<PendingAction, "check-in">, details: Record<string, string> = {}) {
    if (!currentVisit) return;
    await request(action, `/api/organizations/${organizationId}/showroom-visits/${currentVisit.id}/transitions`, {
      toStatus: action === "start" ? "active" : action === "complete" ? "completed" : "cancelled", ...details,
    });
  }

  async function request(action: PendingAction, url: string, body: Record<string, string>) {
    setPending(action); setMessage(undefined);
    try {
      const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": `visit:${crypto.randomUUID()}` }, body: JSON.stringify(body) });
      if (!response.ok) throw new Error(await readProblem(response));
      setMessage(action === "check-in" ? "Customer checked in." : action === "start" ? "Visit started." : action === "complete" ? "Visit completed." : "Visit cancelled.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The visit could not be updated.");
    } finally { setPending(undefined); }
  }

  return (
    <section aria-labelledby="showroom-visit-heading" className="rounded-xl border bg-card p-4 text-card-foreground shadow-soft sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-muted"><Store aria-hidden="true" className="size-5 text-muted-foreground" /></span>
        <div className="min-w-0">
          <h2 id="showroom-visit-heading" className="font-semibold tracking-tight">Showroom visit</h2>
          <p className="mt-1 text-sm text-muted-foreground">{currentVisit ? `${currentVisit.purpose} · ${labelStatus(currentVisit.status)} since ${formatTime(currentVisit.arrivedAt)}` : "Check in an arriving customer and track the visit outcome."}</p>
        </div>
      </div>
      <p aria-live="polite" className="mt-3 text-sm text-muted-foreground" role="status">{message}</p>

      {!currentVisit && canCreate && leadId && locationId ? (
        <form className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={checkIn}>
          <label className="min-w-0 flex-1 text-sm font-medium">Visit purpose<input className="focus-ring mt-1 min-h-11 w-full rounded-lg border bg-background px-3 text-sm" defaultValue="Showroom visit" maxLength={200} name="purpose" required /></label>
          <Button disabled={Boolean(pending)} type="submit">Check in customer</Button>
        </form>
      ) : null}
      {!currentVisit && (!canCreate || !leadId || !locationId) ? <p className="mt-3 rounded-lg border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">{!leadId || !locationId ? "An active lead and dealership location are required before check-in." : "You do not have permission to check in this customer."}</p> : null}

      {currentVisit && canUpdate ? (
        <div className="mt-4 space-y-3">
          {currentVisit.status === "checked-in" ? <Button disabled={Boolean(pending)} onClick={() => transition("start")} type="button"><Play aria-hidden="true" className="size-4" /> Start visit</Button> : (
            <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void transition("complete", { outcome: String(data.get("outcome") ?? "") }); }}>
              <label className="min-w-0 flex-1 text-sm font-medium">Visit outcome<input className="focus-ring mt-1 min-h-11 w-full rounded-lg border bg-background px-3 text-sm" maxLength={500} name="outcome" placeholder="Example: Test drive completed" required /></label>
              <Button disabled={Boolean(pending)} type="submit"><CircleStop aria-hidden="true" className="size-4" /> Complete</Button>
            </form>
          )}
          <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void transition("cancel", { reason: String(data.get("reason") ?? "") }); }}>
            <label className="min-w-0 flex-1 text-sm font-medium">Cancellation reason<input className="focus-ring mt-1 min-h-11 w-full rounded-lg border bg-background px-3 text-sm" maxLength={1000} name="reason" required /></label>
            <Button disabled={Boolean(pending)} type="submit" variant="outline">Cancel visit</Button>
          </form>
        </div>
      ) : null}
      {currentVisit && !canUpdate ? <p className="mt-3 rounded-lg border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">You can view this visit but do not have permission to update it.</p> : null}
    </section>
  );
}

function labelStatus(status: CurrentVisit["status"]) { return status === "checked-in" ? "Checked in" : "Active"; }
function formatTime(value: string) { return new Intl.DateTimeFormat("en-US", { timeStyle: "short" }).format(new Date(value)); }
async function readProblem(response: Response) { const payload = (await response.json().catch(() => undefined)) as { message?: unknown } | undefined; return typeof payload?.message === "string" ? payload.message : "The request could not be completed."; }
