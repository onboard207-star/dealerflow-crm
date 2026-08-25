"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ReceiptText } from "lucide-react";

import { Button } from "@/components/ui/button";

interface QuoteControlsProps {
  organizationId: string;
  deal?: { id: string; status: string };
  vehicle?: { label: string; listPriceCents?: number };
  quote?: { id: string; version: number; status: "draft" | "presented" | "accepted" | "rejected" | "expired"; purchaseType: "cash" | "finance" | "lease"; currency: string; totalCents: number };
  canUpdate: boolean;
}

export function QuoteControls({ organizationId, deal, vehicle, quote, canUpdate }: QuoteControlsProps) {
  const router = useRouter(); const [expanded, setExpanded] = useState(false); const [pending, setPending] = useState(false); const [message, setMessage] = useState<string>();

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!deal || !vehicle) return;
    const form = new FormData(event.currentTarget);
    const amounts = ["vehicle", "fee", "tax", "discount"].map((name) => money(field(form, name)));
    if (amounts.some((amount) => amount === undefined)) { setMessage("Enter valid currency amounts with no more than two decimal places."); return; }
    const [vehicleAmount, fee, tax, discount] = amounts as [number, number, number, number];
    const lines = [
      { category: "vehicle", description: vehicle.label, unitAmountCents: vehicleAmount },
      ...(fee ? [{ category: "fee", description: "Dealer fees", unitAmountCents: fee }] : []),
      ...(tax ? [{ category: "tax", description: "Estimated taxes", unitAmountCents: tax }] : []),
      ...(discount ? [{ category: "discount", description: "Discount", unitAmountCents: -discount }] : []),
    ];
    if (await send(`/api/organizations/${organizationId}/deals/${deal.id}/quotes`, { purchaseType: field(form, "purchaseType"), lines })) setExpanded(false);
  }

  async function transition(toStatus: "presented" | "accepted" | "rejected", reason?: string) {
    if (!quote) return;
    await send(`/api/organizations/${organizationId}/quotes/${quote.id}/transitions`, { toStatus, ...(reason ? { reason } : {}) });
  }

  async function send(url: string, body: Record<string, unknown>) {
    setPending(true); setMessage(undefined);
    try { const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": `quote:${crypto.randomUUID()}` }, body: JSON.stringify(body) }); if (!response.ok) throw new Error(await readProblem(response)); setMessage("Quote updated."); router.refresh(); return true; }
    catch (error) { setMessage(error instanceof Error ? error.message : "The Quote could not be updated."); return false; }
    finally { setPending(false); }
  }

  if (!deal) return null;
  const acceptsVersions = !["contracted", "delivered", "cancelled"].includes(deal.status);
  return <section aria-labelledby="quote-controls-heading" className="rounded-xl border bg-card p-4 text-card-foreground shadow-soft sm:p-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="flex min-w-0 items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-lg bg-muted"><ReceiptText aria-hidden="true" className="size-5 text-muted-foreground" /></span><div><h2 id="quote-controls-heading" className="font-semibold tracking-tight">Purchase quote</h2><p className="mt-1 text-sm text-muted-foreground">{quote ? `Version ${quote.version} · ${quote.status} · ${formatMoney(quote.totalCents, quote.currency)}` : "Create an immutable itemized purchase proposal."}</p>{quote?<Link className="focus-ring mt-2 inline-flex min-h-9 items-center rounded-lg text-sm font-medium text-primary hover:underline" href={`/organizations/${organizationId}/quotes/${quote.id}/print`}>Open printable proposal</Link>:null}</div></div>{canUpdate && vehicle && acceptsVersions && quote && !["draft", "accepted"].includes(quote.status) ? <Button onClick={() => setExpanded((value) => !value)} type="button" variant={expanded ? "outline" : "default"}>{expanded ? "Close" : "New version"}</Button> : null}</div>
    <p aria-live="polite" className="mt-3 text-sm text-muted-foreground" role="status">{message}</p>
    {!canUpdate ? <p className="mt-3 rounded-lg border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">You can view this Quote but do not have permission to update it.</p> : null}
    {canUpdate && !vehicle ? <p className="mt-3 rounded-lg border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">A primary vehicle is required before creating a Quote.</p> : null}
    {canUpdate && vehicle && acceptsVersions && !quote ? <div className="mt-3"><Button onClick={() => setExpanded(true)} type="button">Create quote</Button></div> : null}
    {quote?.status === "draft" && canUpdate ? <div className="mt-4"><Button disabled={pending} onClick={() => transition("presented")} type="button">Mark presented</Button></div> : null}
    {quote?.status === "presented" && canUpdate ? <div className="mt-4 flex flex-wrap gap-2"><Button disabled={pending} onClick={() => transition("accepted")} type="button">Accept quote</Button></div> : null}
    {quote?.status === "presented" && canUpdate ? <form className="mt-3 flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-end" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void transition("rejected", field(form, "reason")); }}><label className="min-w-0 flex-1 text-sm font-medium">Rejection reason<input className={inputClass} maxLength={1000} name="reason" required /></label><Button disabled={pending} type="submit" variant="outline">Reject quote</Button></form> : null}
    {expanded ? <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={create}><label className="text-sm font-medium">Purchase type<select className={inputClass} defaultValue={quote?.purchaseType ?? "finance"} name="purchaseType" required><option value="cash">Cash</option><option value="finance">Finance</option><option value="lease">Lease</option></select></label><Money label="Vehicle amount" name="vehicle" value={vehicle?.listPriceCents} required /><Money label="Fees" name="fee" /><Money label="Estimated taxes" name="tax" /><Money label="Discount" name="discount" /><div className="flex items-end"><Button disabled={pending} type="submit">{pending ? "Saving quote…" : "Save immutable version"}</Button></div></form> : null}
  </section>;
}

const inputClass = "focus-ring mt-1 min-h-11 w-full rounded-lg border bg-background px-3 text-sm text-foreground";
function Money({ label, name, value, required }: { label: string; name: string; value?: number; required?: boolean }) { return <label className="text-sm font-medium">{label}<input className={inputClass} defaultValue={value === undefined ? "" : (value / 100).toFixed(2)} inputMode="decimal" name={name} pattern="[0-9]+(\.[0-9]{1,2})?" required={required} /></label>; }
function money(value: string) { if (!value) return 0; const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value); if (!match) return undefined; const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0")); return Number.isSafeInteger(cents) ? cents : undefined; }
function field(form: FormData, name: string) { const value = form.get(name); return typeof value === "string" ? value.trim() : ""; }
function formatMoney(cents: number, currency: string) { return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100); }
async function readProblem(response: Response) { const payload = (await response.json().catch(() => undefined)) as { message?: unknown; issues?: unknown } | undefined; if (Array.isArray(payload?.issues) && payload.issues.every((item) => typeof item === "string")) return payload.issues.join(" "); return typeof payload?.message === "string" ? payload.message : "The request could not be completed."; }
