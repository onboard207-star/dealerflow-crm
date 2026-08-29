import { AppShell } from "@/components/app-shell";
import Link from "next/link";
import { InventoryRegistrationForm } from "@/components/inventory/InventoryRegistrationForm";
import { InventoryUnitControls } from "@/components/inventory/InventoryUnitControls";
import { InventoryCardMedia } from "@/components/inventory/InventoryCardMedia";
import { InventoryDirectoryReader } from "@/lib/server/vehicles";
import { LocationDirectoryReader } from "@/lib/server/organizations/location-directory";
import { loadDirectoryContext } from "../_lib/load-directory-context";

export const dynamic = "force-dynamic";
interface PageProps { params: Promise<{ organizationId: string }>; searchParams: Promise<{ q?: string; status?: string }> }

export default async function InventoryPage({ params, searchParams }: PageProps) {
  const { organizationId } = await params; const filters = await searchParams;
  const context = await loadDirectoryContext(organizationId, "inventory.read");
  const page = await new InventoryDirectoryReader(context.pool).list({ userId: context.session.user.id,
    organizationId, locationIds: context.membership.locationIds }, { search: filters.q, status: filters.status, limit: 50 });
  const canCreate = context.membership.capabilities.includes("inventory.create");
  const canUpdate=context.membership.capabilities.includes("inventory.update");
  const locations = canCreate ? await new LocationDirectoryReader(context.pool).listActive({ userId: context.session.user.id, organizationId, locationIds: context.membership.locationIds }) : [];
  const base = `/organizations/${organizationId}/inventory`;
  return <AppShell organizationId={organizationId} navigationCapabilities={context.membership.capabilities} activeHref={base}
    breadcrumbs={[{ label: context.organization.name }, { label: "Inventory" }]}
    user={{ name: context.session.user.name, email: context.session.user.email, ...(context.session.user.image ? { image: context.session.user.image } : {}) }}>
    <section className="mx-auto max-w-7xl" aria-labelledby="inventory-heading">
      <div><h1 id="inventory-heading" className="text-2xl font-semibold tracking-tight">Inventory</h1><p className="mt-1 text-sm text-muted-foreground">Canonical vehicles currently visible to your assigned locations.</p></div>
      {canCreate ? <InventoryRegistrationForm locations={locations} organizationId={organizationId} /> : null}
      <form action={base} className="mt-5 grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_12rem_auto]">
        <label className="space-y-1 text-xs font-medium text-muted-foreground">Vehicle search<input name="q" defaultValue={filters.q} maxLength={100} placeholder="Stock, VIN, year, make, or model" className="focus-ring block h-10 w-full rounded-lg border bg-background px-3 text-sm text-foreground" /></label>
        <label className="space-y-1 text-xs font-medium text-muted-foreground">Status<select name="status" defaultValue={filters.status ?? ""} className="focus-ring block h-10 w-full rounded-lg border bg-background px-3 text-sm text-foreground"><option value="">All statuses</option><option value="available">Available</option><option value="hold">Hold</option><option value="sold">Sold</option><option value="unavailable">Unavailable</option></select></label>
        <button className="focus-ring h-10 self-end rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">Apply</button>
      </form>
      <div className="mt-5 overflow-hidden rounded-xl border bg-card shadow-soft">
        {page.records.length ? <ul className="divide-y" role="list">{page.records.map((item) => <li key={item.inventoryId} className="grid gap-3 p-4 sm:grid-cols-[minmax(22rem,2fr)_repeat(3,minmax(8rem,1fr))] sm:items-center sm:p-5">
          <Link aria-label={`Open ${item.year} ${item.make} ${item.model}, stock ${item.stockNumber}`} className="focus-ring -m-2 grid min-w-0 gap-3 rounded-lg p-2 hover:bg-accent hover:text-accent-foreground sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center" href={`${base}/${item.inventoryId}`}><InventoryCardMedia image={item.primaryImage} label={`${item.year} ${item.make} ${item.model}`}/><span className="min-w-0"><span className="block truncate text-sm font-medium">{item.year} {item.make} {item.model}{item.trim ? ` ${item.trim}` : ""}</span><span className="block break-all text-xs text-muted-foreground">{item.vin}</span><span className="mt-1 block text-xs font-medium text-primary">Open vehicle workspace</span></span></Link>
          <Fact label="Stock" value={item.stockNumber} /><Fact label="Status" value={item.status} /><span><Fact label="Price" value={item.listPriceCents !== undefined ? formatPrice(item.listPriceCents) : "Not listed"} />{canUpdate?<InventoryUnitControls item={item} organizationId={organizationId}/>:null}</span>
        </li>)}</ul> : <div className="p-8 text-center text-sm text-muted-foreground">No inventory matches these filters.</div>}
      </div>
    </section>
  </AppShell>;
}

function Fact({ label, value }: { label: string; value: string }) { return <span><span className="block text-[11px] text-muted-foreground">{label}</span><span className="block truncate text-sm capitalize">{value}</span></span>; }
function formatPrice(cents: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100); }
