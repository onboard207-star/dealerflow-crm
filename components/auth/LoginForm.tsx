"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/client/auth";

export function LoginForm({ returnTo = "/select-organization" }: { returnTo?: string }) {
  const safeReturnTo = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/select-organization";
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string>();
  const [verificationQueued, setVerificationQueued] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    setUnverifiedEmail(undefined);
    setVerificationQueued(false);
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const result = await authClient.signIn.email({ email, password });
    if (result.error) {
      if (result.error.status === 403) {
        setError("Verify this email address before signing in.");
        setUnverifiedEmail(email);
      } else setError("The email or password is incorrect, or this account is unavailable.");
      setPending(false);
      return;
    }
    router.replace(safeReturnTo);
    router.refresh();
  }

  async function resendVerification() {
    if (!unverifiedEmail) return;
    setPending(true);
    await authClient.sendVerificationEmail({ email: unverifiedEmail, callbackURL: safeReturnTo });
    setVerificationQueued(true);
    setPending(false);
  }

  return (
    <form className="space-y-5" onSubmit={submit} aria-describedby={error ? "login-error" : undefined}>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="email">Email</label>
        <input className="focus-ring h-11 w-full rounded-lg border bg-background px-3 text-sm placeholder:text-muted-foreground" id="email" name="email" type="email" autoComplete="email" required disabled={pending} />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <label className="text-sm font-medium" htmlFor="password">Password</label>
          <Link className="focus-ring rounded text-sm font-medium text-primary hover:underline" href="/forgot-password">Forgot password?</Link>
        </div>
        <input className="focus-ring h-11 w-full rounded-lg border bg-background px-3 text-sm" id="password" name="password" type="password" autoComplete="current-password" minLength={12} required disabled={pending} />
      </div>
      {error ? <p id="login-error" role="alert" className="rounded-lg border bg-muted px-3 py-2 text-sm">{error}</p> : null}
      {unverifiedEmail ? <Button className="w-full" type="button" variant="outline" disabled={pending || verificationQueued} onClick={resendVerification}>{verificationQueued ? "Verification instructions queued" : "Send verification instructions"}</Button> : null}
      <Button className="h-11 w-full" type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</Button>
    </form>
  );
}
