import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import {
  ManageRolesService,
  RoleAdministrationError,
  type ManagedRole,
} from "@/lib/application/organizations";
import type { Capability } from "@/lib/platform/auth";
import {
  PostgresRoleAdministration,
  RoleAdministrationDirectory,
} from "@/lib/server/organizations";
import { loadDirectoryContext } from "../../_lib/load-directory-context";

interface Props {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}

const capabilityGroups: ReadonlyArray<{
  label: string;
  values: readonly Capability[];
}> = [
  { label: "Organization", values: ["organization.configure", "staff.manage"] },
  { label: "Customers", values: ["customer.read", "customer.create", "customer.update"] },
  { label: "Leads", values: ["lead.read", "lead.create", "lead.assign", "lead.update"] },
  { label: "Tasks", values: ["task.read", "task.create", "task.update"] },
  {
    label: "Communications",
    values: ["communication.read", "communication.create", "communication.consent.manage", "communication.send"],
  },
  { label: "Appointments", values: ["appointment.read", "appointment.create", "appointment.update"] },
  { label: "Deals", values: ["deal.read", "deal.create", "deal.update", "deal.approve"] },
  { label: "Inventory", values: ["inventory.read", "inventory.create", "inventory.update"] },
  { label: "Reporting", values: ["reports.view"] },
];

export const dynamic = "force-dynamic";

export default async function RolesPage({ params, searchParams }: Props) {
  const { organizationId } = await params;
  const context = await loadDirectoryContext(organizationId, "organization.configure");
  const membership = context.membership;
  const canManage = membership.locationIds === "all" && membership.capabilities.includes("staff.manage");
  const roles = await new RoleAdministrationDirectory(context.pool).list({
    userId: context.session.user.id,
    organizationId,
  });
  const feedback = await searchParams;
  const base = `/organizations/${organizationId}/settings/roles`;

  return (
    <AppShell
      organizationId={organizationId}
      navigationCapabilities={membership.capabilities}
      activeHref={base}
      breadcrumbs={[{ label: context.organization.name }, { label: "Roles" }]}
      user={{
        name: context.session.user.name,
        email: context.session.user.email,
        ...(context.session.user.image ? { image: context.session.user.image } : {}),
      }}
    >
      <section className="mx-auto max-w-6xl" aria-labelledby="roles-heading">
        <h1 id="roles-heading" className="text-2xl font-semibold tracking-tight">Roles and capabilities</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Define reusable access profiles for dealership staff. System roles remain protected.
        </p>
        {feedback.notice ? <p role="status" className="mt-4 rounded-lg border bg-muted p-3 text-sm">{feedback.notice}</p> : null}
        {feedback.error ? <p role="alert" className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{feedback.error}</p> : null}
        {!canManage ? (
          <p role="note" className="mt-6 rounded-xl border bg-card p-4 text-sm text-muted-foreground shadow-soft">
            Role changes require staff-management permission and access to all locations. Existing roles are shown read-only.
          </p>
        ) : (
          <CreateRoleForm organizationId={organizationId} granted={membership.capabilities} />
        )}
        <div className="mt-6 grid gap-4">
          {roles.map((role) => (
            <RoleCard
              key={role.id}
              organizationId={organizationId}
              role={role}
              granted={membership.capabilities}
              editable={canManage && !role.system}
            />
          ))}
        </div>
      </section>
    </AppShell>
  );
}

function CreateRoleForm({ organizationId, granted }: { organizationId: string; granted: readonly Capability[] }) {
  return (
    <form action={createRole.bind(null, organizationId)} className="mt-6 grid gap-4 rounded-xl border bg-card p-4 shadow-soft sm:p-5">
      <div>
        <h2 className="font-medium">Create custom role</h2>
        <p className="mt-1 text-xs text-muted-foreground">New roles can only contain capabilities you currently hold.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field id="role-key" name="key" label="Role key" hint="Lowercase words separated by hyphens" required />
        <Field id="role-name" name="name" label="Role name" required />
      </div>
      <Field id="role-description" name="description" label="Description" />
      <CapabilityFields granted={granted} selected={[]} prefix="create" />
      <button className="focus-ring h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground sm:w-fit">Create role</button>
    </form>
  );
}

