"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/client/auth";

export function AcceptInvitation({ token, authenticated }: { token: string; authenticated: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const returnTo = `/accept-invitation?token=${encodeURIComponent(token)}`;
  async function accept() {
    setPending(true);
    const response = await fetch("/api/invitations/accept", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
    const body: unknown = await response.json();
    if (!response.ok || !isOrganization(body)) { setError("This invitation is invalid, expired, or belongs to another account."); setPending(false); return; }
    router.replace(`/organizations/${body.organizationId}/workspace`);
    router.refresh();
  }
  async function signUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(undefined);
    const data = new FormData(event.currentTarget);
    const result = await authClient.signUp.email({ name: String(data.get("name") ?? "").trim(), email: String(data.get("email") ?? "").trim(), password: String(data.get("password") ?? ""), callbackURL: returnTo });
    if (result.error) { setError("The account could not be created. Confirm the details or sign in if an account already exists."); setPending(false); return; }
    router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
  if (authenticated) return <div className="space-y-4">{error ? <p role="alert" className="rounded-lg border bg-muted p-3 text-sm">{error}</p> : null}<Button className="w-full" disabled={pending} onClick={accept}>{pending ? "Accepting…" : "Accept invitation"}</Button></div>;
  return <div className="space-y-5"><Button asChild className="w-full"><Link href={`/login?returnTo=${encodeURIComponent(returnTo)}`}>Sign in to accept</Link></Button><div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border"/><span>or create an account</span><span className="h-px flex-1 bg-border"/></div><form className="space-y-4" onSubmit={signUp}><Field id="invite-name" name="name" label="Full name" autoComplete="name"/><Field id="invite-email" name="email" label="Invited email" type="email" autoComplete="email"/><Field id="invite-password" name="password" label="Password" type="password" autoComplete="new-password" minLength={12}/>{error ? <p role="alert" className="rounded-lg border bg-muted p-3 text-sm">{error}</p> : null}<Button variant="outline" className="w-full" disabled={pending}>{pending ? "Creating account…" : "Create account"}</Button></form></div>;
}
function Field({ id, name, label, type="text", autoComplete, minLength }: { id:string; name:string; label:string; type?:string; autoComplete:string; minLength?:number }) { return <div className="space-y-2"><label htmlFor={id} className="text-sm font-medium">{label}</label><input id={id} name={name} type={type} autoComplete={autoComplete} minLength={minLength} maxLength={128} required className="focus-ring h-11 w-full rounded-lg border bg-background px-3 text-sm"/></div>; }
function isOrganization(value: unknown): value is { organizationId: string } { return typeof value === "object" && value !== null && "organizationId" in value && typeof value.organizationId === "string"; }
