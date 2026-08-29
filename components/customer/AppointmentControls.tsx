"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus } from "lucide-react";

import { Button } from "@/components/ui/button";

interface AppointmentControlsProps {
  organizationId: string;
  customerId: string;
  leadId?: string;
  locationId?: string;
  nextAppointment?: { id:string;type:string;status:string;startsAt:string;timezone:string };
  canCreate: boolean;
  canUpdate?: boolean;
}

export function AppointmentControls({ organizationId, customerId, leadId, locationId, nextAppointment, canCreate, canUpdate=false }: AppointmentControlsProps) {
  const router = useRouter(); const [expanded, setExpanded] = useState(false); const [pending, setPending] = useState(false); const [message, setMessage] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!leadId || !locationId) return;
    const form = new FormData(event.currentTarget); const startsAt = localDate(field(form, "startsAt")); const endsAt = localDate(field(form, "endsAt"));
    if (!startsAt || !endsAt) { setMessage("Enter a valid appointment time range."); return; }
    setPending(true); setMessage(undefined);
    try {
      const response = await fetch(`/api/organizations/${organizationId}/appointments`, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": `appointment:${crypto.randomUUID()}` }, body: JSON.stringify({ locationId, customerId, leadId, type: field(form, "type"), startsAt, endsAt, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, notes: field(form, "notes"), followUp: { title: `Prepare for ${field(form, "type")} appointment`, dueAt: startsAt, priority: "normal" } }) });
      if (!response.ok) throw new Error(await readProblem(response)); setMessage("Appointment scheduled with a linked preparation task."); setExpanded(false); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "The appointment could not be scheduled."); }
    finally { setPending(false); }
  }
  async function transition(toStatus:"confirmed"|"arrived"|"completed"|"cancelled"|"no-show",reason?:string){if(!nextAppointment)return;setPending(true);setMessage(undefined);try{const response=await fetch(`/api/organizations/${organizationId}/appointments/${nextAppointment.id}/transitions`,{method:"POST",headers:{"content-type":"application/json","idempotency-key":`appointment:${toStatus}:${crypto.randomUUID()}`},body:JSON.stringify({toStatus,...(reason?{reason}:{})})});if(!response.ok)throw new Error(await readProblem(response));setMessage("Appointment updated.");router.refresh();}catch(error){setMessage(error instanceof Error?error.message:"The appointment could not be updated.");}finally{setPending(false);}}

  return <section aria-labelledby="appointment-controls-heading" className="rounded-xl border bg-card p-4 text-card-foreground shadow-soft sm:p-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="flex min-w-0 items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-lg bg-muted"><CalendarPlus aria-hidden="true" className="size-5 text-muted-foreground" /></span><div><h2 id="appointment-controls-heading" className="font-semibold tracking-tight">Appointments</h2><p className="mt-1 text-sm text-muted-foreground">{nextAppointment ? `${nextAppointment.type} · ${nextAppointment.status} · ${formatDate(nextAppointment.startsAt, nextAppointment.timezone)}` : "Schedule customer time and automatically create a preparation task."}</p></div></div>{canCreate && leadId && locationId ? <Button onClick={() => setExpanded((value) => !value)} type="button" variant={expanded ? "outline" : "default"}>{expanded ? "Close" : "Schedule"}</Button> : null}</div>
    <p aria-live="polite" className="mt-3 text-sm text-muted-foreground" role="status">{message}</p>
    {nextAppointment&&canUpdate?<div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">{nextAppointment.status==="scheduled"?<Button disabled={pending} onClick={()=>transition("confirmed")} type="button" variant="outline">Confirm</Button>:null}{["scheduled","confirmed"].includes(nextAppointment.status)?<Button disabled={pending} onClick={()=>transition("arrived")} type="button" variant="outline">Mark arrived</Button>:null}{nextAppointment.status==="arrived"?<Button disabled={pending} onClick={()=>transition("completed")} type="button">Complete</Button>:null}{["scheduled","confirmed"].includes(nextAppointment.status)?<form className="col-span-2 flex flex-col gap-2 sm:flex-row" onSubmit={(event)=>{event.preventDefault();const form=new FormData(event.currentTarget);void transition(field(form,"outcome")as"cancelled"|"no-show",field(form,"reason"));}}><select aria-label="Missed appointment outcome" className="focus-ring h-11 rounded-lg border bg-background px-2 text-sm" name="outcome"><option value="cancelled">Cancelled</option><option value="no-show">No-show</option></select><input aria-label="Appointment outcome reason" className="focus-ring h-11 min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm" maxLength={1000} name="reason" placeholder="Reason" required/><Button disabled={pending} type="submit" variant="outline">Record</Button></form>:null}</div>:null}
    {!leadId || !locationId ? <p className="mt-3 rounded-lg border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">An active Lead and dealership location are required.</p> : null}
    {leadId && locationId && !canCreate ? <p className="mt-3 rounded-lg border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">You do not have permission to schedule appointments and preparation tasks.</p> : null}
    {expanded ? <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={submit}><label className="text-sm font-medium">Appointment type<select className={inputClass} defaultValue="showroom" name="type" required><option value="showroom">Showroom</option><option value="test-drive">Test drive</option><option value="delivery">Delivery consultation</option><option value="phone">Phone consultation</option><option value="video">Video consultation</option></select></label><span className="hidden sm:block" /><label className="text-sm font-medium">Starts<input className={inputClass} name="startsAt" required type="datetime-local" /></label><label className="text-sm font-medium">Ends<input className={inputClass} name="endsAt" required type="datetime-local" /></label><label className="text-sm font-medium sm:col-span-2">Notes<input className={inputClass} maxLength={2000} name="notes" /></label><div className="sm:col-span-2"><Button disabled={pending} type="submit">{pending ? "Scheduling…" : "Schedule appointment"}</Button></div></form> : null}
  </section>;
}

const inputClass = "focus-ring mt-1 min-h-11 w-full rounded-lg border bg-background px-3 text-sm text-foreground";
function field(form: FormData, name: string) { const value = form.get(name); return typeof value === "string" ? value.trim() : ""; }
function localDate(value: string) { const date = new Date(value); return value && !Number.isNaN(date.valueOf()) ? date.toISOString() : undefined; }
function formatDate(value: string, timezone: string) { return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(value)); }
async function readProblem(response: Response) { const payload = (await response.json().catch(() => undefined)) as { message?: unknown; issues?: unknown } | undefined; if (Array.isArray(payload?.issues) && payload.issues.every((item) => typeof item === "string")) return payload.issues.join(" "); return typeof payload?.message === "string" ? payload.message : "The request could not be completed."; }
