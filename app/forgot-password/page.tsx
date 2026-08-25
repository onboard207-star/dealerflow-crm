import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/AuthCard";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = { title: "Reset password | DealerFlow" };
export default function ForgotPasswordPage() {
  return <AuthCard title="Reset your password" description="Enter your account email and we’ll send secure reset instructions."><ForgotPasswordForm /></AuthCard>;
}
