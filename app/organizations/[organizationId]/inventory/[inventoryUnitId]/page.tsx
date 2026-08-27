import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock3, MapPin, Users } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { InventoryUnitControls } from "@/components/inventory/InventoryUnitControls";
import { InventoryMediaUpload } from "@/components/inventory/InventoryMediaUpload";
import { VerifiedVehicleMedia } from "@/components/inventory/VerifiedVehicleMedia";
import { Button } from "@/components/ui/button";
import { VehicleWorkspaceReader } from "@/lib/server/vehicles";
import { inventoryMediaStorageAvailable } from "@/lib/server/vehicles/media-manager-factory";
import { loadDirectoryContext } from "../../_lib/load-directory-context";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ organizationId: string; inventoryUnitId: string }>;
}

export default async function VehicleWorkspacePage({ params }: PageProps) {
  const { organizationId, inventoryUnitId } = await params;
  const context = await loadDirectoryContext(organizationId, "inventory.read");
  const capabilities = context.membership.capabilities;
  const record = await new VehicleWorkspaceReader(context.pool).read(
    {
      userId: context.session.user.id,
      organizationId,
      locationIds: context.membership.locationIds,
      includeCustomerMatches: capabilities.includes("customer.read") && capabilities.includes("lead.read"),
      includeDeals: capabilities.includes("deal.read"),
    },
    inventoryUnitId,
  );

  if (!record) notFound();

  const inventoryHref = `/organizations/${organizationId}/inventory`;
  const vehicleName = [record.vehicle.year, record.vehicle.make, record.vehicle.model, record.vehicle.trim]
    .filter(Boolean)
    .join(" ");
  const canUpdate = capabilities.includes("inventory.update");
  const canManageMedia = canUpdate && inventoryMediaStorageAvailable();

  return (
    <AppShell
      organizationId={organizationId}
      navigationCapabilities={capabilities}
      activeHref={inventoryHref}
      breadcrumbs={[
        { label: context.organization.name, href: `/organizations/${organizationId}/workspace` },
        { label: "Inventory", href: inventoryHref },
        { label: record.inventory.stockNumber },
      ]}
      user={{
        name: context.session.user.name,
        email: context.session.user.email,
        ...(context.session.user.image ? { image: context.session.user.image } : {}),
      }}
    >
      <article className="mx-auto max-w-7xl" aria-labelledby="vehicle-heading">
        <Button asChild size="sm" variant="ghost">
          <Link href={inventoryHref}>
            <ArrowLeft aria-hidden="true" className="size-4" />
            Inventory
          </Link>
        </Button>

        <header className="mt-4 flex flex-col gap-4 border-b pb-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border bg-muted px-2.5 py-1 text-xs font-medium capitalize">
                {record.inventory.status}
              </span>
              <span className="text-xs text-muted-foreground">Stock {record.inventory.stockNumber}</span>
            </div>
            <h1 id="vehicle-heading" className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              {vehicleName}
            </h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>VIN {record.vehicle.vin}</span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin aria-hidden="true" className="size-4" />
                {record.inventory.locationName}
              </span>
            </p>
          </div>
          {canUpdate ? (
            <div className="w-full lg:max-w-xl">
              <InventoryUnitControls
                item={{
                  inventoryId: record.inventory.id,
                  status: record.inventory.status,
                  updatedAt: record.inventory.updatedAt,
                  ...(record.inventory.listPriceCents !== undefined
                    ? { listPriceCents: record.inventory.listPriceCents }
                    : {}),
                }}
                organizationId={organizationId}
              />
            </div>
          ) : null}
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
          <div className="space-y-6">
            <VerifiedVehicleMedia assets={record.media} management={canManageMedia ? { organizationId, inventoryUnitId } : undefined} />
            {canManageMedia ? <InventoryMediaUpload organizationId={organizationId} inventoryUnitId={inventoryUnitId} /> : null}

            <section className="rounded-xl border bg-card p-5 shadow-soft sm:p-6" aria-labelledby="details-heading">
              <h2 id="details-heading" className="text-lg font-semibold">Vehicle details</h2>
              <dl className="mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
                <Fact label="List price" value={formatPrice(record.inventory.listPriceCents)} />
                <Fact label="Status" value={record.inventory.status} capitalize />
                <Fact label="Location" value={record.inventory.locationName} />
                <Fact label="Stock number" value={record.inventory.stockNumber} />
                <Fact label="VIN" value={record.vehicle.vin} />
                <Fact label="Exterior color" value={record.vehicle.exteriorColor ?? "Not available"} />
                <Fact label="Acquired" value={formatDate(record.inventory.acquiredAt)} />
                <Fact label="Sold" value={formatDate(record.inventory.soldAt)} />
                <Fact label="Last updated" value={formatDate(record.inventory.updatedAt)} />
              </dl>
            </section>

            <section className="rounded-xl border bg-card p-5 shadow-soft sm:p-6" aria-labelledby="activity-heading">
              <div className="flex items-center gap-2">
                <Clock3 aria-hidden="true" className="size-5 text-muted-foreground" />
                <h2 id="activity-heading" className="text-lg font-semibold">Inventory activity</h2>
              </div>
              {record.events.length ? (
                <ol className="mt-5 space-y-4 border-l pl-5">
                  {record.events.map((event) => (
                    <li key={event.id} className="relative">
                      <span aria-hidden="true" className="absolute -left-[1.57rem] top-1.5 size-2 rounded-full bg-primary" />
                      <p className="text-sm font-medium capitalize">{eventLabel(event.kind)}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {event.fromStatus ? `${event.fromStatus} to ` : ""}{event.toStatus}
                        {event.newPriceCents !== undefined ? ` · ${formatPrice(event.newPriceCents)}` : ""}
                      </p>
                      {event.reason ? <p className="mt-1 text-sm">{event.reason}</p> : null}
                      <time className="mt-1 block text-xs text-muted-foreground" dateTime={event.occurredAt}>
                        {formatDateTime(event.occurredAt)}
                      </time>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">No inventory activity has been recorded.</p>
              )}
            </section>
          </div>

          <aside className="space-y-6" aria-label="Vehicle relationships">
            {capabilities.includes("customer.read") && capabilities.includes("lead.read") ? (
              <section className="rounded-xl border bg-card p-5 shadow-soft" aria-labelledby="matches-heading">
                <div className="flex items-center gap-2">
                  <Users aria-hidden="true" className="size-5 text-muted-foreground" />
                  <h2 id="matches-heading" className="font-semibold">Interested customers</h2>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Exact active vehicle interests only.</p>
                {record.matches.length ? (
                  <ul className="mt-4 divide-y" role="list">
                    {record.matches.map((match) => (
                      <li key={match.interestId} className="py-3 first:pt-0 last:pb-0">
                        <Link
                          className="focus-ring -m-1 block rounded-md p-1 hover:text-primary"
                          href={`/organizations/${organizationId}/customers/${match.customerId}`}
                        >
                          <span className="block text-sm font-medium">{match.customerName}</span>
                          <span className="mt-1 block text-xs capitalize text-muted-foreground">
                            {match.role} · {match.leadStage} · {match.leadStatus}
                          </span>
                          {match.assignedUserName ? (
                            <span className="mt-1 block text-xs text-muted-foreground">Owner: {match.assignedUserName}</span>
                          ) : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-sm text-muted-foreground">No active customers are linked to this exact vehicle.</p>
                )}
              </section>
            ) : null}

            {capabilities.includes("deal.read") ? (
              <section className="rounded-xl border bg-card p-5 shadow-soft" aria-labelledby="deals-heading">
                <h2 id="deals-heading" className="font-semibold">Related deals</h2>
                {record.deals.length ? (
                  <ul className="mt-4 divide-y" role="list">
                    {record.deals.map((deal) => (
                      <li key={deal.id} className="py-3 first:pt-0 last:pb-0">
                        <Link
                          className="focus-ring -m-1 block rounded-md p-1 hover:text-primary"
                          href={`/organizations/${organizationId}/customers/${deal.customerId}`}
                        >
                          <span className="block text-sm font-medium">{deal.dealNumber}</span>
                          <span className="mt-1 block text-xs text-muted-foreground">{deal.customerName}</span>
                          <span className="mt-1 block text-xs capitalize text-muted-foreground">
                            {deal.status}{deal.agreedPriceCents !== undefined ? ` · ${formatPrice(deal.agreedPriceCents)}` : ""}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-sm text-muted-foreground">No deals are linked to this inventory unit.</p>
                )}
              </section>
            ) : null}
          </aside>
        </div>
      </article>
    </AppShell>
  );
}

function Fact({ label, value, capitalize = false }: { label: string; value: string; capitalize?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`mt-1 break-words text-sm font-medium${capitalize ? " capitalize" : ""}`}>{value}</dd>
    </div>
  );
}

function formatPrice(cents?: number) {
  if (cents === undefined) return "Not listed";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDate(value?: string) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function eventLabel(kind: string) {
  if (kind === "created") return "Added to inventory";
  if (kind === "pricing") return "Price updated";
  if (kind === "status") return "Status updated";
  return "Inventory updated";
}
