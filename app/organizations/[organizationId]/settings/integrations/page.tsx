import { AppShell } from "@/components/app-shell";
import { TwilioIntegrationForm } from "@/components/integrations/TwilioIntegrationForm";
import { IntegrationDirectoryReader } from "@/lib/server/integrations";
import { LocationDirectoryReader } from "@/lib/server/organizations/location-directory";
import { loadDirectoryContext } from "../../_lib/load-directory-context";

export const dynamic = "force-dynamic";
interface Props { params: Promise<{ organizationId: string }> }

export default async function IntegrationsPage({ params }: Props) {
  const { organizationId } = await params;
  const context = await loadDirectoryContext(organizationId, "organization.configure");
  const [integrations, locations] = await Promise.all([
    new IntegrationDirectoryReader(context.pool).listTwilio({ userId: context.session.user.id,
      organizationId, locationIds: context.membership.locationIds }),
    new LocationDirectoryReader(context.pool).listActive({ userId: context.session.user.id,
      organizationId, locationIds: context.membership.locationIds }),
  ]);
  const base = `/organizations/${organizationId}/settings/integrations`;
  return <AppShell organizationId={organizationId} navigationCapabilities={context.membership.capabilities} activeHref={base} breadcrumbs={[{ label: context.organization.name }, { label: "Integrations" }]} user={{ name: context.session.user.name, email: context.session.user.email, ...(context.session.user.image ? { image: context.session.user.image } : {}) }}>
    <section aria-labelledby="integrations-heading" className="mx-auto max-w-5xl"><h1 className="text-2xl font-semibold tracking-tight" id="integrations-heading">Integrations</h1><p className="mt-1 text-sm text-muted-foreground">Provision tenant-owned provider connections without storing credentials in DealerFlow.</p>
      <TwilioIntegrationForm allowOrganizationWide={context.membership.locationIds === "all"} locations={locations} organizationId={organizationId}/>
      <section aria-labelledby="twilio-connections-heading" className="mt-8 overflow-hidden rounded-xl border bg-card shadow-soft"><div className="border-b p-4 sm:p-5"><h2 className="font-semibold" id="twilio-connections-heading">Twilio connections</h2><p className="mt-1 text-sm text-muted-foreground">Only non-secret operational metadata is shown.</p></div>
        {integrations.length ? <ul className="divide-y" role="list">{integrations.map((integration) => <li className="grid gap-2 p-4 text-sm sm:grid-cols-[1fr_auto] sm:items-center sm:p-5" key={integration.id}><div><p className="font-medium">{integration.locationName ?? "All locations"} · Account ending {integration.accountSuffix}</p><p className="mt-1 break-all text-xs text-muted-foreground">{integration.defaultFromAddress ?? "No sender configured"} · {integration.publicBaseUrl}</p></div><div className="sm:text-right"><span className={integration.active ? "rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success" : "rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"}>{integration.active ? "Active" : "Inactive"}</span><p className="mt-2 text-xs text-muted-foreground">Updated {new Date(integration.updatedAt).toLocaleString("en-US")}</p></div></li>)}</ul> : <p className="p-6 text-sm text-muted-foreground">No Twilio sender has been provisioned for your available locations.</p>}
      </section>
    </section>
  </AppShell>;
}
