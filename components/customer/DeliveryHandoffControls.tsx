"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

interface DeliveryHandoffControlsProps {
  organizationId: string;
  deal?: { id: string; status: string };
  delivery?: { id: string; status: "scheduled" | "ready" | "completed" | "cancelled"; startsAt: string; endsAt: string; timezone: string };
  canUpdate: boolean;
}

export function DeliveryHandoffControls({ organizationId, deal, delivery, canUpdate }: DeliveryHandoffControlsProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();

  async function schedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!deal) return;
    const form = new FormData(event.currentTarget);
    const startsAt = localDate(field(form, "startsAt")); const endsAt = localDate(field(form, "endsAt"));
    if (!startsAt || !endsAt) { setMessage("Enter a valid delivery time range."); return; }
    await send(`/api/organizations/${organizationId}/deals/${deal.id}/delivery`, { startsAt, endsAt, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, notes: field(form, "notes") });
  }

  async function transition(toStatus: "ready" | "completed" | "cancelled", reason?: string) {
    if (!delivery) return;
    await send(`/api/organizations/${organizationId}/deliveries/${delivery.id}/transitions`, { toStatus, ...(reason ? { reason } : {}) });
  }

  async function send(url: string, body: Record<string, string>) {
    setPending(true); setMessage(undefined);
    try {
      const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": `delivery:${crypto.randomUUID()}` }, body: JSON.stringify(body) });
      if (!response.ok) throw new Error(await readProblem(response));
      setMessage("Delivery handoff updated."); router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Delivery handoff could not be updated.");
    } finally { setPending(false); }
  }

  if (!deal || deal.status !== "contracted" && !delivery) return null;
  return (
    <section aria-labelledby="delivery-handoff-heading" className="rounded-xl border bg-card p-4 text-card-foreground shadow-soft sm:p-5">
      <div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-lg bg-muted"><CalendarCheck aria-hidden="true" className="size-5 text-muted-foreground" /></span><div><h2 id="delivery-handoff-heading" className="font-semibold tracking-tight">Delivery handoff</h2><p className="mt-1 text-sm text-muted-foreground">{delivery ? `${capitalize(delivery.status)} · ${formatDate(delivery.startsAt, delivery.timezone)}` : "Schedule and verify the physical customer handoff."}</p></div></div>
      <p aria-live="polite" className="mt-3 text-sm text-muted-foreground" role="status">{message}</p>
      {!canUpdate ? <p className="mt-3 rounded-lg border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">You can view this handoff but do not have permission to update it.</p> : null}
      {!delivery && canUpdate ? <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={schedule}>
        <label className="text-sm font-medium">Delivery starts<input className={inputClass} name="startsAt" required type="datetime-local" /></label>
        <label className="text-sm font-medium">Delivery ends<input className={inputClass} name="endsAt" required type="datetime-local" /></label>
        <label className="text-sm font-medium sm:col-span-2">Handoff notes<input className={inputClass} maxLength={2000} name="notes" /></label>
        <div className="sm:col-span-2"><Button disabled={pending} type="submit">{pending ? "Scheduling…" : "Schedule delivery"}</Button></div>
      </form> : null}
      {delivery && canUpdate && delivery.status === "scheduled" ? <div className="mt-4"><Button disabled={pending} onClick={() => transition("ready")} type="button">Mark ready</Button></div> : null}
      {delivery && canUpdate && delivery.status === "ready" ? <div className="mt-4"><Button disabled={pending} onClick={() => transition("completed")} type="button">Confirm customer handoff</Button></div> : null}
      {delivery && canUpdate && ["scheduled", "ready"].includes(delivery.status) ? <form className="mt-3 flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-end" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void transition("cancelled", field(form, "reason")); }}><label className="min-w-0 flex-1 text-sm font-medium">Cancellation reason<input className={inputClass} maxLength={1000} name="reason" required /></label><Button disabled={pending} type="submit" variant="outline">Cancel delivery</Button></form> : null}
    </section>
  );
}

const inputClass = "focus-ring mt-1 min-h-11 w-full rounded-lg border bg-background px-3 text-sm text-foreground";
function field(form: FormData, name: string) { const value = form.get(name); return typeof value === "string" ? value.trim() : ""; }
function localDate(value: string) { const date = new Date(value); return value && !Number.isNaN(date.valueOf()) ? date.toISOString() : undefined; }
function capitalize(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }
function formatDate(value: string, timezone: string) { return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(value)); }
async function readProblem(response: Response) { const payload = (await response.json().catch(() => undefined)) as { message?: unknown; issues?: unknown } | undefined; if (Array.isArray(payload?.issues) && payload.issues.every((item) => typeof item === "string")) return payload.issues.join(" "); return typeof payload?.message === "string" ? payload.message : "The request could not be completed."; }
