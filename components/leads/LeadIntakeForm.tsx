"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";

interface LeadIntakeFormProps {
  organizationId: string;
  locations: readonly { id: string; name: string }[];
}

export function LeadIntakeForm({ organizationId, locations }: LeadIntakeFormProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage(undefined);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/organizations/${organizationId}/leads/intake`, {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": `lead:${crypto.randomUUID()}` },
        body: JSON.stringify({
          locationId: value(form, "locationId"), source: value(form, "source"), sourceDetail: value(form, "sourceDetail"),
          customer: { displayName: value(form, "displayName"), firstName: value(form, "firstName"), lastName: value(form, "lastName"), email: value(form, "email"), phone: value(form, "phone") },
        }),
      });
      if (!response.ok) throw new Error(await readProblem(response));
      const payload = (await response.json()) as { customer?: { id?: unknown } };
      if (typeof payload.customer?.id !== "string") throw new Error("The lead was created but its customer workspace could not be opened.");
      router.push(`/organizations/${organizationId}/customers/${payload.customer.id}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The lead could not be created."); setPending(false);
    }
  }

  if (!expanded) return <Button disabled={!locations.length} onClick={() => setExpanded(true)} type="button"><UserPlus aria-hidden="true" className="size-4" /> New lead</Button>;

  return (
    <section aria-labelledby="lead-intake-heading" className="mt-5 rounded-xl border bg-card p-4 shadow-soft sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="lead-intake-heading" className="font-semibold tracking-tight">Create lead</h2><p className="mt-1 text-sm text-muted-foreground">DealerFlow reuses a matching customer by email or phone and starts a new buying cycle.</p></div><Button onClick={() => { setExpanded(false); setMessage(undefined); }} type="button" variant="ghost">Close</Button></div>
      <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={submit}>
        <Field label="Customer name" name="displayName" required />
        <label className="text-sm font-medium">Dealership location<select className={inputClass} defaultValue={locations.length === 1 ? locations[0]?.id : ""} name="locationId" required><option value="">Select location</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
        <Field autoComplete="given-name" label="First name" name="firstName" />
        <Field autoComplete="family-name" label="Last name" name="lastName" />
        <Field autoComplete="email" label="Email" name="email" type="email" />
        <Field autoComplete="tel" description="Use international format, such as +12075550123." label="Phone" name="phone" pattern="\+[1-9][0-9]{7,14}" type="tel" />
        <label className="text-sm font-medium">Lead source<select className={inputClass} name="source" required><option value="">Select source</option>{["Website", "Phone", "Walk-in", "Referral", "Marketplace", "OEM", "Returning Customer"].map((source) => <option key={source} value={source}>{source}</option>)}</select></label>
        <Field label="Source detail" maxLength={200} name="sourceDetail" />
        <p className="text-sm text-muted-foreground sm:col-span-2">At least one contact method—email or phone—is required.</p>
        {message ? <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive sm:col-span-2" role="alert">{message}</p> : null}
        <div className="sm:col-span-2"><Button disabled={pending} type="submit">{pending ? "Creating lead…" : "Create lead and open customer"}</Button></div>
      </form>
    </section>
  );
}

const inputClass = "focus-ring mt-1 min-h-11 w-full rounded-lg border bg-background px-3 text-sm text-foreground";
function Field({ label, description, ...props }: { label: string; description?: string } & React.InputHTMLAttributes<HTMLInputElement>) { return <label className="text-sm font-medium">{label}<input className={inputClass} {...props} />{description ? <span className="mt-1 block text-xs font-normal text-muted-foreground">{description}</span> : null}</label>; }
function value(form: FormData, name: string) { const item = form.get(name); return typeof item === "string" ? item.trim() : ""; }
async function readProblem(response: Response) { const payload = (await response.json().catch(() => undefined)) as { message?: unknown; issues?: unknown } | undefined; if (Array.isArray(payload?.issues) && payload.issues.every((item) => typeof item === "string")) return payload.issues.join(" "); return typeof payload?.message === "string" ? payload.message : "The request could not be completed."; }
