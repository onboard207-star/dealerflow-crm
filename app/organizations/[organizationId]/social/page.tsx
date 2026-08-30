import { AppShell } from "@/components/app-shell";
import { ProviderDisconnectedWorkspace } from "@/components/workspaces/ProviderDisconnectedWorkspace";
import { loadDirectoryContext } from "../_lib/load-directory-context";

export const dynamic = "force-dynamic";

export default async function SocialMediaPage({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  const context = await loadDirectoryContext(organizationId, "reports.view");
  const base = `/organizations/${organizationId}/social`;
  const tabs = ["Overview", "Content", "Calendar", "Engagement", "Reports", "Inbox"].map((label, index) => ({ ...(index === 0 ? { href: base } : {}), label }));
  return (
    <AppShell organizationId={organizationId} navigationCapabilities={context.membership.capabilities} activeHref={base} breadcrumbs={[{ label: context.organization.name }, { label: "Social Media" }]} user={{ name: context.session.user.name, email: context.session.user.email, ...(context.session.user.image ? { image: context.session.user.image } : {}) }}>
      <ProviderDisconnectedWorkspace activeHref={base} description="Cross-platform content, engagement, scheduling, and inbox operations from verified dealership-owned social accounts." heading="Social Media" providerLabel="Social media providers" requirements={[{ label: "Provider authorization", description: "Explicit tenant authorization for each dealership-owned platform account." }, { label: "Account mapping", description: "Verified organization and rooftop ownership for every connected account." }, { label: "Confirmed outcomes", description: "Publishing and reply results remain pending until the provider confirms success." }]} tabs={tabs} />
    </AppShell>
  );
}
