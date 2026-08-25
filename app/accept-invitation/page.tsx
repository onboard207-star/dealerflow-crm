import type { Metadata } from "next";
import { headers } from "next/headers";
import { AuthCard } from "@/components/auth/AuthCard";
import { AcceptInvitation } from "@/components/auth/AcceptInvitation";
import { getAuth } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Accept invitation | DealerFlow" };
export const dynamic = "force-dynamic";
export default async function AcceptInvitationPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const [{ token }, session] = await Promise.all([searchParams, getAuth().api.getSession({ headers: await headers() })]);
  return <AuthCard title="Join your dealership" description="Use the invited email address. DealerFlow verifies every account before granting workspace access.">{token ? <AcceptInvitation token={token} authenticated={Boolean(session)} /> : <p role="alert" className="rounded-lg border bg-muted p-3 text-sm">This invitation link is incomplete.</p>}</AuthCard>;
}
