import { AlertCircle, CheckCircle2, PlugZap } from "lucide-react";

import { WorkspaceTabs, type WorkspaceTab } from "@/components/workspaces/WorkspaceTabs";

interface ProviderRequirement {
  description: string;
  label: string;
}

export function ProviderDisconnectedWorkspace({
  activeHref,
  description,
  heading,
  providerLabel,
  requirements,
  tabs,
}: {
  activeHref: string;
  description: string;
  heading: string;
  providerLabel: string;
  requirements: readonly ProviderRequirement[];
  tabs: readonly WorkspaceTab[];
}) {
  return (
    <section aria-labelledby="provider-workspace-heading" className="mx-auto max-w-7xl">
      <WorkspaceTabs activeHref={activeHref} label={`${heading} sections`} tabs={tabs} />
      <header className="mt-6 border-b pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Provider workspace</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl" id="provider-workspace-heading">{heading}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
      </header>
      <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <section aria-labelledby="connection-heading" className="rounded-xl border border-dashed bg-muted/20 p-5 sm:p-6">
          <span className="grid size-12 place-items-center rounded-xl border bg-background"><PlugZap aria-hidden="true" className="size-6 text-muted-foreground" /></span>
          <h2 className="mt-4 text-lg font-semibold" id="connection-heading">{providerLabel} is not connected</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">DealerFlow is not receiving authoritative provider data for this workspace. Metrics, trends, publishing results, and conversion claims remain hidden until a verified tenant connection is available.</p>
          <div className="mt-5 flex items-start gap-3 rounded-lg border bg-card p-4 text-sm">
            <AlertCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning-foreground" />
            <p><span className="font-medium">Setup needed.</span> A tenant administrator must configure and verify a supported provider before this workspace can report live activity.</p>
          </div>
        </section>
        <aside aria-labelledby="requirements-heading" className="rounded-xl border bg-card p-5 shadow-soft">
          <h2 className="font-semibold" id="requirements-heading">Connection requirements</h2>
          <ul className="mt-4 space-y-4" role="list">
            {requirements.map((requirement) => (
              <li className="flex items-start gap-3" key={requirement.label}>
                <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span><span className="block text-sm font-medium">{requirement.label}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{requirement.description}</span></span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  );
}
