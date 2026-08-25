import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/AuthCard";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = { title: "Choose a new password | DealerFlow" };
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const parameters = await searchParams;
  return <AuthCard title="Choose a new password" description="Create a strong password for your DealerFlow account."><ResetPasswordForm token={parameters.token} invalid={Boolean(parameters.error)} /></AuthCard>;
}
