import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AuthCard } from "@/components/auth/AuthCard";
import { LoginForm } from "@/components/auth/LoginForm";
import { getAuth } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Sign in | DealerFlow" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (session) redirect("/select-organization");
  const { returnTo } = await searchParams;
  return <AuthCard title="Welcome back" description="Sign in to your dealership workspace."><LoginForm returnTo={returnTo} /></AuthCard>;
}
