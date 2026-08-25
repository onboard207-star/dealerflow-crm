"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2 } from "lucide-react";

import { Button } from "@/components/ui/button";

interface DealVehicleOption {
  vehicleId: string;
  inventoryUnitId: string;
  locationId: string;
  label: string;
  detail: string;
}

interface DealCreationControlsProps {
  organizationId: string;
  customerId: string;
  leadId?: string;
  existingDeal?: { id: string; dealNumber: string; status: "draft" | "working" | "pending-approval" | "approved" | "contracted" | "delivered" | "cancelled"; deliveryCompleted: boolean };
  vehicles: readonly DealVehicleOption[];
  canCreate: boolean;
  canUpdate: boolean;
  canApprove: boolean;
}

export function DealCreationControls({ organizationId, customerId, leadId, existingDeal, vehicles, canCreate, canUpdate, canApprove }: DealCreationControlsProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!leadId) return;
    const form = new FormData(event.currentTarget);
    const vehicle = vehicles.find((item) => item.inventoryUnitId === field(form, "inventoryUnitId"));
    if (!vehicle) { setMessage("Select the primary inventory vehicle."); return; }
    setPending(true); setMessage(undefined);
    try {
      const response = await fetch(`/api/organizations/${organizationId}/deals`, {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": `deal:${crypto.randomUUID()}` },
        body: JSON.stringify({ organizationId, locationId: vehicle.locationId, customerId, leadId, primaryVehicleId: vehicle.vehicleId, inventoryUnitId: vehicle.inventoryUnitId, purchaseType: field(form, "purchaseType") }),
      });
      if (!response.ok) throw new Error(await readProblem(response));
      setMessage("Draft Deal created."); setExpanded(false); router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The Deal could not be created.");
    } finally { setPending(false); }
  }

  async function transition(toStatus: "working" | "pending-approval" | "approved" | "contracted" | "delivered" | "cancelled", reason?: string) {
    if (!existingDeal) return;
    setPending(true); setMessage(undefined);
    try {
      const response = await fetch(`/api/organizations/${organizationId}/deals/${existingDeal.id}/transitions`, {
        method: "POST", headers: { "content-type": "application/json", "idempotency-key": `deal-transition:${crypto.randomUUID()}` },
        body: JSON.stringify({ toStatus, ...(reason ? { reason } : {}) }),
      });
      if (!response.ok) throw new Error(await readProblem(response));
      setMessage(`Deal moved to ${toStatus.replace("-", " ")}.`); router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The Deal could not be updated.");
    } finally { setPending(false); }
  }

  return (
    <section aria-labelledby="deal-creation-heading" className="rounded-xl border bg-card p-4 text-card-foreground shadow-soft sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0"><h2 id="deal-creation-heading" className="font-semibold tracking-tight">Deal workflow</h2><p className="mt-1 text-sm text-muted-foreground">{existingDeal ? `${existingDeal.dealNumber} · ${existingDeal.status.replace("-", " ")}` : "Start a controlled Deal from this buying cycle and its primary inventory vehicle."}</p></div>
        {!existingDeal && canCreate && leadId && vehicles.length ? <Button onClick={() => setExpanded((value) => !value)} type="button" variant={expanded ? "outline" : "default"}><FilePlus2 aria-hidden="true" className="size-4" />{expanded ? "Close" : "Create Deal"}</Button> : null}
      </div>
      <p aria-live="polite" className="mt-3 text-sm text-muted-foreground" role="status">{message}</p>
      {existingDeal && existingDeal.status !== "delivered" && existingDeal.status !== "cancelled" ? <div className="mt-4 space-y-3">
        <DealNextAction deal={existingDeal} canApprove={canApprove} canUpdate={canUpdate} disabled={pending} onTransition={transition} />
        {canUpdate ? <form className="flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-end" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void transition("cancelled", field(form, "reason")); }}><label className="min-w-0 flex-1 text-sm font-medium">Cancellation reason<input className={inputClass} maxLength={1000} name="reason" required /></label><Button disabled={pending} type="submit" variant="outline">Cancel Deal</Button></form> : null}
      </div> : null}
      {!existingDeal && !leadId ? <p className="mt-3 rounded-lg border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">An active Lead is required before creating a Deal.</p> : null}
      {!existingDeal && leadId && !canCreate ? <p className="mt-3 rounded-lg border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">You do not have permission to create a Deal.</p> : null}
      {!existingDeal && leadId && canCreate && !vehicles.length ? <p className="mt-3 rounded-lg border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">Add a primary vehicle with available inventory before creating a Deal.</p> : null}
      {expanded ? <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={submit}>
        <label className="text-sm font-medium sm:col-span-2">Primary inventory vehicle<select className={inputClass} name="inventoryUnitId" required><option value="">Select vehicle</option>{vehicles.map((vehicle) => <option key={vehicle.inventoryUnitId} value={vehicle.inventoryUnitId}>{vehicle.label} · {vehicle.detail}</option>)}</select></label>
        <label className="text-sm font-medium">Purchase type<select className={inputClass} name="purchaseType"><option value="">Undecided</option><option value="cash">Cash</option><option value="finance">Finance</option><option value="lease">Lease</option></select></label>
        <div className="flex items-end"><Button disabled={pending} type="submit">{pending ? "Creating Deal…" : "Create draft Deal"}</Button></div>
      </form> : null}
    </section>
  );
}

function DealNextAction({ deal, canUpdate, canApprove, disabled, onTransition }: { deal: NonNullable<DealCreationControlsProps["existingDeal"]>; canUpdate: boolean; canApprove: boolean; disabled: boolean; onTransition: (status: "working" | "pending-approval" | "approved" | "contracted" | "delivered") => Promise<void> }) {
  if (deal.status === "draft") return canUpdate ? <Button disabled={disabled} onClick={() => onTransition("working")} type="button">Start Deal</Button> : <PermissionMessage />;
  if (deal.status === "working") return canUpdate ? <Button disabled={disabled} onClick={() => onTransition("pending-approval")} type="button">Submit for approval</Button> : <PermissionMessage />;
  if (deal.status === "pending-approval") return canApprove ? <Button disabled={disabled} onClick={() => onTransition("approved")} type="button">Approve Deal</Button> : <p className="text-sm text-muted-foreground">Manager approval is required before this Deal can proceed.</p>;
  if (deal.status === "approved") return canUpdate ? <Button disabled={disabled} onClick={() => onTransition("contracted")} type="button">Mark contracted</Button> : <PermissionMessage />;
  if (deal.status === "contracted") return deal.deliveryCompleted && canUpdate ? <Button disabled={disabled} onClick={() => onTransition("delivered")} type="button">Complete sale</Button> : <p className="text-sm text-muted-foreground">A completed delivery handoff is required before the sale can be completed.</p>;
  return null;
}

function PermissionMessage() { return <p className="text-sm text-muted-foreground">You can view this Deal but do not have permission to advance it.</p>; }

const inputClass = "focus-ring mt-1 min-h-11 w-full rounded-lg border bg-background px-3 text-sm text-foreground";
function field(form: FormData, name: string) { const value = form.get(name); return typeof value === "string" ? value.trim() : ""; }
async function readProblem(response: Response) { const payload = (await response.json().catch(() => undefined)) as { message?: unknown; issues?: unknown } | undefined; if (Array.isArray(payload?.issues) && payload.issues.every((item) => typeof item === "string")) return payload.issues.join(" "); return typeof payload?.message === "string" ? payload.message : "The request could not be completed."; }
