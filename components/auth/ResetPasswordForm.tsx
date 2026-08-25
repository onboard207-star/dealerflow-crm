"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/client/auth";

export function ResetPasswordForm({ token, invalid }: { token?: string; invalid: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [complete, setComplete] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setPending(true);
    setError(undefined);
    const data = new FormData(event.currentTarget);
    const newPassword = String(data.get("password") ?? "");
    const confirmation = String(data.get("confirmation") ?? "");
    if (newPassword !== confirmation) {
      setError("The passwords do not match.");
      setPending(false);
      return;
    }
    const result = await authClient.resetPassword({ newPassword, token });
    if (result.error) {
      setError("This reset link is invalid or has expired. Request a new one.");
      setPending(false);
      return;
    }
    setComplete(true);
    setPending(false);
  }

  if (complete) return <div className="space-y-5"><p role="status" className="rounded-lg border bg-muted px-4 py-3 text-sm">Your password has been reset and existing sessions have been revoked.</p><Button asChild className="w-full"><Link href="/login">Sign in</Link></Button></div>;
  if (!token || invalid) return <div className="space-y-5"><p role="alert" className="rounded-lg border bg-muted px-4 py-3 text-sm">This reset link is invalid or has expired.</p><Button asChild className="w-full"><Link href="/forgot-password">Request a new link</Link></Button></div>;

  return (
    <form className="space-y-5" onSubmit={submit} aria-describedby={error ? "reset-error" : "password-guidance"}>
      <p id="password-guidance" className="text-sm text-muted-foreground">Use at least 12 characters.</p>
      <PasswordField id="new-password" name="password" label="New password" pending={pending} autoComplete="new-password" />
      <PasswordField id="confirm-password" name="confirmation" label="Confirm password" pending={pending} autoComplete="new-password" />
      {error ? <p id="reset-error" role="alert" className="rounded-lg border bg-muted px-3 py-2 text-sm">{error}</p> : null}
      <Button className="h-11 w-full" type="submit" disabled={pending}>{pending ? "Resetting…" : "Reset password"}</Button>
    </form>
  );
}

function PasswordField({ id, name, label, pending, autoComplete }: { id: string; name: string; label: string; pending: boolean; autoComplete: string }) {
  return <div className="space-y-2"><label className="text-sm font-medium" htmlFor={id}>{label}</label><input className="focus-ring h-11 w-full rounded-lg border bg-background px-3 text-sm" id={id} name={name} type="password" autoComplete={autoComplete} minLength={12} maxLength={128} required disabled={pending} /></div>;
}
