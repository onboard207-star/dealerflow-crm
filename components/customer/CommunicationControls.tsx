"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareText, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

interface CommunicationControlsProps {
  organizationId: string;
  customerId: string;
  locationId?: string;
  leadId?: string;
  phone?: string;
  integrationId?: string;
  consent?: { action: "granted" | "revoked"; basis: "express-written" | "customer-initiated" | "not-applicable"; evidenceReference: string; occurredAt: string };
  canManageConsent: boolean;
  canSend: boolean;
  canRecord?: boolean;
}

export function CommunicationControls({ organizationId, customerId, locationId, leadId, phone, integrationId, consent, canManageConsent, canSend,canRecord=false }: CommunicationControlsProps) {
  const router = useRouter(); const [pending, setPending] = useState<"consent" | "send"|"record">(); const [message, setMessage] = useState<string>();const[recordDirection,setRecordDirection]=useState<"inbound"|"outbound">("outbound");
  const consentGranted = consent?.action === "granted";

  async function recordConsent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!locationId || !phone) return;
    const form = new FormData(event.currentTarget); const action = field(form, "action") as "granted" | "revoked";
    await send("consent", `/api/organizations/${organizationId}/customers/${customerId}/consents`, { locationId, channel: "sms", purpose: "operational", action, basis: action === "revoked" ? "not-applicable" : field(form, "basis"), address: phone, evidenceReference: field(form, "evidenceReference"), occurredAt: new Date().toISOString() });
  }

  async function sendSms(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!locationId || !phone || !integrationId) return;
    const form = new FormData(event.currentTarget);
    await send("send", `/api/organizations/${organizationId}/customers/${customerId}/messages`, { locationId, ...(leadId ? { leadId } : {}), integrationId, destination: phone, body: field(form, "body"), purpose: "operational" });
  }
  async function recordCommunication(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!locationId)return;const form=new FormData(event.currentTarget);await send("record",`/api/organizations/${organizationId}/customers/${customerId}/communications`,{locationId,...(leadId?{leadId}:{}),channel:field(form,"channel"),direction:field(form,"direction"),status:field(form,"status"),occurredAt:new Date().toISOString(),summary:field(form,"summary")});}

  async function send(kind: "consent" | "send"|"record", url: string, body: Record<string, string>) {
    setPending(kind); setMessage(undefined);
    try {
      const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": `${kind}:${crypto.randomUUID()}` }, body: JSON.stringify(body) });
      if (!response.ok) throw new Error(await readProblem(response));
      const payload = (await response.json()) as { attempt?: { status?: unknown; notBefore?: unknown } };
      if (kind === "send" && typeof payload.attempt?.status === "string") setMessage(payload.attempt.status === "queued" ? "Message queued for the next permitted local sending window." : `Message status: ${payload.attempt.status.replace("-", " ")}.`);
      else setMessage(kind==="record"?"Communication logged.":"Consent evidence recorded.");
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Communication could not be processed."); }
    finally { setPending(undefined); }
  }

  return <section aria-labelledby="communication-controls-heading" className="rounded-xl border bg-card p-4 text-card-foreground shadow-soft sm:p-5">
    <div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-lg bg-muted"><MessageSquareText aria-hidden="true" className="size-5 text-muted-foreground" /></span><div><h2 id="communication-controls-heading" className="font-semibold tracking-tight">Customer communication</h2><p className="mt-1 text-sm text-muted-foreground">Send operational SMS only from verified consent and an active tenant integration.</p></div></div>
    <p aria-live="polite" className="mt-3 text-sm text-muted-foreground" role="status">{message}</p>
    {canRecord&&locationId?<form className="mt-4 grid gap-3 rounded-lg border p-3 sm:grid-cols-3" onSubmit={recordCommunication}><label className="text-sm font-medium">Channel<select className={inputClass} defaultValue="call" name="channel"><option value="call">Call</option><option value="email">Email</option></select></label><label className="text-sm font-medium">Direction<select className={inputClass} name="direction" onChange={(event)=>setRecordDirection(event.target.value as"inbound"|"outbound")} value={recordDirection}><option value="outbound">Outbound</option><option value="inbound">Inbound</option></select></label><label className="text-sm font-medium">Outcome<select className={inputClass} defaultValue={recordDirection==="inbound"?"received":"attempted"} key={recordDirection} name="status">{recordDirection==="inbound"?<><option value="received">Received</option><option value="failed">Failed</option></>:<><option value="attempted">Attempted</option><option value="sent">Sent</option><option value="delivered">Delivered</option><option value="failed">Failed</option></>}</select></label><label className="text-sm font-medium sm:col-span-3">Interaction summary<textarea className="focus-ring mt-1 min-h-24 w-full rounded-lg border bg-background p-3 text-sm" maxLength={1000} name="summary" required/></label><div className="sm:col-span-3"><Button disabled={Boolean(pending)} type="submit" variant="outline">{pending==="record"?"Logging…":"Log call or email"}</Button></div></form>:null}
    {!phone || !locationId ? <p className="mt-3 rounded-lg border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">A valid customer mobile number and dealership location are required.</p> : null}
    {phone && locationId ? <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg border p-3"><div className="flex items-center gap-2"><ShieldCheck aria-hidden="true" className="size-4 text-muted-foreground" /><h3 className="text-sm font-medium">Operational SMS consent</h3></div><p className="mt-2 text-sm text-muted-foreground">{consent ? `${capitalize(consent.action)} · ${consent.basis.replace("-", " ")} · ${formatDate(consent.occurredAt)}` : "No current consent evidence."}</p>
        {canManageConsent ? <form className="mt-3 space-y-3" onSubmit={recordConsent}><label className="text-sm font-medium">Action<select className={inputClass} defaultValue={consentGranted ? "revoked" : "granted"} name="action"><option value="granted">Grant</option><option value="revoked">Revoke</option></select></label><label className="text-sm font-medium">Consent basis<select className={inputClass} defaultValue="customer-initiated" name="basis"><option value="customer-initiated">Customer initiated</option><option value="express-written">Express written</option></select></label><label className="text-sm font-medium">Evidence reference<input className={inputClass} maxLength={500} name="evidenceReference" placeholder="Signed form, inbound message, or recorded request" required /></label><Button disabled={Boolean(pending)} type="submit" variant="outline">Record consent event</Button></form> : <p className="mt-3 text-sm text-muted-foreground">You do not have permission to manage consent.</p>}
      </div>
      <div className="rounded-lg border p-3"><h3 className="text-sm font-medium">Send operational SMS</h3>{!integrationId ? <p className="mt-2 text-sm text-muted-foreground">No active Twilio sender is configured for this location.</p> : !consentGranted ? <p className="mt-2 text-sm text-muted-foreground">Current granted consent is required before sending.</p> : !canSend ? <p className="mt-2 text-sm text-muted-foreground">You do not have permission to send messages.</p> : <form className="mt-3 space-y-3" onSubmit={sendSms}><label className="text-sm font-medium">Message<textarea className="focus-ring mt-1 min-h-28 w-full rounded-lg border bg-background p-3 text-sm text-foreground" maxLength={1600} name="body" required /></label><Button disabled={Boolean(pending)} type="submit">{pending === "send" ? "Sending…" : "Send SMS"}</Button></form>}</div>
    </div> : null}
  </section>;
}

const inputClass = "focus-ring mt-1 min-h-11 w-full rounded-lg border bg-background px-3 text-sm text-foreground";
function field(form: FormData, name: string) { const value = form.get(name); return typeof value === "string" ? value.trim() : ""; }
function capitalize(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }
function formatDate(value: string) { return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
async function readProblem(response: Response) { const payload = (await response.json().catch(() => undefined)) as { message?: unknown; issues?: unknown } | undefined; if (Array.isArray(payload?.issues) && payload.issues.every((item) => typeof item === "string")) return payload.issues.join(" "); return typeof payload?.message === "string" ? payload.message : "The request could not be completed."; }
