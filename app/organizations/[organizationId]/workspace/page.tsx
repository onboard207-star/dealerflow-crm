import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { getAuth, PostgresMembershipReader, resolveAuthorizationActor } from "@/lib/server/auth";
import { getDatabasePool } from "@/lib/server/database";
import { OperationalOverviewReader, OrganizationDirectory } from "@/lib/server/organizations";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface WorkspacePageProps {
  params: Promise<{ organizationId: string }>;
}

export default async function OrganizationWorkspacePage({ params }: WorkspacePageProps) {
  const { organizationId } = await params;
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const pool = getDatabasePool();
  const organizations = await new OrganizationDirectory(pool).listForUser(session.user.id);
  const organization = organizations.find((candidate) => candidate.id === organizationId);
  if (!organization) notFound();
  const actor = await resolveAuthorizationActor(
    session.user.id,
    organizationId,
    new PostgresMembershipReader(pool),
  );
  const activeHref = `/organizations/${organizationId}/workspace`;
  const capabilities = actor.memberships[0]?.capabilities ?? [];
  const allowed=(value:typeof capabilities[number])=>capabilities.includes(value);
  const overview=await new OperationalOverviewReader(pool).read({userId:session.user.id,organizationId,locationIds:actor.memberships[0]?.locationIds??[]},{leads:allowed("lead.read"),tasks:allowed("task.read"),appointments:allowed("appointment.read"),showroom:allowed("appointment.read"),deals:allowed("deal.read"),inventory:allowed("inventory.read")});
  const cards=[
    ...(overview.activeLeads!==undefined?[{label:"Active Leads",value:overview.activeLeads,detail:"Open, working, or qualified",href:`/organizations/${organizationId}/leads`}]:[]),
    ...(overview.openTasks!==undefined?[{label:"Open tasks",value:overview.openTasks,detail:"Customer follow-up outstanding",href:`/organizations/${organizationId}/leads`}]:[]),
    ...(overview.appointmentsToday!==undefined?[{label:"Appointments today",value:overview.appointmentsToday,detail:"Scheduled, confirmed, or arrived",href:`/organizations/${organizationId}/leads`}]:[]),
    ...(overview.activeShowroomVisits!==undefined?[{label:"In showroom",value:overview.activeShowroomVisits,detail:"Checked in or actively engaged",href:`/organizations/${organizationId}/leads`}]:[]),
    ...(overview.dealsPendingApproval!==undefined?[{label:"Awaiting approval",value:overview.dealsPendingApproval,detail:"Deals requiring manager action",href:`/organizations/${organizationId}/deals`}]:[]),
    ...(overview.availableInventory!==undefined?[{label:"Available inventory",value:overview.availableInventory,detail:"Units currently available",href:`/organizations/${organizationId}/inventory`}]:[]),
  ];

  return (
    <AppShell
      organizationId={organizationId}
      navigationCapabilities={actor.memberships[0]?.capabilities}
      activeHref={activeHref}
      breadcrumbs={[{ label: organization.name }, { label: "Overview" }]}
      user={{ name: session.user.name, email: session.user.email, ...(session.user.image ? { image: session.user.image } : {}) }}
    >
      <section aria-labelledby="workspace-heading" className="mx-auto max-w-6xl">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Operational overview</p><h1 id="workspace-heading" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{organization.name}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Live work requiring attention across the dealership locations you can access.</p></div>
        {cards.length?<ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3" role="list">{cards.map(card=><li key={card.label}><Link className="focus-ring block min-h-32 rounded-xl border bg-card p-5 shadow-soft transition-colors hover:bg-muted/30" href={card.href}><span className="text-sm font-medium text-muted-foreground">{card.label}</span><strong className="mt-2 block text-3xl font-semibold tracking-tight">{card.value}</strong><span className="mt-2 block text-xs text-muted-foreground">{card.detail}</span></Link></li>)}</ul>:<div className="mt-6 rounded-xl border border-dashed bg-muted/20 p-8 text-center"><h2 className="text-sm font-medium">No operational modules assigned</h2><p className="mt-1 text-sm text-muted-foreground">Ask a tenant administrator to assign a role with workspace access.</p></div>}
      </section>
    </AppShell>
  );
}
