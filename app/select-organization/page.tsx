import { Building2, ChevronRight } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Brand } from "@/components/app-shell";
import { getAuth } from "@/lib/server/auth";
import { getDatabasePool } from "@/lib/server/database";
import { OrganizationDirectory } from "@/lib/server/organizations";

export const dynamic = "force-dynamic";

export default async function SelectOrganizationPage() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const organizations = await new OrganizationDirectory(getDatabasePool()).listForUser(session.user.id);
  if (organizations.length === 1) redirect(`/organizations/${organizations[0]!.id}/workspace`);

  return (
    <main className="grid min-h-dvh place-items-center bg-background p-4 sm:p-8">
      <section aria-labelledby="organization-title" className="w-full max-w-xl rounded-2xl border bg-card p-6 shadow-soft sm:p-8">
        <Brand />
        <div className="mb-6 mt-8">
          <h1 id="organization-title" className="text-2xl font-semibold tracking-tight">Choose a workspace</h1>
          <p className="mt-2 text-sm text-muted-foreground">Only active dealership memberships are shown.</p>
        </div>
        {organizations.length ? (
          <ul className="space-y-2">
            {organizations.map((organization) => (
              <li key={organization.id}>
                <Link className="focus-ring flex min-h-16 items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-muted" href={`/organizations/${organization.id}/workspace`}>
                  <span className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground"><Building2 className="size-5" aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{organization.name}</span><span className="block text-xs capitalize text-muted-foreground">{organization.vertical.replace("-", " ")}</span></span>
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-xl border border-dashed bg-muted/40 p-5 text-sm text-muted-foreground">Your account does not have an active dealership membership. Contact your DealerFlow administrator.</div>
        )}
      </section>
    </main>
  );
}
