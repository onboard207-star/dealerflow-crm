"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CarFront, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

export interface VehicleInterestOption {
  vehicleId: string;
  locationId: string;
  label: string;
  detail: string;
}

interface VehicleInterestControlsProps {
  organizationId: string;
  customerId: string;
  leadId?: string;
  options: readonly VehicleInterestOption[];
  canUpdate: boolean;
}

export function VehicleInterestControls({ organizationId, customerId, leadId, options, canUpdate }: VehicleInterestControlsProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!leadId) return;
    const form = new FormData(event.currentTarget);
    const selected = options.find((item) => item.vehicleId === value(form, "vehicleId"));
    if (!selected) { setMessage("Select an available vehicle."); return; }
    setPending(true); setMessage(undefined);
    try {
      const response = await fetch(`/api/organizations/${organizationId}/customers/${customerId}/vehicle-interests`, {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": `interest:${crypto.randomUUID()}` },
        body: JSON.stringify({ locationId: selected.locationId, leadId, vehicleId: selected.vehicleId, role: value(form, "role"), notes: value(form, "notes") }),
      });
      if (!response.ok) throw new Error(await readProblem(response));
      setMessage("Vehicle interest added."); setExpanded(false); router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The vehicle could not be added.");
    } finally { setPending(false); }
  }

  return (
    <section aria-labelledby="vehicle-interest-heading" className="rounded-xl border bg-card p-4 text-card-foreground shadow-soft sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-lg bg-muted"><CarFront aria-hidden="true" className="size-5 text-muted-foreground" /></span><div><h2 id="vehicle-interest-heading" className="font-semibold tracking-tight">Vehicle interest</h2><p className="mt-1 text-sm text-muted-foreground">Connect available inventory to this customer&apos;s current buying cycle.</p></div></div>
        {canUpdate && leadId && options.length ? <Button onClick={() => setExpanded((value) => !value)} type="button" variant={expanded ? "outline" : "default"}><Plus aria-hidden="true" className="size-4" />{expanded ? "Close" : "Add vehicle"}</Button> : null}
      </div>
      <p aria-live="polite" className="mt-3 text-sm text-muted-foreground" role="status">{message}</p>
      {!leadId ? <p className="mt-3 rounded-lg border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">An active Lead is required before adding vehicle interest.</p> : null}
      {leadId && !canUpdate ? <p className="mt-3 rounded-lg border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">You do not have permission to update this Lead.</p> : null}
      {leadId && canUpdate && !options.length ? <p className="mt-3 rounded-lg border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">No additional available inventory is visible in your assigned locations.</p> : null}
      {expanded ? <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={submit}>
        <label className="text-sm font-medium sm:col-span-2">Inventory vehicle<select className={inputClass} name="vehicleId" required><option value="">Select vehicle</option>{options.map((item) => <option key={`${item.locationId}:${item.vehicleId}`} value={item.vehicleId}>{item.label} · {item.detail}</option>)}</select></label>
        <label className="text-sm font-medium">Interest role<select className={inputClass} defaultValue="primary" name="role" required><option value="primary">Primary</option><option value="alternative">Alternative</option></select></label>
        <label className="text-sm font-medium">Context note<input className={inputClass} maxLength={1000} name="notes" placeholder="Optional customer preference" /></label>
        <div className="sm:col-span-2"><Button disabled={pending} type="submit">{pending ? "Adding vehicle…" : "Add to buying cycle"}</Button></div>
      </form> : null}
    </section>
  );
}

const inputClass = "focus-ring mt-1 min-h-11 w-full rounded-lg border bg-background px-3 text-sm text-foreground";
function value(form: FormData, name: string) { const item = form.get(name); return typeof item === "string" ? item.trim() : ""; }
async function readProblem(response: Response) { const payload = (await response.json().catch(() => undefined)) as { message?: unknown; issues?: unknown } | undefined; if (Array.isArray(payload?.issues) && payload.issues.every((item) => typeof item === "string")) return payload.issues.join(" "); return typeof payload?.message === "string" ? payload.message : "The request could not be completed."; }
