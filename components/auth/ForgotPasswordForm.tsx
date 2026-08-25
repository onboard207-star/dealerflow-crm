"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/client/auth";

export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false);
  const [complete, setComplete] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    await authClient.requestPasswordReset({ email, redirectTo: `${window.location.origin}/reset-password` });
    setComplete(true);
    setPending(false);
  }

  if (complete) {
    return <div className="space-y-5"><p role="status" className="rounded-lg border bg-muted px-4 py-3 text-sm leading-6">If an eligible account exists for that address, password reset instructions have been queued.</p><Button asChild className="w-full"><Link href="/login">Return to sign in</Link></Button></div>;
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="recovery-email">Email</label>
        <input className="focus-ring h-11 w-full rounded-lg border bg-background px-3 text-sm placeholder:text-muted-foreground" id="recovery-email" name="email" type="email" autoComplete="email" required disabled={pending} />
      </div>
      <Button className="h-11 w-full" type="submit" disabled={pending}>{pending ? "Requesting…" : "Send reset instructions"}</Button>
      <Button asChild variant="ghost" className="w-full"><Link href="/login">Back to sign in</Link></Button>
    </form>
  );
}
