import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock3, MapPin, Users } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { InventoryUnitControls } from "@/components/inventory/InventoryUnitControls";
import { InventoryMediaUpload } from "@/components/inventory/InventoryMediaUpload";
import { VehicleCatalogMatchControl } from "@/components/inventory/VehicleCatalogMatchControl";
import { VerifiedVehicleMedia } from "@/components/inventory/VerifiedVehicleMedia";
import { Button } from "@/components/ui/button";
import { VehicleConfigurationMatchService } from "@/lib/application/vehicle-catalog";
import { PostgresVehicleConfigurationMatchProvider, VehicleWorkspaceReader } from "@/lib/server/vehicles";
import { inventoryMediaStorageAvailable } from "@/lib/server/vehicles/media-manager-factory";
import { loadDirectoryContext } from "../../_lib/load-directory-context";
import { matchVehicleConfigurationAction } from "./actions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ organizationId: string; inventoryUnitId: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}

export default async function VehicleWorkspacePage({ params, searchParams }: PageProps) {
  const { organizationId, inventoryUnitId } = await params;
  const query = await searchParams;
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
  const catalogCandidates = canUpdate && !record.catalogIntelligence
    ? await new VehicleConfigurationMatchService(
        new PostgresVehicleConfigurationMatchProvider(context.pool, {
          userId: context.session.user.id,
          organizationId,
        }),
      ).candidates({ actor: context.actor, organizationId, vehicleId: record.inventory.vehicleId })
    : undefined;

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

        {query.notice ? <p className="mt-4 rounded-lg border bg-muted p-3 text-sm" role="status">{query.notice}</p> : null}
        {query.error ? <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">{query.error}</p> : null}

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
              <span className="break-all">VIN {record.vehicle.vin}</span>
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

            {catalogCandidates ? (
              <VehicleCatalogMatchControl
                action={matchVehicleConfigurationAction.bind(null, organizationId, inventoryUnitId, record.inventory.vehicleId)}
                configurations={catalogCandidates.configurations}
              />
            ) : null}

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
              <p className="mt-5 border-t pt-4 text-xs text-muted-foreground">List price is the current inventory asking price. An accepted customer selling price is an immutable Deal/Quote fact and appears under Related deals.</p>
            </section>

            {record.catalogIntelligence ? (
              <section className="rounded-xl border bg-card p-5 shadow-soft sm:p-6" aria-labelledby="intelligence-heading">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Verified catalog match</p>
                    <h2 id="intelligence-heading" className="mt-1 text-lg font-semibold">Vehicle intelligence</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Governed configuration facts; physical inventory facts remain authoritative above.</p>
                  </div>
                  <span className="w-fit rounded-full border bg-muted px-2.5 py-1 text-xs font-medium capitalize">
                    {record.catalogIntelligence.readiness.replace("-", " ")}
                  </span>
                </div>
                <dl className="mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
                  <Fact label="Configuration" value={record.catalogIntelligence.configurationName} />
                  <Fact label="Powertrain" value={record.catalogIntelligence.powertrain ?? "Not declared"} />
                  <Fact label="Drivetrain" value={record.catalogIntelligence.drivetrain ?? "Not declared"} />
                  <Fact label="Engine" value={record.catalogIntelligence.engine ?? "Not declared"} />
                  <Fact label="Transmission" value={record.catalogIntelligence.transmission ?? "Not declared"} />
                  <Fact label="Body style" value={record.catalogIntelligence.bodyStyle ?? "Not declared"} />
                  <Fact label="Seating" value={record.catalogIntelligence.seatCount === undefined ? "Not declared" : String(record.catalogIntelligence.seatCount)} />
                  <Fact label="Verified" value={formatDate(record.catalogIntelligence.matchedAt)} />
                </dl>
                {record.catalogIntelligence.attributes.length ? (
                  <div className="mt-6 border-t pt-5">
                    <h3 className="text-sm font-semibold">Configuration highlights</h3>
                    <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2" role="list">
                      {record.catalogIntelligence.attributes.slice(0, 12).map((attribute) => (
                        <li className="rounded-lg bg-muted/50 px-3 py-2" key={`${attribute.kind}:${attribute.name}`}>
                          <span className="font-medium">{attribute.name}</span>
                          {attribute.value ? <span className="text-muted-foreground"> · {attribute.value}{attribute.unit ? ` ${attribute.unit}` : ""}</span> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>
            ) : null}

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
                <p className="mt-1 text-xs text-muted-foreground">Active interests and completed purchases linked to this exact vehicle.</p>
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
                  <p className="mt-4 text-sm text-muted-foreground">No customers are linked to this exact vehicle.</p>
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
