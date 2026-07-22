import { AppShell } from "@/components/app-shell";
import { CustomerWorkspace } from "@/components/workspaces/customer/CustomerWorkspace";
import { customerWorkspaceDemo } from "@/components/workspaces/customer/CustomerWorkspace.demo";

export default function CustomerWorkspaceDemoPage() {
  return (
    <AppShell
      activeHref="/customers"
      breadcrumbs={[
        { label: "Customers", href: "/customers" },
        { label: "Jordan Mitchell" },
      ]}
    >
      <CustomerWorkspace {...customerWorkspaceDemo} />
    </AppShell>
  );
}
