"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Copy, MessageSquareText } from "lucide-react";

import { Button } from "@/components/ui/button";

interface TwilioIntegrationFormProps {
  organizationId: string;
  locations: readonly { id: string; name: string }[];
  allowOrganizationWide: boolean;
}

export function TwilioIntegrationForm({ organizationId, locations, allowOrganizationWide }: TwilioIntegrationFormProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const [webhookUrl, setWebhookUrl] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true); setMessage(undefined); setWebhookUrl(undefined);
    try {
      const locationId = field(form, "locationId");
      const response = await fetch(`/api/organizations/${organizationId}/integrations/twilio`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...(locationId ? { locationId } : {}),
          providerAccountId: field(form, "providerAccountId"),
          credentialReference: field(form, "credentialReference"),
          publicBaseUrl: field(form, "publicBaseUrl"),
          defaultFromAddress: field(form, "defaultFromAddress") }),
      });
      if (!response.ok) throw new Error(await readProblem(response));
      const payload = await response.json() as { webhookUrl?: unknown };
      if (typeof payload.webhookUrl !== "string") throw new Error("DealerFlow did not return the webhook URL.");
      setWebhookUrl(payload.webhookUrl); setMessage("Twilio sender provisioned. Save the webhook URL now.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The Twilio sender could not be provisioned.");
    } finally { setPending(false); }
  }

  async function copyWebhook() {
    if (!webhookUrl) return;
    try { await navigator.clipboard.writeText(webhookUrl); setMessage("Webhook URL copied."); }
    catch { setMessage("Copy was blocked. Select and copy the webhook URL manually."); }
  }

  return <div className="mt-5"><Button onClick={() => setExpanded((value) => !value)} type="button" variant={expanded ? "outline" : "default"}><MessageSquareText aria-hidden="true" className="size-4"/>{expanded ? "Close" : "Provision Twilio"}</Button>
    <p aria-live="polite" className="mt-3 text-sm text-muted-foreground" role="status">{message}</p>
    {webhookUrl ? <section aria-labelledby="webhook-heading" className="mt-3 rounded-xl border border-warning/40 bg-warning/10 p-4"><h2 className="font-semibold" id="webhook-heading">One-time webhook URL</h2><p className="mt-1 text-sm text-muted-foreground">Configure this exact incoming-message webhook in Twilio. The secret path cannot be retrieved after leaving this page.</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><input aria-label="One-time Twilio webhook URL" className={`${inputClass} mt-0 font-mono text-xs`} readOnly value={webhookUrl}/><Button onClick={copyWebhook} type="button" variant="outline"><Copy aria-hidden="true" className="size-4"/>Copy</Button></div></section> : null}
    {expanded ? <section aria-labelledby="twilio-form-heading" className="mt-3 rounded-xl border bg-card p-4 shadow-soft sm:p-5"><h2 className="font-semibold tracking-tight" id="twilio-form-heading">Twilio sender</h2><p className="mt-1 text-sm text-muted-foreground">Store the auth token in the deployment secret manager. DealerFlow records only the secret reference.</p><form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={submit}>
      <label className="text-sm font-medium">Scope<select className={inputClass} defaultValue={allowOrganizationWide ? "" : locations.length === 1 ? locations[0]?.id : ""} name="locationId" required={!allowOrganizationWide}>{allowOrganizationWide ? <option value="">All locations</option> : <option value="">Select location</option>}{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
      <Field autoComplete="off" label="Twilio Account SID" name="providerAccountId" pattern="AC[a-fA-F0-9]{32}" placeholder="AC…" required/>
      <Field autoCapitalize="characters" autoComplete="off" label="Credential reference" name="credentialReference" pattern="[A-Z][A-Z0-9_]{2,63}" placeholder="TWILIO_PRIMARY" required/>
      <Field autoComplete="url" label="Public HTTPS origin" name="publicBaseUrl" placeholder="https://crm.example.com" required type="url"/>
      <Field autoComplete="tel" label="Default sender (E.164)" name="defaultFromAddress" pattern="\+[1-9][0-9]{7,14}" placeholder="+12075550199" required type="tel"/>
      <div className="flex items-end"><Button disabled={pending} type="submit">{pending ? "Provisioning…" : "Provision sender"}</Button></div>
    </form><p className="mt-4 text-xs text-muted-foreground">Provisioning another sender with the same Twilio account is rejected. Credential rotation remains a deployment-secret operation.</p></section> : null}
  </div>;
}

const inputClass = "focus-ring mt-1 min-h-11 w-full rounded-lg border bg-background px-3 text-sm text-foreground";
function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) { return <label className="text-sm font-medium">{label}<input className={inputClass} {...props}/></label>; }
function field(form: FormData, name: string) { const value = form.get(name); return typeof value === "string" ? value.trim() : ""; }
async function readProblem(response: Response) { const payload = await response.json().catch(() => undefined) as { message?: unknown; issues?: unknown } | undefined; if (Array.isArray(payload?.issues) && payload.issues.every((item) => typeof item === "string")) return payload.issues.join(" "); return typeof payload?.message === "string" ? payload.message : "The request could not be completed."; }
