import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { featureEntitlementRegistry } from "@/lib/platform/tenant";
import { resolveReleaseInfo } from "@/lib/server/deployment";
import { LocationAdministrationDirectory, MembershipDirectoryReader, RoleAdministrationDirectory } from "@/lib/server/organizations";

import { loadDirectoryContext } from "../../_lib/load-directory-context";

export const dynamic = "force-dynamic";

export default async function AdministrationPage({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  const context = await loadDirectoryContext(organizationId, "organization.configure");
  const scope = { userId: context.session.user.id, organizationId };
  const [locations, memberships, roles] = await Promise.all([
    new LocationAdministrationDirectory(context.pool).list({ ...scope, locationIds: context.membership.locationIds }),
    new MembershipDirectoryReader(context.pool).list(scope),
    new RoleAdministrationDirectory(context.pool).list(scope),
  ]);
  const activeLocations = locations.filter((location) => location.active).length;
  const activeMembers = memberships.filter((membership) => membership.status === "active").length;
  const base = `/organizations/${organizationId}`;
  const release = resolveReleaseInfo(process.env);

  return <AppShell organizationId={organizationId} navigationCapabilities={context.membership.capabilities} activeHref={`${base}/settings/administration`} breadcrumbs={[{ label: context.organization.name }, { label: "Administration" }]} user={{ name: context.session.user.name, email: context.session.user.email, ...(context.session.user.image ? { image: context.session.user.image } : {}) }}>
    <section aria-labelledby="administration-heading" className="mx-auto max-w-7xl">
      <header className="border-b pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary sm:tracking-[0.18em]">Tenant administration</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl" id="administration-heading">Dealership readiness</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Verified organization structure, access, branding, and module availability for this tenant. Subscription and billing status are intentionally excluded until a billing authority is connected.</p>
      </header>

      <section aria-labelledby="structure-heading" className="mt-6">
        <h2 className="text-lg font-semibold" id="structure-heading">Organization structure</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Active locations" value={activeLocations} detail={`${locations.length} total in your authorized scope`} />
          <Metric label="Active members" value={activeMembers} detail={`${memberships.length} total tenant memberships`} />
          <Metric label="Roles" value={roles.length} detail={`${roles.filter((role) => role.system).length} protected system roles`} />
          <Metric label="Location authority" value={context.membership.locationIds === "all" ? "All" : context.membership.locationIds.length} detail={context.membership.locationIds === "all" ? "Includes future locations" : "Explicit location grants"} />
        </dl>
      </section>

      <section aria-labelledby="modules-heading" className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold" id="modules-heading">Module entitlements</h2><p className="mt-1 text-sm text-muted-foreground">Tenant availability is separate from each user&apos;s role and location permissions.</p></div><Link className="focus-ring inline-flex min-h-11 items-center rounded-lg border bg-background px-4 text-sm font-medium hover:bg-muted" href={`${base}/settings/configuration`}>Manage configuration</Link></div>
        <ul className="mt-4 grid gap-4 md:grid-cols-2" role="list">{featureEntitlementRegistry.map((feature) => { const enabled = context.configuration.features[feature.key]; return <li className="rounded-xl border bg-card p-4 shadow-soft sm:p-5" key={feature.key}><div className="flex items-start justify-between gap-3"><div><h3 className="font-medium">{feature.label}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{feature.description}</p></div><span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${enabled ? "bg-success/10 text-success-foreground" : "bg-muted text-muted-foreground"}`}>{enabled ? "Enabled" : "Disabled"}</span></div><p className="mt-3 text-xs text-muted-foreground">{feature.capabilities.length ? `${feature.capabilities.length} governed capabilities` : "No production capability contract yet"}</p></li>; })}</ul>
      </section>

      <section aria-labelledby="controls-heading" className="mt-8 rounded-xl border bg-card p-4 shadow-soft sm:p-5"><h2 className="text-lg font-semibold" id="controls-heading">Administrative controls</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><AdminLink href={`${base}/settings/locations`} label="Locations" detail="Rooftops and timezones"/><AdminLink href={`${base}/settings/team`} label="Team" detail="Members and invitations"/><AdminLink href={`${base}/settings/roles`} label="Roles" detail="Capabilities and access"/><AdminLink href={`${base}/settings/integrations`} label="Integrations" detail="Tenant provider setup"/></div></section>

      <section aria-labelledby="release-heading" className="mt-8 rounded-xl border bg-card p-4 shadow-soft sm:p-5"><h2 className="text-lg font-semibold" id="release-heading">Release identity</h2><dl className="mt-4 grid gap-4 sm:grid-cols-3"><ReleaseDatum label="Environment" value={release.environment}/><ReleaseDatum label="Commit" value={release.commitSha === "unknown" ? "Unavailable" : release.commitSha.slice(0, 12)}/><ReleaseDatum label="Deployed" value={release.deployedAt === "unknown" ? "Unavailable" : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(release.deployedAt))}/></dl><p className="mt-4 text-xs text-muted-foreground">Release identity supports incident correlation. It does not authorize production promotion.</p></section>

      <section aria-labelledby="deferred-heading" className="mt-8 rounded-xl border bg-muted/30 p-4 sm:p-5"><h2 className="font-semibold" id="deferred-heading">Explicitly deferred authorities</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Dealer groups above the organization boundary, cross-tenant platform administration, verified custom domains, subscriptions, invoices, payment methods, usage metering, and support impersonation require dedicated data models, audit controls, and provider integrations. This workspace does not fabricate those states.</p></section>
    </section>
  </AppShell>;
}

function Metric({ label, value, detail }: { label: string; value: string | number; detail: string }) { return <div className="rounded-xl border bg-card p-4 shadow-soft sm:p-5"><dt className="text-sm font-medium text-muted-foreground">{label}</dt><dd className="mt-2 text-3xl font-semibold tracking-tight">{value}</dd><dd className="mt-2 text-xs text-muted-foreground">{detail}</dd></div>; }
function AdminLink({ href, label, detail }: { href: string; label: string; detail: string }) { return <Link className="focus-ring min-h-20 rounded-lg border bg-background p-3 hover:bg-muted" href={href}><span className="block text-sm font-medium">{label}</span><span className="mt-1 block text-xs text-muted-foreground">{detail}</span></Link>; }
function ReleaseDatum({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-medium text-muted-foreground">{label}</dt><dd className="mt-1 break-all text-sm font-medium capitalize">{value}</dd></div>; }
