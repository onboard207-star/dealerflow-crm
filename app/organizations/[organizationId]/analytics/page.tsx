import { AppShell } from "@/components/app-shell";
import { ProviderDisconnectedWorkspace } from "@/components/workspaces/ProviderDisconnectedWorkspace";
import { loadDirectoryContext } from "../_lib/load-directory-context";

export const dynamic = "force-dynamic";

export default async function WebsiteAnalyticsPage({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  const context = await loadDirectoryContext(organizationId, "reports.view");
  const base = `/organizations/${organizationId}/analytics`;
  const tabs = ["Overview", "Traffic", "Leads", "Content", "Conversions", "Reports"].map((label, index) => ({ ...(index === 0 ? { href: base } : {}), label }));
  return (
    <AppShell organizationId={organizationId} navigationCapabilities={context.membership.capabilities} activeHref={base} breadcrumbs={[{ label: context.organization.name }, { label: "Website Analytics" }]} user={{ name: context.session.user.name, email: context.session.user.email, ...(context.session.user.image ? { image: context.session.user.image } : {}) }}>
      <ProviderDisconnectedWorkspace activeHref={base} description="Website traffic, content, lead attribution, and conversion reporting from a verified tenant analytics provider." heading="Website Analytics" providerLabel="Website analytics" requirements={[{ label: "Supported provider", description: "A verified analytics source with tenant-owned access." }, { label: "Property mapping", description: "An explicit mapping between the provider property and this DealerFlow organization." }, { label: "Location scope", description: "Rooftop attribution rules that preserve membership location access." }]} tabs={tabs} />
    </AppShell>
  );
}
