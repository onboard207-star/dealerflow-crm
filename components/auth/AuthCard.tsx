import type { ReactNode } from "react";
import { Brand } from "@/components/app-shell";
import { ThemeToggle } from "@/components/theme-toggle";

export function AuthCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <main className="grid min-h-dvh place-items-center bg-background p-4 sm:p-8"><div className="absolute right-4 top-4"><ThemeToggle /></div><section aria-labelledby="auth-title" className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-soft sm:p-8"><Brand /><div className="mb-7 mt-8"><h1 id="auth-title" className="text-2xl font-semibold tracking-tight">{title}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p></div>{children}</section></main>;
}