function RoleCard({ organizationId, role, granted, editable }: { organizationId: string; role: ManagedRole; granted: readonly Capability[]; editable: boolean }) {
  return (
    <article className="rounded-xl border bg-card p-4 shadow-soft sm:p-5" aria-labelledby={`role-${role.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={`role-${role.id}`} className="font-medium">{role.name}</h2>
            <span className="rounded-full border bg-muted px-2 py-0.5 text-xs font-medium">{role.system ? "System" : "Custom"}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{role.key} · {role.memberCount} {role.memberCount === 1 ? "member" : "members"}</p>
        </div>
      </div>
      {editable ? (
        <form action={updateRole.bind(null, organizationId)} className="mt-4 grid gap-4">
          <input type="hidden" name="roleId" value={role.id} />
          <input type="hidden" name="expectedUpdatedAt" value={role.updatedAt} />
          <div className="grid gap-4 md:grid-cols-2">
            <Field id={`${role.id}-name`} name="name" label="Role name" defaultValue={role.name} required />
            <Field id={`${role.id}-description`} name="description" label="Description" defaultValue={role.description ?? ""} />
          </div>
          <CapabilityFields granted={granted} selected={role.capabilities} prefix={role.id} />
          <button className="focus-ring h-9 rounded-lg border bg-background px-3 text-sm font-medium hover:bg-muted sm:w-fit">Save role</button>
        </form>
      ) : (
        <div className="mt-4">
          {role.description ? <p className="text-sm text-muted-foreground">{role.description}</p> : null}
          <p className="mt-3 text-xs leading-5 text-muted-foreground">{role.capabilities.map(formatCapability).join(" · ")}</p>
        </div>
      )}
    </article>
  );
}

function Field({ id, name, label, hint, ...props }: { id: string; name: string; label: string; hint?: string; required?: boolean; defaultValue?: string }) {
  return <div className="space-y-1"><label htmlFor={id} className="text-sm font-medium">{label}</label><input id={id} name={name} className="focus-ring h-10 w-full rounded-lg border bg-background px-3 text-sm" {...props} />{hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}</div>;
}

function CapabilityFields({ granted, selected, prefix }: { granted: readonly Capability[]; selected: readonly Capability[]; prefix: string }) {
  return <fieldset><legend className="text-sm font-medium">Capabilities</legend><div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{capabilityGroups.map(group => { const values = group.values.filter(value => granted.includes(value)); return values.length ? <div key={group.label}><h3 className="text-xs font-medium text-muted-foreground">{group.label}</h3><div className="mt-2 grid gap-2">{values.map(value => <label key={value} htmlFor={`${prefix}-${value}`} className="flex items-start gap-2 text-sm"><input id={`${prefix}-${value}`} type="checkbox" name="capabilities" value={value} defaultChecked={selected.includes(value)} className="mt-0.5" />{formatCapability(value)}</label>)}</div></div> : null; })}</div></fieldset>;
}

function formatCapability(value: Capability) {
  return value.split(".").map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

async function createRole(organizationId: string, formData: FormData) {
  "use server";
  await mutateRole(organizationId, formData, "create");
}

async function updateRole(organizationId: string, formData: FormData) {
  "use server";
  await mutateRole(organizationId, formData, "update");
}

async function mutateRole(organizationId: string, formData: FormData, operation: "create" | "update") {
  const base = `/organizations/${organizationId}/settings/roles`;
  try {
    const context = await loadDirectoryContext(organizationId, "organization.configure");
    const service = new ManageRolesService(new PostgresRoleAdministration(context.pool));
    const common = {
      actor: context.actor,
      organizationId,
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
      capabilities: formData.getAll("capabilities").map(String),
    };
    if (operation === "create") {
      await service.create({ ...common, key: String(formData.get("key") ?? "") });
    } else {
      await service.update({
        ...common,
        roleId: String(formData.get("roleId") ?? ""),
        expectedUpdatedAt: String(formData.get("expectedUpdatedAt") ?? ""),
      });
    }
    revalidatePath(base);
  } catch (error) {
    redirect(`${base}?error=${encodeURIComponent(error instanceof RoleAdministrationError ? error.message : "The role could not be saved.")}`);
  }
  redirect(`${base}?notice=${encodeURIComponent(operation === "create" ? "Role created." : "Role updated.")}`);
}
